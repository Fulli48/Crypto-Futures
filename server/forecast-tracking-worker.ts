/**
 * Forecast Tracking Worker
 * 
 * This worker monitors active trades and updates their forecast performance
 * data with actual market prices minute-by-minute for comprehensive learning.
 */

import { db } from './db.js';
import { tradeSimulations, rollingChartData } from '@shared/schema.js';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { enhancedForecastLearner } from './enhanced-forecast-learner.js';

export class ForecastTrackingWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastUpdateTime: Map<number, Date> = new Map();

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('📊 [FORECAST TRACKER] Starting per-minute forecast tracking...');
    
    // Update forecast points every minute
    this.intervalId = setInterval(() => {
      this.updateForecastPoints().catch(error => {
        console.error('❌ [FORECAST TRACKER] Error updating forecast points:', error);
      });
    }, 60000); // Every 60 seconds
    
    // Run initial check
    this.updateForecastPoints().catch(error => {
      console.error('❌ [FORECAST TRACKER] Error in initial forecast check:', error);
    });
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [FORECAST TRACKER] Forecast tracking stopped');
  }

  private async updateForecastPoints() {
    try {
      // Get all active trades
      const activeTrades = await db
        .select()
        .from(tradeSimulations)
        .where(
          and(
            eq(tradeSimulations.actualOutcome, 'IN_PROGRESS'),
            isNull(tradeSimulations.endTime)
          )
        )
        .orderBy(desc(tradeSimulations.startTime));

      if (activeTrades.length === 0) {
        return;
      }

      console.log(`📊 [FORECAST TRACKER] Updating forecast points for ${activeTrades.length} active trades`);

      for (const trade of activeTrades) {
        await this.updateTradeForecasts(trade);
      }

    } catch (error) {
      console.error('❌ [FORECAST TRACKER] Error in updateForecastPoints:', error);
    }
  }

  private async updateTradeForecasts(trade: any) {
    try {
      const now = new Date();
      const startTime = new Date(trade.startTime);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      
      // Skip if trade just started (less than 1 minute)
      if (elapsedMinutes < 1) {
        return;
      }

      // Get the current minute we should be updating (1-based)
      const currentMinute = Math.min(elapsedMinutes, 20); // Cap at 20 minutes
      
      // Check if we already updated this minute for this trade
      const lastUpdate = this.lastUpdateTime.get(trade.id);
      if (lastUpdate && currentMinute <= Math.floor((lastUpdate.getTime() - startTime.getTime()) / (1000 * 60))) {
        return; // Already updated this minute
      }

      // Get current price for this symbol
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      if (!currentPrice) {
        console.warn(`⚠️ [FORECAST TRACKER] No current price available for ${trade.symbol}`);
        return;
      }

      // Update forecast point for the current minute
      await enhancedForecastLearner.updateForecastPoint(
        trade.id,
        currentMinute,
        currentPrice,
        now
      );

      // Update last processed time
      this.lastUpdateTime.set(trade.id, now);

      console.log(`📊 [FORECAST TRACKER] Updated trade ${trade.id} (${trade.symbol}) minute ${currentMinute} with price ${currentPrice}`);

    } catch (error) {
      console.error(`❌ [FORECAST TRACKER] Error updating forecasts for trade ${trade.id}:`, error);
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const latestData = await db
        .select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(1);

      if (latestData.length === 0) return null;
      return parseFloat(latestData[0].close);
    } catch (error) {
      console.error(`❌ [FORECAST TRACKER] Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Clean up tracking data for completed trades
   */
  async cleanupCompletedTrades() {
    try {
      // Get completed trades that are no longer active
      const completedTrades = await db
        .select({ id: tradeSimulations.id })
        .from(tradeSimulations)
        .where(
          and(
            sql`${tradeSimulations.actualOutcome} != 'IN_PROGRESS'`,
            sql`${tradeSimulations.endTime} IS NOT NULL`
          )
        );

      // Remove tracking data for completed trades
      for (const trade of completedTrades) {
        this.lastUpdateTime.delete(trade.id);
      }

      if (completedTrades.length > 0) {
        console.log(`🧹 [FORECAST TRACKER] Cleaned up tracking data for ${completedTrades.length} completed trades`);
      }

    } catch (error) {
      console.error('❌ [FORECAST TRACKER] Error cleaning up completed trades:', error);
    }
  }

  /**
   * Get forecast tracking statistics
   */
  async getTrackingStats(): Promise<any> {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT trade_id) as tracked_trades,
          COUNT(*) as total_forecast_points,
          COUNT(CASE WHEN actual_price IS NOT NULL THEN 1 END) as updated_points,
          AVG(CASE WHEN direction_correct THEN 1.0 ELSE 0.0 END) as avg_accuracy
        FROM forecast_performance_data
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      if (stats.rows && stats.rows.length > 0) {
        const result = stats.rows[0];
        return {
          trackedTrades: parseInt(result.tracked_trades as string) || 0,
          totalForecastPoints: parseInt(result.total_forecast_points as string) || 0,
          updatedPoints: parseInt(result.updated_points as string) || 0,
          averageAccuracy: parseFloat(result.avg_accuracy as string) || 0,
          updateRate: result.total_forecast_points > 0 ? 
            (parseInt(result.updated_points as string) / parseInt(result.total_forecast_points as string)) * 100 : 0
        };
      }

      return {
        trackedTrades: 0,
        totalForecastPoints: 0,
        updatedPoints: 0,
        averageAccuracy: 0,
        updateRate: 0
      };

    } catch (error) {
      console.error('❌ [FORECAST TRACKER] Error getting tracking stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const forecastTrackingWorker = new ForecastTrackingWorker();