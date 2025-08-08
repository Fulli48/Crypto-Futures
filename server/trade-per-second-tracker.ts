import { db } from './db';
import { tradeSimulations, tradeChartData, rollingChartData } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export class TradePerSecondTracker {
  
  /**
   * Updates all active trades with per-second profit/loss tracking
   * Uses rolling chart database for authentic price data
   */
  static async updateAllActiveTrades(): Promise<void> {
    try {
      // Get all active trades
      const activeTrades = await db.select()
        .from(tradeSimulations)
        .where(eq(tradeSimulations.actualOutcome, 'IN_PROGRESS'));

      console.log(`🔄 [PER-SECOND TRACKER] Processing ${activeTrades.length} active trades`);

      // Process each trade individually
      for (const trade of activeTrades) {
        await this.updateTradeWithCurrentPrice(trade);
      }
    } catch (error) {
      console.error('❌ [PER-SECOND TRACKER] Error updating trades:', error);
    }
  }

  /**
   * Updates a single trade with current price from rolling chart data
   */
  private static async updateTradeWithCurrentPrice(trade: any): Promise<void> {
    try {
      // Get current price from rolling chart data (most recent entry)
      const currentChartData = await db.select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, trade.symbol))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(1);

      if (currentChartData.length === 0) {
        console.warn(`⚠️ [PER-SECOND TRACKER] No chart data found for ${trade.symbol}`);
        return;
      }

      const currentPrice = parseFloat(currentChartData[0].close);
      const entryPrice = parseFloat(trade.entryPrice);
      
      // Calculate elapsed time
      const createdAt = new Date(trade.createdAt);
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

      // Calculate current profit percentage based on trade direction
      let currentProfitPercent: number;
      if (trade.signalType === 'LONG') {
        currentProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else { // SHORT
        currentProfitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
      }

      // Get previous chart data entry to calculate cumulative time
      const prevChartEntry = await db.select()
        .from(tradeChartData)
        .where(eq(tradeChartData.tradeId, trade.id))
        .orderBy(desc(tradeChartData.secondsSinceEntry))
        .limit(1);

      let cumulativeProfitTime = 0;
      let cumulativeLossTime = 0;

      if (prevChartEntry.length > 0) {
        // Continue from previous accumulated times
        cumulativeProfitTime = prevChartEntry[0].profitTime;
        cumulativeLossTime = prevChartEntry[0].lossTime;
        
        // Add 1 second to appropriate category based on current status
        if (currentProfitPercent > 0) {
          cumulativeProfitTime += 1;
        } else if (currentProfitPercent < 0) {
          cumulativeLossTime += 1;
        }
        // When currentProfitPercent === 0, neither category increments
      } else {
        // First entry - start accumulation based on current status
        if (currentProfitPercent > 0) {
          cumulativeProfitTime = 1;
          cumulativeLossTime = 0;
        } else if (currentProfitPercent < 0) {
          cumulativeProfitTime = 0;
          cumulativeLossTime = 1;
        } else {
          // Exactly at entry price - no time accumulated yet
          cumulativeProfitTime = 0;
          cumulativeLossTime = 0;
        }
      }

      // Store this tick's data in trade_chart_data table
      await db.insert(tradeChartData).values({
        tradeId: trade.id,
        timestamp: now,
        secondsSinceEntry: elapsedSeconds,
        currentPrice: currentPrice.toString(),
        currentProfitPercent: currentProfitPercent.toString(),
        profitTime: cumulativeProfitTime,
        lossTime: cumulativeLossTime,
        takeProfit: trade.tpPrice,
        stopLoss: trade.slPrice,
        entryPrice: trade.entryPrice
      });

      // Log every 30 seconds to avoid spam
      if (elapsedSeconds % 30 === 0) {
        const totalTime = cumulativeProfitTime + cumulativeLossTime;
        const profitTimePercent = totalTime > 0 ? (cumulativeProfitTime / totalTime) * 100 : 0;
        
        console.log(`📊 [PER-SECOND TRACKER] ${trade.symbol} (${elapsedSeconds}s): ${currentProfitPercent.toFixed(4)}% P&L, ${cumulativeProfitTime}s profit, ${cumulativeLossTime}s loss (${profitTimePercent.toFixed(1)}% profitable)`);
      }

    } catch (error) {
      console.error(`❌ [PER-SECOND TRACKER] Error updating trade ${trade.id}:`, error);
    }
  }

  /**
   * Calculates final profit_time_percent when trade completes
   */
  static async calculateFinalProfitTimePercent(tradeId: number): Promise<number> {
    try {
      // Get the most recent chart data entry for this trade
      const latestEntry = await db.select()
        .from(tradeChartData)
        .where(eq(tradeChartData.tradeId, tradeId))
        .orderBy(desc(tradeChartData.secondsSinceEntry))
        .limit(1);

      if (latestEntry.length === 0) {
        console.warn(`⚠️ [PER-SECOND TRACKER] No chart data found for completed trade ${tradeId}`);
        return 0;
      }

      const finalEntry = latestEntry[0];
      const totalTime = finalEntry.profitTime + finalEntry.lossTime;
      
      if (totalTime === 0) {
        return 0;
      }

      const profitTimePercent = (finalEntry.profitTime / totalTime) * 100;
      
      console.log(`✅ [PER-SECOND TRACKER] Trade ${tradeId} completed: ${finalEntry.profitTime}s profit, ${finalEntry.lossTime}s loss = ${profitTimePercent.toFixed(1)}% profitable time`);
      
      return profitTimePercent;
      
    } catch (error) {
      console.error(`❌ [PER-SECOND TRACKER] Error calculating final profit time for trade ${tradeId}:`, error);
      return 0;
    }
  }
}