import { db } from './db';
import { rollingChartData } from '@shared/schema';
import { eq, and, sql, desc, lt, gt } from 'drizzle-orm';

/**
 * ENHANCED FORECAST LEARNER
 * 
 * Leverages the new enhanced chart data system for improved ML training
 * with comprehensive data quality tracking and validation.
 */

export class EnhancedForecastLearner {
  private readonly MIN_TRAINING_POINTS = 100;
  private readonly SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];

  /**
   * Get high-quality training data with source tracking
   */
  async getTrainingDataWithQuality(symbol: string, limit: number = 600): Promise<{
    data: any[];
    qualityMetrics: {
      totalPoints: number;
      binancePoints: number;
      completePoints: number;
      qualityScore: number;
      dataSourceBreakdown: Record<string, number>;
    };
  }> {
    try {
      // Get the latest clean data points
      const rawData = await db.select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(limit);

      if (rawData.length === 0) {
        return {
          data: [],
          qualityMetrics: {
            totalPoints: 0,
            binancePoints: 0,
            completePoints: 0,
            qualityScore: 0,
            dataSourceBreakdown: {}
          }
        };
      }

      // Analyze data quality
      const totalPoints = rawData.length;
      const binancePoints = rawData.filter(row => row.source === 'BINANCE').length;
      const completePoints = rawData.filter(row => 
        row.isComplete && 
        !row.hasMissingData &&
        row.rsi !== null &&
        row.macd !== null &&
        parseFloat(row.volume) > 0
      ).length;

      // Calculate source breakdown
      const dataSourceBreakdown: Record<string, number> = {};
      rawData.forEach(row => {
        const source = row.source || 'UNKNOWN';
        dataSourceBreakdown[source] = (dataSourceBreakdown[source] || 0) + 1;
      });

      // Calculate quality score (0-100)
      const binanceRatio = binancePoints / totalPoints;
      const completenessRatio = completePoints / totalPoints;
      const qualityScore = Math.round((binanceRatio * 0.6 + completenessRatio * 0.4) * 100);

      // Filter data for training (only use high-quality points)
      const trainingData = rawData.filter(row => 
        row.isComplete && 
        !row.hasMissingData &&
        (row.source === 'BINANCE' || row.source === 'BINANCE_BACKFILL')
      ).map(row => ({
        timestamp: row.timestamp,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        rsi: row.rsi,
        macd: row.macd,
        macdSignal: row.macdSignal,
        macdHistogram: row.macdHistogram,
        bollingerUpper: parseFloat(row.bollingerUpper || '0'),
        bollingerMiddle: parseFloat(row.bollingerMiddle || '0'),
        bollingerLower: parseFloat(row.bollingerLower || '0'),
        stochasticK: row.stochasticK,
        stochasticD: row.stochasticD,
        realizedVolatility: row.realizedVolatility,
        volatility5min: row.volatility5min,
        volatility15min: row.volatility15min,
        volatility60min: row.volatility60min,
        source: row.source, // Include for bias detection
      }));

      return {
        data: trainingData,
        qualityMetrics: {
          totalPoints,
          binancePoints,
          completePoints,
          qualityScore,
          dataSourceBreakdown
        }
      };

    } catch (error) {
      console.error(`❌ [ENHANCED LEARNER] Failed to get training data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Check if symbol has sufficient quality data for training
   */
  async checkTrainingReadiness(symbol: string): Promise<{
    isReady: boolean;
    pointsAvailable: number;
    qualityScore: number;
    recommendations: string[];
  }> {
    try {
      const { data, qualityMetrics } = await this.getTrainingDataWithQuality(symbol, this.MIN_TRAINING_POINTS);
      
      const recommendations: string[] = [];
      const isReady = data.length >= this.MIN_TRAINING_POINTS && qualityMetrics.qualityScore >= 70;

      if (data.length < this.MIN_TRAINING_POINTS) {
        recommendations.push(`Need ${this.MIN_TRAINING_POINTS - data.length} more data points`);
      }

      if (qualityMetrics.qualityScore < 70) {
        recommendations.push(`Quality score too low (${qualityMetrics.qualityScore}% < 70%)`);
      }

      if (qualityMetrics.binancePoints / qualityMetrics.totalPoints < 0.8) {
        recommendations.push('Consider running backfill for more Binance data');
      }

      if (qualityMetrics.completePoints / qualityMetrics.totalPoints < 0.9) {
        recommendations.push('Some data points missing technical indicators');
      }

      return {
        isReady,
        pointsAvailable: data.length,
        qualityScore: qualityMetrics.qualityScore,
        recommendations
      };

    } catch (error) {
      console.error(`❌ [ENHANCED LEARNER] Failed to check training readiness for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Detect data gaps and recommend backfill
   */
  async detectDataGaps(symbol: string, hours: number = 24): Promise<{
    gapsFound: number;
    missingTimestamps: Date[];
    backfillRecommendation: string;
  }> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

      // Generate expected timestamps (every minute)
      const expectedTimestamps: Date[] = [];
      const current = new Date(startTime);
      current.setSeconds(0, 0);

      while (current <= endTime) {
        expectedTimestamps.push(new Date(current));
        current.setMinutes(current.getMinutes() + 1);
      }

      // Get existing timestamps
      const existing = await db.select({
        timestamp: rollingChartData.timestamp
      })
      .from(rollingChartData)
      .where(and(
        eq(rollingChartData.symbol, symbol),
        gt(rollingChartData.timestamp, startTime),
        lt(rollingChartData.timestamp, endTime)
      ));

      const existingTimes = new Set(existing.map(row => row.timestamp.getTime()));
      const missingTimestamps = expectedTimestamps.filter(ts => !existingTimes.has(ts.getTime()));

      const gapsFound = missingTimestamps.length;
      const completenessRatio = ((expectedTimestamps.length - gapsFound) / expectedTimestamps.length) * 100;

      let backfillRecommendation = '';
      if (gapsFound > 0) {
        if (completenessRatio < 80) {
          backfillRecommendation = 'HIGH PRIORITY: Significant data gaps detected, immediate backfill recommended';
        } else if (completenessRatio < 95) {
          backfillRecommendation = 'MEDIUM PRIORITY: Some gaps detected, backfill recommended';
        } else {
          backfillRecommendation = 'LOW PRIORITY: Minor gaps, backfill optional';
        }
      } else {
        backfillRecommendation = 'No gaps detected, data is complete';
      }

      return {
        gapsFound,
        missingTimestamps: missingTimestamps.slice(0, 10), // Return first 10 for display
        backfillRecommendation
      };

    } catch (error) {
      console.error(`❌ [ENHANCED LEARNER] Failed to detect gaps for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive data quality report
   */
  async getDataQualityReport(): Promise<{
    symbolReports: Record<string, any>;
    overallScore: number;
    recommendations: string[];
  }> {
    try {
      const symbolReports: Record<string, any> = {};
      let totalScore = 0;
      const recommendations: string[] = [];

      for (const symbol of this.SUPPORTED_SYMBOLS) {
        try {
          const { data, qualityMetrics } = await this.getTrainingDataWithQuality(symbol, 600);
          const readiness = await this.checkTrainingReadiness(symbol);
          const gaps = await this.detectDataGaps(symbol, 24);

          symbolReports[symbol] = {
            dataPoints: qualityMetrics.totalPoints,
            qualityScore: qualityMetrics.qualityScore,
            trainingReady: readiness.isReady,
            gapsFound: gaps.gapsFound,
            sourceBreakdown: qualityMetrics.dataSourceBreakdown,
            recommendations: readiness.recommendations
          };

          totalScore += qualityMetrics.qualityScore;

          if (!readiness.isReady) {
            recommendations.push(`${symbol}: ${readiness.recommendations.join(', ')}`);
          }

        } catch (error) {
          console.error(`❌ [ENHANCED LEARNER] Failed to generate report for ${symbol}:`, error);
          symbolReports[symbol] = {
            error: 'Failed to generate report',
            qualityScore: 0
          };
        }
      }

      const overallScore = Math.round(totalScore / this.SUPPORTED_SYMBOLS.length);

      if (overallScore < 70) {
        recommendations.unshift('SYSTEM: Overall data quality below 70%, consider comprehensive backfill');
      }

      return {
        symbolReports,
        overallScore,
        recommendations
      };

    } catch (error) {
      console.error('❌ [ENHANCED LEARNER] Failed to generate quality report:', error);
      throw error;
    }
  }

  /**
   * Trigger model retraining if significant data changes detected
   */
  async checkForRetrainingNeeds(symbol: string): Promise<{
    retrainingNeeded: boolean;
    reason: string;
    dataChangePercentage: number;
  }> {
    try {
      // Get recent data (last hour)
      const recentData = await db.select()
        .from(rollingChartData)
        .where(and(
          eq(rollingChartData.symbol, symbol),
          gt(rollingChartData.timestamp, new Date(Date.now() - 60 * 60 * 1000))
        ));

      // Check for significant backfill activity
      const backfillCount = recentData.filter(row => row.source === 'BINANCE_BACKFILL').length;
      const totalCount = recentData.length;
      const backfillPercentage = totalCount > 0 ? (backfillCount / totalCount) * 100 : 0;

      let retrainingNeeded = false;
      let reason = 'No significant changes detected';

      if (backfillPercentage > 10) {
        retrainingNeeded = true;
        reason = `High backfill activity: ${backfillPercentage.toFixed(1)}% of recent data was backfilled`;
      } else if (backfillPercentage > 5) {
        retrainingNeeded = true;
        reason = `Moderate backfill activity: ${backfillPercentage.toFixed(1)}% of recent data was backfilled`;
      }

      return {
        retrainingNeeded,
        reason,
        dataChangePercentage: backfillPercentage
      };

    } catch (error) {
      console.error(`❌ [ENHANCED LEARNER] Failed to check retraining needs for ${symbol}:`, error);
      return {
        retrainingNeeded: false,
        reason: 'Error checking retraining needs',
        dataChangePercentage: 0
      };
    }
  }
}

// Export singleton instance
export const enhancedForecastLearner = new EnhancedForecastLearner();