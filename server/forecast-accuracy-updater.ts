import { db } from './db';
import { forecastAccuracyHistory, regimeModelScores, rollingChartData } from '../shared/schema';
import { eq, and, isNull, lt, sql, desc } from 'drizzle-orm';

/**
 * FORECAST ACCURACY UPDATER
 * 
 * Worker that runs every minute to:
 * 1. Find forecasts that need actual price data
 * 2. Calculate accuracy metrics
 * 3. Update regime model scores
 * 4. Learn from forecast performance
 */

export class ForecastAccuracyUpdater {
  private isRunning = false;
  private updateInterval = 60000; // 1 minute
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.startUpdater();
  }

  /**
   * Start the accuracy updater worker
   */
  startUpdater(): void {
    if (this.isRunning) return;
    
    console.log('🔄 [FORECAST UPDATER] Starting forecast accuracy tracking...');
    this.isRunning = true;
    
    // Run immediately, then every minute
    this.updateForecastAccuracy();
    this.intervalId = setInterval(() => {
      this.updateForecastAccuracy();
    }, this.updateInterval);
  }

  /**
   * Stop the accuracy updater
   */
  stopUpdater(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ [FORECAST UPDATER] Stopped forecast accuracy tracking');
  }

  /**
   * Main update function - processes pending forecasts
   */
  private async updateForecastAccuracy(): Promise<void> {
    try {
      console.log('📊 [FORECAST UPDATER] Checking for pending forecast accuracy updates...');
      
      // Find forecasts that need actual price data (horizon window has passed)
      const pendingForecasts = await this.findPendingForecasts();
      
      if (pendingForecasts.length === 0) {
        console.log('✅ [FORECAST UPDATER] No pending forecasts to update');
        return;
      }

      console.log(`🔍 [FORECAST UPDATER] Processing ${pendingForecasts.length} pending forecasts`);
      
      let updatedCount = 0;
      for (const forecast of pendingForecasts) {
        const success = await this.processForecastAccuracy(forecast);
        if (success) updatedCount++;
      }
      
      console.log(`✅ [FORECAST UPDATER] Updated ${updatedCount}/${pendingForecasts.length} forecasts`);
      
      // Update regime model scores after processing forecasts
      await this.updateRegimeModelScores();
      
    } catch (error) {
      console.error('❌ [FORECAST UPDATER] Error updating forecast accuracy:', error);
    }
  }

  /**
   * Find forecasts that need actual price data
   */
  private async findPendingForecasts(): Promise<any[]> {
    const now = new Date();
    
    return await db
      .select()
      .from(forecastAccuracyHistory)
      .where(
        and(
          isNull(forecastAccuracyHistory.actualPrice),
          lt(
            sql`${forecastAccuracyHistory.forecastTimestamp} + interval '1 minute' * ${forecastAccuracyHistory.horizonMinute}`,
            now
          )
        )
      )
      .limit(100); // Process in batches
  }

  /**
   * Process individual forecast accuracy
   */
  private async processForecastAccuracy(forecast: any): Promise<boolean> {
    try {
      const { id, symbol, forecastTimestamp, horizonMinute, predictedPrice, baseModel } = forecast;
      
      // Calculate the target timestamp for this forecast
      const targetTimestamp = new Date(
        new Date(forecastTimestamp).getTime() + horizonMinute * 60 * 1000
      );
      
      // Get actual price at target time
      const actualPrice = await this.getActualPrice(symbol, targetTimestamp);
      if (!actualPrice) {
        console.log(`⚠️ [FORECAST UPDATER] No actual price found for ${symbol} at ${targetTimestamp}`);
        return false;
      }
      
      // Calculate accuracy metrics
      const metrics = this.calculateAccuracyMetrics(
        parseFloat(predictedPrice),
        actualPrice,
        forecast
      );
      
      // Update forecast record with actual data
      await db
        .update(forecastAccuracyHistory)
        .set({
          actualPrice: actualPrice.toString(),
          directionCorrect: metrics.directionCorrect,
          absoluteErrorPct: metrics.absoluteErrorPct,
        })
        .where(eq(forecastAccuracyHistory.id, id));
      
      console.log(`✅ [FORECAST UPDATER] Updated ${symbol} ${baseModel} H${horizonMinute}: ${metrics.absoluteErrorPct.toFixed(2)}% error`);
      return true;
      
    } catch (error) {
      console.error(`❌ [FORECAST UPDATER] Error processing forecast ${forecast.id}:`, error);
      return false;
    }
  }

  /**
   * Get actual price at specific timestamp from chart data
   */
  private async getActualPrice(symbol: string, targetTimestamp: Date): Promise<number | null> {
    try {
      // Find closest chart data point to target timestamp
      const chartData = await db
        .select()
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            sql`${rollingChartData.timestamp} <= ${targetTimestamp}`,
            sql`${rollingChartData.timestamp} >= ${targetTimestamp} - interval '2 minutes'`
          )
        )
        .orderBy(desc(rollingChartData.timestamp))
        .limit(1);
      
      if (chartData.length > 0) {
        return parseFloat(chartData[0].close.toString());
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [FORECAST UPDATER] Error getting actual price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate accuracy metrics for a forecast
   */
  private calculateAccuracyMetrics(
    predictedPrice: number,
    actualPrice: number,
    forecast: any
  ): { directionCorrect: boolean; absoluteErrorPct: number } {
    // Get the initial price when forecast was made
    const initialPrice = parseFloat(forecast.predictedPrice); // Use predicted as baseline for now
    
    // Calculate direction correctness
    const predictedDirection = predictedPrice > initialPrice ? 1 : -1;
    const actualDirection = actualPrice > initialPrice ? 1 : -1;
    const directionCorrect = predictedDirection === actualDirection;
    
    // Calculate absolute error percentage
    const absoluteErrorPct = Math.abs(actualPrice - predictedPrice) / predictedPrice * 100;
    
    return { directionCorrect, absoluteErrorPct };
  }

  /**
   * Update regime model scores based on recent forecast accuracy
   */
  private async updateRegimeModelScores(): Promise<void> {
    try {
      console.log('📈 [FORECAST UPDATER] Updating regime model scores...');
      
      // Get completed forecasts from last 24 hours grouped by symbol, regime, model, horizon
      const completedForecasts = await db
        .select({
          symbol: forecastAccuracyHistory.symbol,
          regime: forecastAccuracyHistory.regime,
          baseModel: forecastAccuracyHistory.baseModel,
          horizonMinute: forecastAccuracyHistory.horizonMinute,
          avgAccuracy: sql<number>`AVG(CASE WHEN ${forecastAccuracyHistory.directionCorrect} THEN 100 ELSE 0 END)`,
          avgError: sql<number>`AVG(${forecastAccuracyHistory.absoluteErrorPct})`,
          sampleSize: sql<number>`COUNT(*)`,
        })
        .from(forecastAccuracyHistory)
        .where(
          and(
            sql`${forecastAccuracyHistory.actualPrice} IS NOT NULL`,
            sql`${forecastAccuracyHistory.forecastTimestamp} >= NOW() - INTERVAL '24 HOURS'`
          )
        )
        .groupBy(
          forecastAccuracyHistory.symbol,
          forecastAccuracyHistory.regime,
          forecastAccuracyHistory.baseModel,
          forecastAccuracyHistory.horizonMinute
        );
      
      // Update regime model scores
      for (const result of completedForecasts) {
        if (!result.regime || result.sampleSize < 3) continue; // Skip insufficient data
        
        const accuracy = 100 - result.avgError; // Convert error to accuracy percentage
        
        // Upsert regime model score
        await db
          .insert(regimeModelScores)
          .values({
            symbol: result.symbol,
            regime: result.regime,
            baseModel: result.baseModel,
            horizonMinute: result.horizonMinute,
            accuracy: Math.max(0, Math.min(100, accuracy)),
            sampleSize: result.sampleSize,
          })
          .onConflictDoUpdate({
            target: [
              regimeModelScores.symbol,
              regimeModelScores.regime,
              regimeModelScores.baseModel,
              regimeModelScores.horizonMinute,
            ],
            set: {
              accuracy: sql`${accuracy}`,
              sampleSize: sql`${result.sampleSize}`,
              updatedAt: new Date(),
            },
          });
      }
      
      console.log(`✅ [FORECAST UPDATER] Updated ${completedForecasts.length} regime model scores`);
      
    } catch (error) {
      console.error('❌ [FORECAST UPDATER] Error updating regime model scores:', error);
    }
  }

  /**
   * Get accuracy statistics for a specific model/regime/horizon combination
   */
  async getAccuracyStats(symbol: string, baseModel: string, regime: string, horizon: number): Promise<{
    accuracy: number;
    sampleSize: number;
    lastUpdated: Date;
  } | null> {
    try {
      const result = await db
        .select()
        .from(regimeModelScores)
        .where(
          and(
            eq(regimeModelScores.symbol, symbol),
            eq(regimeModelScores.baseModel, baseModel),
            eq(regimeModelScores.regime, regime),
            eq(regimeModelScores.horizonMinute, horizon)
          )
        )
        .limit(1);
      
      if (result.length > 0) {
        return {
          accuracy: result[0].accuracy || 0,
          sampleSize: result[0].sampleSize || 0,
          lastUpdated: result[0].updatedAt || new Date(),
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ [FORECAST UPDATER] Error getting accuracy stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const forecastAccuracyUpdater = new ForecastAccuracyUpdater();