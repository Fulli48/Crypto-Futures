import { db } from './db';
import { sql } from "drizzle-orm";
import { tradeChartData } from '@shared/schema';

/**
 * Simplified per-second tracker that bypasses Drizzle ORM for the problematic columns
 * Updates trade profit/loss tracking data every second using direct SQL
 */
export class SimplePerSecondTracker {

  /**
   * Updates all active trades with current profit status
   */
  static async updateAllActiveTrades(): Promise<void> {
    try {
      // Get all active trades using direct SQL to avoid ORM column issues
      const result = await db.execute(sql`
        SELECT id, symbol, signal_type, entry_price, tp_price, sl_price, created_at
        FROM trade_simulations 
        WHERE actual_outcome = 'IN_PROGRESS'
      `);

      // Handle different result structures from different database drivers
      let activeTrades;
      if (Array.isArray(result)) {
        activeTrades = result;
      } else if (result.rows && Array.isArray(result.rows)) {
        activeTrades = result.rows;
      } else if (result.rowsAffected !== undefined) {
        // This looks like an empty result set
        activeTrades = [];
      } else {
        // Try to find the actual array data in the result
        for (const key of Object.keys(result || {})) {
          if (Array.isArray(result[key])) {
            activeTrades = result[key];
            break;
          }
        }
        if (!activeTrades) {
          activeTrades = [];
        }
      }

      if (!activeTrades || activeTrades.length === 0) {
        console.log(`⏱️ [SIMPLE TRACKER] No active trades found`);
        return;
      }

      console.log(`⏱️ [SIMPLE TRACKER] Updating ${activeTrades.length} active trades`);

      // Update each trade
      for (const trade of activeTrades) {
        await this.updateSingleTrade(trade);
      }

    } catch (error) {
      console.error('❌ [SIMPLE TRACKER] Error updating trades:', error);
    }
  }

  /**
   * Updates a single trade with current profit status
   */
  private static async updateSingleTrade(trade: any): Promise<void> {
    try {
      // Get current price from rolling chart data
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      if (!currentPrice) {
        return;
      }

      const entryPrice = parseFloat(trade.entry_price);
      
      // Calculate current profit percentage
      let currentProfitPercent: number;
      if (trade.signal_type === 'LONG') {
        currentProfitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else { // SHORT
        currentProfitPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
      }

      // Calculate elapsed seconds
      const createdAt = new Date(trade.created_at);
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

      // Get previous tracking data to calculate cumulative times
      const prevData = await db.execute(sql`
        SELECT profit_time, loss_time 
        FROM trade_simulations 
        WHERE id = ${trade.id}
      `);

      let profitTime = 0;
      let lossTime = 0;

      // Handle different result structures from different database drivers
      let resultData;
      if (Array.isArray(prevData)) {
        resultData = prevData;
      } else if (prevData.rows && Array.isArray(prevData.rows)) {
        resultData = prevData.rows;
      } else {
        resultData = [];
      }

      if (resultData.length > 0) {
        profitTime = parseInt(resultData[0].profit_time || '0');
        lossTime = parseInt(resultData[0].loss_time || '0');
      }

      // Add 1 second to appropriate category
      if (currentProfitPercent > 0) {
        profitTime += 1;
      } else if (currentProfitPercent < 0) {
        lossTime += 1;
      }

      // Update movement tracking (calculate actual movement during trade)
      const movementData = await this.calculateMovementData(trade.id, currentPrice, entryPrice);
      
      // Update using direct SQL with correct column names (snake_case for database)
      await db.execute(sql`
        UPDATE trade_simulations 
        SET current_profit_percent = ${currentProfitPercent.toFixed(4)},
            profit_time = ${profitTime},
            loss_time = ${lossTime},
            actual_movement_percent = ${movementData.actualMovement.toFixed(4)},
            max_price_during_trade = ${movementData.maxPrice.toString()},
            min_price_during_trade = ${movementData.minPrice.toString()},
            excluded_from_learning = ${movementData.excludedFromLearning},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${trade.id}
      `);

      // Store detailed chart data for this second (same logic as routes.ts)
      await this.storeChartData(trade, currentPrice, currentProfitPercent, elapsedSeconds, profitTime, lossTime);

      // Log every 30 seconds to avoid spam
      if (elapsedSeconds % 30 === 0) {
        const totalTime = profitTime + lossTime;
        const profitTimePercent = totalTime > 0 ? (profitTime / totalTime) * 100 : 0;
        
        console.log(`📊 [SIMPLE TRACKER] ${trade.symbol} (${elapsedSeconds}s): ${currentProfitPercent.toFixed(4)}% P&L, ${profitTime}s profit, ${lossTime}s loss (${profitTimePercent.toFixed(1)}% profitable)`);
      }

    } catch (error) {
      console.error(`❌ [SIMPLE TRACKER] Error updating trade ${trade.id}:`, error);
    }
  }

  /**
   * Gets current price from rolling chart data
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

      // Handle different result structures from different database drivers
      let chartData;
      if (Array.isArray(result)) {
        chartData = result;
      } else if (result.rows && Array.isArray(result.rows)) {
        chartData = result.rows;
      } else {
        chartData = [];
      }

      if (chartData.length === 0) {
        return null;
      }

      return parseFloat(chartData[0].close);

    } catch (error) {
      console.error(`❌ [SIMPLE TRACKER] Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Stores detailed chart data for this second's tracking
   */
  private static async storeChartData(trade: any, currentPrice: number, currentProfitPercent: number, elapsedSeconds: number, profitTime: number, lossTime: number): Promise<void> {
    try {
      // Calculate profit and loss percentages for this second
      const profitPercent = currentProfitPercent > 0 ? currentProfitPercent : 0;
      const lossPercent = currentProfitPercent < 0 ? Math.abs(currentProfitPercent) : 0;

      await db.execute(sql`
        INSERT INTO trade_chart_data (
          trade_id, timestamp, seconds_since_entry, current_price, 
          profit_time, profit_percent, loss_time, loss_percent,
          highest_profit, lowest_loss, take_profit, stop_loss, 
          entry_price, profit_chance, trade_duration_type, 
          suggested_direction, current_profit_percent
        ) VALUES (
          ${trade.id}, ${new Date()}, ${elapsedSeconds}, ${currentPrice.toString()},
          ${profitTime}, ${currentProfitPercent.toString()}, ${lossTime}, ${Math.abs(currentProfitPercent < 0 ? currentProfitPercent : 0).toString()},
          ${Math.max(0, currentProfitPercent).toString()}, ${Math.abs(Math.min(0, currentProfitPercent)).toString()}, 
          ${trade.tp_price}, ${trade.sl_price}, ${trade.entry_price}, 
          ${"0.00"}, ${"MEDIUM"}, ${trade.signal_type}, ${currentProfitPercent.toString()}
        )
      `);

      console.log(`📊 [SIMPLE TRACKER] Stored chart data for trade ${trade.id}: ${currentProfitPercent.toFixed(4)}% P&L at ${elapsedSeconds}s`);

    } catch (error) {
      console.error(`❌ [SIMPLE TRACKER] Error storing chart data for trade ${trade.id}:`, error);
    }
  }

  /**
   * Gets final profit time percentage for completed trade
   */
  static async getFinalProfitTimePercent(tradeId: number): Promise<number> {
    try {
      const result = await db.execute(sql`
        SELECT profit_time, loss_time 
        FROM trade_simulations 
        WHERE id = ${tradeId}
      `);

      // Handle different result structures from different database drivers
      let resultData;
      if (Array.isArray(result)) {
        resultData = result;
      } else if (result.rows && Array.isArray(result.rows)) {
        resultData = result.rows;
      } else {
        resultData = [];
      }

      if (resultData.length === 0) {
        return 0;
      }

      const profitTime = parseInt(resultData[0].profit_time || '0');
      const lossTime = parseInt(resultData[0].loss_time || '0');
      const totalTime = profitTime + lossTime;

      if (totalTime === 0) {
        return 0;
      }

      const profitTimePercent = (profitTime / totalTime) * 100;
      
      console.log(`✅ [SIMPLE TRACKER] Trade ${tradeId} final: ${profitTime}s profit, ${lossTime}s loss = ${profitTimePercent.toFixed(1)}% profitable time`);
      
      return profitTimePercent;

    } catch (error) {
      console.error(`❌ [SIMPLE TRACKER] Error getting final time for trade ${tradeId}:`, error);
      return 0;
    }
  }

  /**
   * Calculate movement data for a trade including whether it should be excluded from learning
   */
  private static async calculateMovementData(tradeId: number, currentPrice: number, entryPrice: number): Promise<{
    actualMovement: number;
    maxPrice: number;
    minPrice: number;
    excludedFromLearning: boolean;
  }> {
    try {
      // Get current max/min prices from database
      const result = await db.execute(sql`
        SELECT max_price_during_trade, min_price_during_trade 
        FROM trade_simulations 
        WHERE id = ${tradeId}
      `);

      let resultData;
      if (Array.isArray(result)) {
        resultData = result;
      } else if (result.rows && Array.isArray(result.rows)) {
        resultData = result.rows;
      } else {
        resultData = [];
      }

      let maxPrice = entryPrice;
      let minPrice = entryPrice;

      if (resultData.length > 0) {
        maxPrice = Math.max(parseFloat(resultData[0].max_price_during_trade || entryPrice.toString()), currentPrice);
        minPrice = Math.min(parseFloat(resultData[0].min_price_during_trade || entryPrice.toString()), currentPrice);
      } else {
        // Initialize with current price if no data exists
        maxPrice = Math.max(entryPrice, currentPrice);
        minPrice = Math.min(entryPrice, currentPrice);
      }

      // Calculate actual movement percentage during trade
      const actualMovement = ((maxPrice - minPrice) / entryPrice) * 100;
      
      // Movement threshold: 0.1% (configurable per trade in the future)
      const MOVEMENT_THRESHOLD = 0.1;
      const excludedFromLearning = actualMovement < MOVEMENT_THRESHOLD;

      return {
        actualMovement,
        maxPrice,
        minPrice,
        excludedFromLearning
      };

    } catch (error) {
      console.error(`❌ [SIMPLE TRACKER] Error calculating movement data for trade ${tradeId}:`, error);
      return {
        actualMovement: 0,
        maxPrice: entryPrice,
        minPrice: entryPrice,
        excludedFromLearning: false // Don't exclude on error
      };
    }
  }
}