import { db } from './db';
import { tradeSimulations, rollingChartData } from '../shared/schema';
import { eq, and, isNull, gte, desc, or } from 'drizzle-orm';

/**
 * Trade Completion Worker - Monitors and completes active trades
 * Checks for TP/SL hits or expiration and updates trade status accordingly
 */
class TradeCompletionWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🎯 [TRADE COMPLETION] Starting trade completion monitoring...');
    
    // Check trades every 30 seconds
    this.intervalId = setInterval(() => {
      this.processActiveTrades().catch(error => {
        console.error('❌ [TRADE COMPLETION] Error processing trades:', error);
      });
    }, 30000);
    
    // Run initial check
    this.processActiveTrades().catch(error => {
      console.error('❌ [TRADE COMPLETION] Error in initial trade check:', error);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [TRADE COMPLETION] Trade completion monitoring stopped');
  }

  private async processActiveTrades() {
    try {
      // Get all active trades
      const activeTrades = await db.select()
        .from(tradeSimulations)
        .where(
          and(
            or(
              eq(tradeSimulations.actualOutcome, 'IN_PROGRESS'),
              isNull(tradeSimulations.actualOutcome),
              eq(tradeSimulations.actualOutcome, '')
            ),
            isNull(tradeSimulations.endTime)
          )
        )
        .orderBy(desc(tradeSimulations.startTime))
        .limit(100); // Process in batches

      if (activeTrades.length === 0) {
        console.log('🔍 [TRADE COMPLETION] No active trades to process');
        return;
      }

      console.log(`🔍 [TRADE COMPLETION] Processing ${activeTrades.length} active trades`);
      let completedCount = 0;

      for (const trade of activeTrades) {
        const completed = await this.checkTradeCompletion(trade);
        if (completed) completedCount++;
      }

      if (completedCount > 0) {
        console.log(`✅ [TRADE COMPLETION] Completed ${completedCount}/${activeTrades.length} trades`);
      }

    } catch (error) {
      console.error('❌ [TRADE COMPLETION] Error in processActiveTrades:', error);
    }
  }

  private async checkTradeCompletion(trade: any): Promise<boolean> {
    try {
      const now = new Date();
      const startTime = new Date(trade.startTime);
      const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
      
      // Get expected duration from the durationMinutes field (should be 20 minutes)
      const expectedDuration = trade.durationMinutes || 20; // Use trade's duration or default to 20 min

      // Check if trade has expired - mark for realistic evaluation
      if (elapsedMinutes >= expectedDuration) {
        await this.completeTrade(trade, 'EXPIRED', 0); // Temporary outcome
        console.log(`⏰ [TRADE COMPLETION] Trade ${trade.id} expired after ${expectedDuration} minutes (${elapsedMinutes.toFixed(1)} elapsed) - will evaluate realistically`);
        
        // Apply realistic evaluation for expired trades
        try {
          const { RealisticTradeEvaluator } = await import('./realistic-trade-evaluator.js');
          await RealisticTradeEvaluator.updateTradeWithRealisticEvaluation(trade.id);
          console.log(`✅ [REALISTIC EVALUATION] Completed realistic evaluation for expired trade ${trade.id}`);
        } catch (error) {
          console.error(`❌ [REALISTIC EVALUATION] Failed to evaluate expired trade ${trade.id}:`, error);
        }
        
        return true;
      }

      // Get current price for TP/SL check
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      if (!currentPrice) return false;

      const entryPrice = parseFloat(trade.entryPrice);
      const tpPrice = parseFloat(trade.tpPrice);
      const slPrice = parseFloat(trade.slPrice);
      const isLong = trade.signalType === 'LONG';

      // Check for TP hit
      if (isLong && currentPrice >= tpPrice) {
        const profit = ((tpPrice - entryPrice) / entryPrice) * 100;
        await this.completeTrade(trade, 'TP_HIT', profit);
        console.log(`🎯 [TRADE COMPLETION] Trade ${trade.id} hit TP: ${profit.toFixed(2)}%`);
        return true;
      }

      if (!isLong && currentPrice <= tpPrice) {
        const profit = ((entryPrice - tpPrice) / entryPrice) * 100;
        await this.completeTrade(trade, 'TP_HIT', profit);
        console.log(`🎯 [TRADE COMPLETION] Trade ${trade.id} hit TP: ${profit.toFixed(2)}%`);
        return true;
      }

      // Check for SL hit
      if (isLong && currentPrice <= slPrice) {
        const loss = ((slPrice - entryPrice) / entryPrice) * 100;
        await this.completeTrade(trade, 'SL_HIT', loss);
        console.log(`🛑 [TRADE COMPLETION] Trade ${trade.id} hit SL: ${loss.toFixed(2)}%`);
        return true;
      }

      if (!isLong && currentPrice >= slPrice) {
        const loss = ((entryPrice - slPrice) / entryPrice) * 100;
        await this.completeTrade(trade, 'SL_HIT', loss);
        console.log(`🛑 [TRADE COMPLETION] Trade ${trade.id} hit SL: ${loss.toFixed(2)}%`);
        return true;
      }

    } catch (error) {
      console.error(`❌ [TRADE COMPLETION] Error checking trade ${trade.id}:`, error);
    }

    return false;
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const latestData = await db.select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(1);

      if (latestData.length === 0) return null;
      return parseFloat(latestData[0].close);
    } catch (error) {
      console.error(`❌ [TRADE COMPLETION] Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  private async completeTrade(trade: any, outcome: string, profitLoss: number) {
    try {
      await db.update(tradeSimulations)
        .set({
          actualOutcome: outcome,
          endTime: new Date(),
          profitLoss: profitLoss.toString(),
          isSuccessful: outcome === 'TP_HIT',
          completionProcessed: true,
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tradeSimulations.id, trade.id));

      console.log(`✅ [TRADE COMPLETION] Updated trade ${trade.id} with outcome: ${outcome}`);
      
      // Trigger enhanced forecast learning for completed trade
      try {
        const { enhancedForecastLearner } = await import('./enhanced-forecast-learner.js');
        await enhancedForecastLearner.processCompletedTrade(trade.id);
        console.log(`📊 [FORECAST LEARNING] Completed forecast analysis for trade ${trade.id}`);
      } catch (error) {
        console.error(`❌ [FORECAST LEARNING] Error processing forecast learning for trade ${trade.id}:`, error);
      }
      
    } catch (error) {
      console.error(`❌ [TRADE COMPLETION] Error completing trade ${trade.id}:`, error);
    }
  }
}

// Export singleton instance
export const tradeCompletionWorker = new TradeCompletionWorker();