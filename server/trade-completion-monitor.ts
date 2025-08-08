import { db } from './db.js';
import { tradeSimulations } from '@shared/schema';
import { sql, and, isNull, ne } from 'drizzle-orm';
import { RealisticTradeEvaluator } from './realistic-trade-evaluator.js';

/**
 * Trade Completion Monitor Service
 * Continuously monitors active trades and marks them as TP_HIT or SL_HIT when price targets are reached
 */
export class TradeCompletionMonitor {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Start the trade completion monitoring service
   */
  public static start(): void {
    if (this.isRunning) {
      console.log('🎯 [TRADE COMPLETION] Service already running');
      return;
    }

    console.log('🚀 [TRADE COMPLETION] Starting trade completion monitoring service...');
    this.isRunning = true;

    // Run immediately
    this.checkForCompletedTrades();

    // Then run every 10 seconds for real-time monitoring
    this.intervalId = setInterval(() => {
      this.checkForCompletedTrades();
    }, 10000);

    console.log('✅ [TRADE COMPLETION] Service started - checking every 10 seconds');
  }

  /**
   * Stop the trade completion monitoring service
   */
  public static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [TRADE COMPLETION] Service stopped');
  }

  /**
   * Check active trades for TP/SL completion
   */
  private static async checkForCompletedTrades(): Promise<void> {
    if (this.isProcessing) {
      return; // Avoid concurrent processing
    }

    try {
      this.isProcessing = true;

      // Get all active trades (no outcome set yet)
      const activeTrades = await db.select({
        id: tradeSimulations.id,
        symbol: tradeSimulations.symbol,
        signalType: tradeSimulations.signalType,
        entryPrice: tradeSimulations.entryPrice,
        tpPrice: tradeSimulations.tpPrice,
        slPrice: tradeSimulations.slPrice,
        createdAt: tradeSimulations.createdAt
      })
      .from(tradeSimulations)
      .where(
        and(
          isNull(tradeSimulations.actualOutcome),
          isNull(tradeSimulations.completedAt)
        )
      )
      .limit(50); // Process in batches

      if (activeTrades.length === 0) {
        return; // No active trades to check
      }

      console.log(`🔍 [TRADE COMPLETION] Checking ${activeTrades.length} active trades for TP/SL completion`);

      // Check each trade for completion
      for (const trade of activeTrades) {
        await this.checkTradeCompletion(trade);
      }

    } catch (error) {
      console.error('❌ [TRADE COMPLETION] Error checking for completed trades:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if a specific trade should be completed (20-minute expiration or rare TP/SL hit)
   */
  private static async checkTradeCompletion(trade: any): Promise<void> {
    try {
      const now = new Date();
      const tradeAge = (now.getTime() - new Date(trade.createdAt).getTime()) / 60000; // minutes
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      
      if (!currentPrice) {
        return; // Can't check without current price
      }

      const entryPrice = parseFloat(trade.entryPrice);
      const tpPrice = parseFloat(trade.tpPrice);
      const slPrice = parseFloat(trade.slPrice);

      let outcome: string | null = null;
      let profitLoss = 0;

      // Primary completion logic: 20-minute expiration - mark for realistic evaluation
      if (tradeAge >= 20) {
        outcome = 'EXPIRED'; // Will be replaced by realistic evaluation
        // Calculate temporary P/L at expiration
        if (trade.signalType === 'LONG') {
          profitLoss = ((currentPrice - entryPrice) / entryPrice) * 100;
        } else {
          profitLoss = ((entryPrice - currentPrice) / entryPrice) * 100;
        }
      } 
      // Secondary completion logic: Rare TP/SL hits during monitoring
      else {
        if (trade.signalType === 'LONG') {
          if (currentPrice >= tpPrice) {
            outcome = 'TP_HIT';
            profitLoss = ((tpPrice - entryPrice) / entryPrice) * 100;
          } else if (currentPrice <= slPrice) {
            outcome = 'SL_HIT';
            profitLoss = ((slPrice - entryPrice) / entryPrice) * 100;
          }
        } else { // SHORT trade
          if (currentPrice <= tpPrice) {
            outcome = 'TP_HIT';
            profitLoss = ((entryPrice - tpPrice) / entryPrice) * 100;
          } else if (currentPrice >= slPrice) {
            outcome = 'SL_HIT';
            profitLoss = ((entryPrice - slPrice) / entryPrice) * 100;
          }
        }
      }

      // If trade completed, update it with highest profit reached data
      if (outcome) {
        // Get the highest profit reached from simple tracker data
        const highestProfitResult = await db.execute(sql`
          SELECT MAX(CASE 
            WHEN pnl_percentage > 0 THEN pnl_percentage 
            ELSE 0 
          END) as highest_profit_reached
          FROM simple_trade_tracker 
          WHERE trade_id = ${trade.id}
        `);

        const highestProfitReached = highestProfitResult.rows[0] ? 
          parseFloat((highestProfitResult.rows[0] as any).highest_profit_reached || '0') : 0;
        
        await db.update(tradeSimulations)
          .set({
            actualOutcome: outcome,
            endTime: now,
            completedAt: now,
            profitLoss: profitLoss.toString(),
            highestProfit: highestProfitReached.toString(),
            updatedAt: now
          })
          .where(sql`id = ${trade.id}`);

        const durationMinutes = Math.round(tradeAge);
        console.log(`✅ [TRADE COMPLETION] Updated trade ${trade.id} with initial outcome: ${outcome}`);
        console.log(`⏰ [TRADE COMPLETION] Trade ${trade.id} completed after ${durationMinutes} minutes (age: ${tradeAge.toFixed(1)}min)`);
        console.log(`💰 [TRADE COMPLETION] ${trade.symbol} ${trade.signalType}: Entry $${entryPrice.toFixed(4)} → Final $${currentPrice.toFixed(4)} → ${outcome} (${profitLoss.toFixed(2)}% final, ${highestProfitReached.toFixed(2)}% highest)`);
        
        // Apply realistic evaluation for EXPIRED trades (TP_HIT and SL_HIT keep their outcomes)
        if (outcome === 'EXPIRED') {
          console.log(`🔍 [REALISTIC EVALUATION] Starting realistic evaluation for expired trade ${trade.id}`);
          try {
            await RealisticTradeEvaluator.updateTradeWithRealisticEvaluation(trade.id);
            console.log(`✅ [REALISTIC EVALUATION] Completed realistic evaluation for trade ${trade.id}`);
          } catch (error) {
            console.error(`❌ [REALISTIC EVALUATION] Failed to evaluate trade ${trade.id}:`, error);
          }
        }
      }

    } catch (error) {
      console.error(`❌ [TRADE COMPLETION] Error checking trade ${trade.id}:`, error);
    }
  }

  /**
   * Get current price for a symbol from rolling chart data
   */
  private static async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        SELECT close 
        FROM rolling_chart_data 
        WHERE symbol = ${symbol} 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      if (result.rows && result.rows.length > 0) {
        return parseFloat((result.rows[0] as any).close.toString());
      }
      return null;
    } catch (error) {
      console.error(`❌ [TRADE COMPLETION] Error getting current price for ${symbol}:`, error);
      return null;
    }
  }
}