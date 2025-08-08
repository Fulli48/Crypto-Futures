/**
 * NEW FORECAST PERFORMANCE TRACKING SYSTEM
 * 
 * This system replaces traditional trade simulations with forecast accuracy tracking.
 * It stores ML predictions when made, tracks actual outcomes after 20 minutes,
 * and calculates real performance metrics for the dashboard.
 */

import { db } from './db';
import { forecastPerformance } from '@shared/schema';
import type { InsertForecastPerformance, ForecastPerformance } from '@shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

export class ForecastPerformanceTracker {
  
  /**
   * Store a new ML forecast for tracking
   * Called whenever the ML engine generates a prediction
   */
  static async storeForecast(data: {
    symbol: string;
    initialPrice: number;
    forecastPrice: number;
    forecastChange: number;
    confidence: number;
    marketConditions?: any;
    signalStrength?: number;
  }): Promise<ForecastPerformance> {
    console.log(`📊 [FORECAST TRACKER] Storing new forecast for ${data.symbol}: ${data.forecastChange.toFixed(2)}% change predicted (${data.confidence}% confidence)`);
    
    const forecastData: InsertForecastPerformance = {
      symbol: data.symbol,
      initial_price: data.initialPrice.toString(),
      forecast_price: data.forecastPrice.toString(),
      forecast_change: data.forecastChange,
      confidence: data.confidence,
      market_conditions: data.marketConditions || null,
      signal_strength: data.signalStrength || 0,
      actual_timestamp: null,
      actual_price: null,
      actual_change: null,
      accuracy: null,
      is_successful: null,
      profit_potential: null,
      is_completed: false
    };
    
    const [result] = await db.insert(forecastPerformance).values([forecastData]).returning();
    return result;
  }
  
  /**
   * Update forecast with actual outcome after 20 minutes
   * Called by background worker to track forecast accuracy
   */
  static async updateWithActualOutcome(
    forecastId: number, 
    actualPrice: number
  ): Promise<ForecastPerformance | null> {
    try {
      // Get the original forecast
      const [forecast] = await db
        .select()
        .from(forecastPerformance)
        .where(eq(forecastPerformance.id, forecastId));
      
      if (!forecast || forecast.is_completed) {
        return null;
      }
      
      // Calculate actual change from initial price
      const initialPrice = parseFloat(forecast.initial_price);
      const actualChange = ((actualPrice - initialPrice) / initialPrice) * 100;
      
      // Calculate performance metrics
      const forecastError = Math.abs(actualChange - forecast.forecast_change);
      const accuracyScore = Math.max(0, 100 - (forecastError * 10)); // 1% error = 10 point deduction
      const directionCorrect = (actualChange > 0 && forecast.forecast_change > 0) || 
                               (actualChange < 0 && forecast.forecast_change < 0) ||
                               (Math.abs(actualChange) < 0.1 && Math.abs(forecast.forecast_change) < 0.1);
      
      // Determine error category
      let errorCategory: string;
      if (forecastError <= 0.5) errorCategory = 'excellent';
      else if (forecastError <= 1.0) errorCategory = 'good';
      else if (forecastError <= 2.0) errorCategory = 'poor';
      else errorCategory = 'terrible';
      
      // Calculate profit potential (what could have been made with perfect entry/exit)
      const profitPotential = Math.abs(actualChange);
      
      console.log(`✅ [FORECAST TRACKER] ${forecast.symbol} forecast completed:
        Predicted: ${forecast.forecast_change.toFixed(2)}%, Actual: ${actualChange.toFixed(2)}%
        Error: ${forecastError.toFixed(2)}%, Accuracy: ${accuracyScore.toFixed(1)}%, Direction: ${directionCorrect ? 'Correct' : 'Wrong'}`);
      
      // Update the forecast record
      const [updated] = await db
        .update(forecastPerformance)
        .set({
          actual_timestamp: new Date(),
          actual_price: actualPrice.toString(),
          actual_change: actualChange,
          accuracy: accuracyScore,
          is_successful: directionCorrect,
          is_completed: true
        })
        .where(eq(forecastPerformance.id, forecastId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error(`❌ [FORECAST TRACKER] Error updating forecast ${forecastId}:`, error);
      return null;
    }
  }
  
  /**
   * Get pending forecasts that need to be checked (20+ minutes old)
   */
  static async getPendingForecasts(): Promise<ForecastPerformance[]> {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    return await db
      .select()
      .from(forecastPerformance)
      .where(and(
        eq(forecastPerformance.is_completed, false),
        gte(forecastPerformance.forecast_timestamp, twentyMinutesAgo)
      ))
      .orderBy(desc(forecastPerformance.forecast_timestamp));
  }
  
  /**
   * Calculate overall system performance metrics for dashboard
   */
  static async getPerformanceMetrics(): Promise<{
    profitStrength: number;
    failureRate: number;
    totalForecasts: number;
    averageAccuracy: number;
    directionAccuracy: number;
    recentPerformance: number;
  }> {
    try {
      console.log("📊 [FORECAST PERFORMANCE] Starting metrics calculation...");
      
      // Get all completed forecasts (simpler query first)
      const completedForecasts = await db
        .select({
          accuracy: forecastPerformance.accuracy,
          is_successful: forecastPerformance.is_successful,
          forecast_timestamp: forecastPerformance.forecast_timestamp
        })
        .from(forecastPerformance)
        .where(eq(forecastPerformance.is_completed, true));
      
      console.log(`📊 [FORECAST PERFORMANCE] Found ${completedForecasts.length} completed forecasts`);
      
      if (completedForecasts.length === 0) {
        console.log("📊 [FORECAST PERFORMANCE] No completed forecasts found, returning default metrics");
        return {
          profitStrength: 0,
          failureRate: 100,
          totalForecasts: 0,
          averageAccuracy: 0,
          directionAccuracy: 0,
          recentPerformance: 0
        };
      }
      
      // Sort by timestamp (most recent first) and take last 100
      const recentForecasts = completedForecasts
        .sort((a, b) => new Date(b.forecast_timestamp).getTime() - new Date(a.forecast_timestamp).getTime())
        .slice(0, 100);
      
      // Calculate metrics
      const totalForecasts = recentForecasts.length;
      const averageAccuracy = recentForecasts.reduce((sum, f) => sum + (f.accuracy || 0), 0) / totalForecasts;
      const correctDirections = recentForecasts.filter(f => f.is_successful === true).length;
      const directionAccuracy = (correctDirections / totalForecasts) * 100;
      
      // Profit strength based on accuracy and direction correctness
      const profitStrength = (averageAccuracy * 0.7) + (directionAccuracy * 0.3);
      
      // Failure rate based on forecasts with <60% accuracy or wrong direction
      const failedForecasts = recentForecasts.filter(f => 
        (f.accuracy || 0) < 60 || f.is_successful !== true
      ).length;
      const failureRate = (failedForecasts / totalForecasts) * 100;
      
      // Recent performance (last 20 forecasts weighted more heavily)
      const last20 = recentForecasts.slice(0, 20);
      const recentPerformance = last20.length > 0 
        ? last20.reduce((sum, f) => sum + (f.accuracy || 0), 0) / last20.length
        : averageAccuracy;
      
      console.log(`📊 [FORECAST PERFORMANCE] Metrics calculated:
        Total Forecasts: ${totalForecasts}
        Average Accuracy: ${averageAccuracy.toFixed(1)}%
        Direction Accuracy: ${directionAccuracy.toFixed(1)}%
        Profit Strength: ${profitStrength.toFixed(1)}%
        Failure Rate: ${failureRate.toFixed(1)}%
        Recent Performance: ${recentPerformance.toFixed(1)}%`);
      
      return {
        profitStrength: Math.round(profitStrength),
        failureRate: Math.round(failureRate),
        totalForecasts,
        averageAccuracy: Math.round(averageAccuracy),
        directionAccuracy: Math.round(directionAccuracy),
        recentPerformance: Math.round(recentPerformance)
      };
    } catch (error) {
      console.error('❌ [FORECAST PERFORMANCE] Error calculating metrics:', error);
      return {
        profitStrength: 0,
        failureRate: 100,
        totalForecasts: 0,
        averageAccuracy: 0,
        directionAccuracy: 0,
        recentPerformance: 0
      };
    }
  }
  
  /**
   * Get active (pending) forecasts for dashboard display
   */
  static async getActiveForecasts(): Promise<ForecastPerformance[]> {
    return await db
      .select()
      .from(forecastPerformance)
      .where(eq(forecastPerformance.is_completed, false))
      .orderBy(desc(forecastPerformance.forecast_timestamp))
      .limit(10);
  }
  
  /**
   * Clean up old completed forecasts (keep last 1000)
   */
  static async cleanupOldForecasts(): Promise<number> {
    try {
      // Get completed forecasts older than the last 1000
      const allCompleted = await db
        .select({ id: forecastPerformance.id })
        .from(forecastPerformance)
        .where(eq(forecastPerformance.is_completed, true))
        .orderBy(desc(forecastPerformance.forecast_timestamp));
      
      if (allCompleted.length <= 1000) {
        return 0; // Nothing to clean up
      }
      
      const toDelete = allCompleted.slice(1000); // Keep first 1000, delete the rest
      const deleteIds = toDelete.map(f => f.id);
      
      // Delete old records
      const result = await db
        .delete(forecastPerformance)
        .where(
          eq(forecastPerformance.is_completed, true)
          // Add condition to delete only IDs in our list
        );
      
      console.log(`🧹 [FORECAST TRACKER] Cleaned up ${deleteIds.length} old forecast records`);
      return deleteIds.length;
    } catch (error) {
      console.error('❌ [FORECAST TRACKER] Error cleaning up old forecasts:', error);
      return 0;
    }
  }
}