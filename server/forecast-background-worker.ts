/**
 * Background worker to process pending forecasts and update performance metrics
 */

import { ForecastPerformanceTracker } from './forecast-performance-tracker';
import { AdaptiveBoldnessManager } from './adaptive-boldness-manager';
import { db } from './db';
import { cryptocurrencies } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class ForecastBackgroundWorker {
  private static instance: ForecastBackgroundWorker;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private adaptiveBoldnessManager: AdaptiveBoldnessManager;

  static getInstance(): ForecastBackgroundWorker {
    if (!this.instance) {
      this.instance = new ForecastBackgroundWorker();
    }
    return this.instance;
  }

  private constructor() {
    this.adaptiveBoldnessManager = new AdaptiveBoldnessManager();
  }

  /**
   * Start the background worker to process forecasts every 5 minutes
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 [FORECAST WORKER] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [FORECAST WORKER] Starting background forecast processing...');

    // Process immediately on start
    this.processPendingForecasts();

    // Then process every 5 minutes
    this.intervalId = setInterval(() => {
      this.processPendingForecasts();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ [FORECAST WORKER] Stopped background processing');
  }

  /**
   * Process all pending forecasts
   */
  private async processPendingForecasts(): Promise<void> {
    try {
      console.log('🔍 [FORECAST WORKER] Checking for pending forecasts...');
      
      const pendingForecasts = await ForecastPerformanceTracker.getPendingForecasts();
      
      if (pendingForecasts.length === 0) {
        console.log('✅ [FORECAST WORKER] No pending forecasts to process');
        return;
      }

      console.log(`📊 [FORECAST WORKER] Processing ${pendingForecasts.length} pending forecasts`);
      
      let processedCount = 0;
      
      for (const forecast of pendingForecasts) {
        try {
          // Get current price for this symbol
          const latestData = await db
            .select({ close: cryptocurrencies.currentPrice })
            .from(cryptocurrencies)
            .where(eq(cryptocurrencies.symbol, forecast.symbol))
            .limit(1);
          
          if (latestData.length > 0 && latestData[0].close) {
            const currentPrice = parseFloat(latestData[0].close);
            const updated = await ForecastPerformanceTracker.updateWithActualOutcome(forecast.id, currentPrice);
            
            if (updated && updated.accuracyScore !== null) {
              processedCount++;
              console.log(`✅ [FORECAST WORKER] Updated forecast ${forecast.id} for ${forecast.symbol}: ${updated.accuracyScore.toFixed(1)}% accuracy`);
              
              // CRITICAL: Feed accuracy back to learning system
              console.log(`🧠 [LEARNING FEEDBACK] Feeding ${updated.accuracyScore.toFixed(1)}% accuracy result to adaptive learning system`);
              this.adaptiveBoldnessManager.updateWithAccuracyResult(updated.accuracyScore);
              
              // Also update forecast learning engine for improving actual predictions
              const { forecastLearningEngine } = await import('./forecast-learning-engine');
              const originalPrice = parseFloat(forecast.originalPrice);
              const predictedPrice = parseFloat(forecast.predictedPrice);
              await forecastLearningEngine.updateFromForecastResult(
                forecast.symbol,
                originalPrice,
                predictedPrice,
                currentPrice
              );
              
              // Log learning system response
              const learningStatus = this.adaptiveBoldnessManager.getStatusSummary();
              console.log(`📊 [LEARNING STATUS] ${learningStatus}`);
            }
          } else {
            console.log(`⚠️ [FORECAST WORKER] No price data available for ${forecast.symbol}`);
          }
        } catch (error) {
          console.error(`❌ [FORECAST WORKER] Error processing forecast ${forecast.id}:`, error);
        }
      }
      
      console.log(`🎯 [FORECAST WORKER] Processed ${processedCount}/${pendingForecasts.length} forecasts successfully`);
      
      // Log current performance metrics
      const metrics = await ForecastPerformanceTracker.getPerformanceMetrics();
      console.log(`📈 [FORECAST WORKER] Current Performance: ${metrics.profitStrength}% profit strength, ${metrics.failureRate}% failure rate (${metrics.totalForecasts} total forecasts)`);
      
    } catch (error) {
      console.error('❌ [FORECAST WORKER] Error in processPendingForecasts:', error);
    }
  }

  /**
   * Get current worker status
   */
  getStatus(): { isRunning: boolean; nextCheck?: string } {
    return {
      isRunning: this.isRunning,
      nextCheck: this.isRunning ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined
    };
  }
}

// Auto-start the worker when the module is imported
const worker = ForecastBackgroundWorker.getInstance();
worker.start();

export default worker;