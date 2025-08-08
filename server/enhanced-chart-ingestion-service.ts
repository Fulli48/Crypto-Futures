import { db } from './db';
import { rollingChartData } from '@shared/schema';
import { eq, and, sql, desc, asc, count } from 'drizzle-orm';
import { realPriceAPI } from './real-price-api';
import { technicalIndicatorsService } from './technical-indicators-service';

// Simple console logger for development
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.log('[DEBUG]', ...args)
};

/**
 * ENHANCED CHART DATA INGESTION SERVICE
 * 
 * Implements comprehensive data quality, backfill, and indicator rebuild system
 * for the cryptocurrency trading platform's rolling chart data system.
 * 
 * Features:
 * - Database schema migration for source tracking
 * - Strict ingestion with Binance alignment
 * - Intelligent backfill logic
 * - Anomaly detection and cleanup
 * - Automatic technical indicator rebuild
 * - ML forecast learning integration
 */

export class EnhancedChartIngestionService {
  private readonly VOLUME_ANOMALY_MULTIPLIER = 3; // 3x standard deviation threshold
  private readonly SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  
  constructor() {
    // Use existing technical indicators service
  }

  /**
   * DATABASE SCHEMA MIGRATION
   * Adds new columns and constraints for enhanced data quality tracking
   */
  async migrateSchema(): Promise<void> {
    try {
      logger.info('🔄 [MIGRATION] Starting enhanced chart data schema migration');
      
      // Add new columns if they don't exist
      await db.execute(sql`
        ALTER TABLE rolling_chart_data 
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'BINANCE',
        ADD COLUMN IF NOT EXISTS has_missing_data BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT TRUE;
      `);
      
      // Create unique constraint and composite index
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_timestamp 
        ON rolling_chart_data(symbol, timestamp);
      `);
      
      // Create additional performance indexes
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_source_quality 
        ON rolling_chart_data(source, has_missing_data, is_complete);
        
        CREATE INDEX IF NOT EXISTS idx_symbol_timestamp_complete 
        ON rolling_chart_data(symbol, timestamp) 
        WHERE is_complete = true;
      `);
      
      logger.info('✅ [MIGRATION] Enhanced chart data schema migration completed');
    } catch (error) {
      logger.error('❌ [MIGRATION] Schema migration failed:', error);
      throw error;
    }
  }

  /**
   * STRICT INGESTION
   * Aligns to Binance 1-minute close time with intelligent fallback
   */
  async ingestMinute(symbol: string): Promise<void> {
    try {
      // Align to Binance minute close time
      const now = new Date();
      now.setSeconds(0, 0);
      const targetTimestamp = new Date(now.getTime() - 60 * 1000); // Previous complete minute
      
      logger.debug(`🔄 [INGESTION] Processing ${symbol} for ${targetTimestamp.toISOString()}`);
      
      // Check if complete record already exists
      const existing = await db.select()
        .from(rollingChartData)
        .where(and(
          eq(rollingChartData.symbol, symbol),
          eq(rollingChartData.timestamp, targetTimestamp)
        ))
        .limit(1);
      
      if (existing.length > 0 && existing[0].isComplete) {
        logger.debug(`⏭️ [INGESTION] ${symbol} ${targetTimestamp.toISOString()} already complete`);
        return;
      }
      
      // Fetch candle data with intelligent fallback
      let candleData: any;
      let source = 'BINANCE';
      
      try {
        // Primary: Binance data
        candleData = await this.fetchBinanceKline(symbol, targetTimestamp);
      } catch (binanceError) {
        logger.warn(`⚠️ [INGESTION] Binance failed for ${symbol}, trying fallback:`, binanceError);
        
        try {
          // Fallback: Alternative source with volume normalization
          candleData = await this.fetchFallbackKline(symbol, targetTimestamp);
          candleData.volume = this.normalizeFallbackVolume(candleData.volume, symbol);
          source = 'FALLBACK';
        } catch (fallbackError) {
          logger.error(`❌ [INGESTION] All sources failed for ${symbol}:`, fallbackError);
          throw fallbackError;
        }
      }
      
      // Calculate technical indicators immediately
      const indicators = await this.technicalIndicators.calculateIndicators(symbol, candleData);
      
      // Insert with complete data
      const insertData = {
        symbol,
        timestamp: targetTimestamp,
        open: candleData.open.toString(),
        high: candleData.high.toString(),
        low: candleData.low.toString(),
        close: candleData.close.toString(),
        volume: candleData.volume.toString(),
        source,
        isComplete: true,
        hasMissingData: false,
        ...indicators,
        lastDataUpdate: new Date(),
      };
      
      await db.insert(rollingChartData)
        .values(insertData)
        .onConflictDoUpdate({
          target: [rollingChartData.symbol, rollingChartData.timestamp],
          set: insertData
        });
      
      logger.info(`✅ [INGESTION] ${symbol} ingested successfully from ${source}`);
      
    } catch (error) {
      logger.error(`❌ [INGESTION] Failed to ingest ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * BACKFILL LOGIC
   * Only fills missing or incomplete timestamps with Binance data
   */
  async backfillMissingData(symbol: string, startTime: Date, endTime: Date): Promise<void> {
    try {
      logger.info(`🔄 [BACKFILL] Starting backfill for ${symbol} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      // Find missing or incomplete timestamps in the range
      const missingTimestamps = await this.findMissingTimestamps(symbol, startTime, endTime);
      
      if (missingTimestamps.length === 0) {
        logger.info(`✅ [BACKFILL] No missing data for ${symbol} in specified range`);
        return;
      }
      
      logger.info(`📊 [BACKFILL] Found ${missingTimestamps.length} missing timestamps for ${symbol}`);
      
      // Fetch historical data from Binance in batches
      const batchSize = 100; // Binance API limit
      for (let i = 0; i < missingTimestamps.length; i += batchSize) {
        const batch = missingTimestamps.slice(i, i + batchSize);
        const batchStart = batch[0];
        const batchEnd = batch[batch.length - 1];
        
        try {
          const klines = await this.fetchBinanceKlines(symbol, batchStart, batchEnd);
          
          for (const kline of klines) {
            const indicators = await this.technicalIndicators.calculateIndicators(symbol, kline);
            
            const insertData = {
              symbol,
              timestamp: kline.timestamp,
              open: kline.open.toString(),
              high: kline.high.toString(),
              low: kline.low.toString(),
              close: kline.close.toString(),
              volume: kline.volume.toString(),
              source: 'BINANCE_BACKFILL',
              isComplete: true,
              hasMissingData: false,
              ...indicators,
              lastDataUpdate: new Date(),
            };
            
            await db.insert(rollingChartData)
              .values(insertData)
              .onConflictDoUpdate({
                target: [rollingChartData.symbol, rollingChartData.timestamp],
                set: insertData
              });
          }
          
          logger.info(`✅ [BACKFILL] Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingTimestamps.length/batchSize)} for ${symbol}`);
          
        } catch (error) {
          logger.error(`❌ [BACKFILL] Batch failed for ${symbol}:`, error);
          // Continue with next batch
        }
      }
      
      logger.info(`✅ [BACKFILL] Completed backfill for ${symbol}`);
      
    } catch (error) {
      logger.error(`❌ [BACKFILL] Backfill failed for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * ANOMALY DETECTION & DUPLICATE REMOVAL
   * Flags volume anomalies and removes duplicates
   */
  async cleanAndFlagAnomalies(symbol: string): Promise<void> {
    try {
      logger.info(`🧹 [CLEANUP] Starting anomaly detection for ${symbol}`);
      
      // Calculate volume statistics for anomaly detection
      const volumeStats = await db.execute(sql`
        SELECT 
          AVG(CAST(volume AS NUMERIC)) as avg_volume,
          STDDEV(CAST(volume AS NUMERIC)) as stddev_volume
        FROM rolling_chart_data 
        WHERE symbol = ${symbol}
        AND CAST(volume AS NUMERIC) > 0
      `);
      
      const avgVolume = parseFloat(volumeStats[0]?.avg_volume || '0');
      const stddevVolume = parseFloat(volumeStats[0]?.stddev_volume || '0');
      const anomalyThreshold = avgVolume + (this.VOLUME_ANOMALY_MULTIPLIER * stddevVolume);
      
      logger.info(`📊 [CLEANUP] ${symbol} volume stats - Avg: ${avgVolume.toFixed(2)}, StdDev: ${stddevVolume.toFixed(2)}, Threshold: ${anomalyThreshold.toFixed(2)}`);
      
      // Flag volume anomalies
      if (anomalyThreshold > 0) {
        const flaggedCount = await db.execute(sql`
          UPDATE rolling_chart_data
          SET has_missing_data = TRUE,
              updated_at = NOW()
          WHERE symbol = ${symbol}
            AND CAST(volume AS NUMERIC) > ${anomalyThreshold}
            AND has_missing_data = FALSE
        `);
        
        logger.info(`🚩 [CLEANUP] Flagged ${flaggedCount.length} volume anomalies for ${symbol}`);
      }
      
      // Remove exact duplicates (same symbol, timestamp)
      const duplicatesRemoved = await db.execute(sql`
        DELETE FROM rolling_chart_data a
        USING rolling_chart_data b
        WHERE a.id < b.id
          AND a.symbol = b.symbol
          AND a.timestamp = b.timestamp
          AND a.symbol = ${symbol}
      `);
      
      logger.info(`🗑️ [CLEANUP] Removed ${duplicatesRemoved.length} duplicate records for ${symbol}`);
      
      // Get timestamps that need indicator recalculation
      const affectedTimestamps = await db.select({
        timestamp: rollingChartData.timestamp
      })
      .from(rollingChartData)
      .where(and(
        eq(rollingChartData.symbol, symbol),
        eq(rollingChartData.hasMissingData, true)
      ));
      
      // Rebuild indicators for affected timestamps
      if (affectedTimestamps.length > 0) {
        await this.rebuildIndicators(symbol, affectedTimestamps.map(row => row.timestamp));
      }
      
      logger.info(`✅ [CLEANUP] Completed anomaly cleanup for ${symbol}`);
      
    } catch (error) {
      logger.error(`❌ [CLEANUP] Anomaly cleanup failed for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * AUTOMATIC TECHNICAL INDICATOR REBUILD
   * Recalculates indicators for specific timestamps
   */
  async rebuildIndicators(symbol: string, timestamps: Date[]): Promise<void> {
    try {
      logger.info(`🔧 [REBUILD] Rebuilding indicators for ${symbol} - ${timestamps.length} timestamps`);
      
      for (const timestamp of timestamps) {
        try {
          // Get the row data
          const row = await db.select()
            .from(rollingChartData)
            .where(and(
              eq(rollingChartData.symbol, symbol),
              eq(rollingChartData.timestamp, timestamp)
            ))
            .limit(1);
          
          if (row.length === 0) {
            logger.warn(`⚠️ [REBUILD] No data found for ${symbol} at ${timestamp.toISOString()}`);
            continue;
          }
          
          const ohlcvData = {
            open: parseFloat(row[0].open),
            high: parseFloat(row[0].high),
            low: parseFloat(row[0].low),
            close: parseFloat(row[0].close),
            volume: parseFloat(row[0].volume),
            timestamp
          };
          
          // Recalculate indicators
          const indicators = await this.technicalIndicators.calculateIndicators(symbol, ohlcvData);
          
          // Update the row
          await db.update(rollingChartData)
            .set({
              ...indicators,
              isComplete: true,
              hasMissingData: false,
              lastDataUpdate: new Date(),
              updatedAt: new Date()
            })
            .where(and(
              eq(rollingChartData.symbol, symbol),
              eq(rollingChartData.timestamp, timestamp)
            ));
          
          logger.debug(`✅ [REBUILD] Rebuilt indicators for ${symbol} at ${timestamp.toISOString()}`);
          
        } catch (error) {
          logger.error(`❌ [REBUILD] Failed to rebuild indicators for ${symbol} at ${timestamp.toISOString()}:`, error);
          // Continue with next timestamp
        }
      }
      
      logger.info(`✅ [REBUILD] Completed indicator rebuild for ${symbol}`);
      
    } catch (error) {
      logger.error(`❌ [REBUILD] Indicator rebuild failed for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * ML FORECAST LEARNING INTEGRATION
   * Provides clean data for ML training and triggers retraining when needed
   */
  async getMLTrainingData(symbol: string, limit: number = 600): Promise<any[]> {
    try {
      // Get clean, complete data for ML training
      const trainingData = await db.select()
        .from(rollingChartData)
        .where(and(
          eq(rollingChartData.symbol, symbol),
          eq(rollingChartData.hasMissingData, false),
          eq(rollingChartData.isComplete, true)
        ))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(limit);
      
      logger.info(`📊 [ML DATA] Retrieved ${trainingData.length} clean records for ${symbol} ML training`);
      
      // Check if significant backfill occurred (>5% of dataset replaced)
      const backfillCount = trainingData.filter(row => row.source === 'BINANCE_BACKFILL').length;
      const backfillPercentage = (backfillCount / trainingData.length) * 100;
      
      if (backfillPercentage > 5) {
        logger.warn(`⚠️ [ML DATA] High backfill rate (${backfillPercentage.toFixed(1)}%) detected for ${symbol} - consider model retraining`);
        // Trigger retraining notification (implement as needed)
        this.triggerModelRetraining(symbol, backfillPercentage);
      }
      
      return trainingData.map(row => ({
        ...row,
        source: row.source, // Include source for ML model to detect bias
      }));
      
    } catch (error) {
      logger.error(`❌ [ML DATA] Failed to get training data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * SCHEDULED OPERATIONS
   * Manages periodic ingestion, backfill, and cleanup
   */
  async startScheduledOperations(): Promise<void> {
    logger.info('🚀 [SCHEDULER] Starting enhanced chart data operations');
    
    // Ingest current minute every 60 seconds
    setInterval(async () => {
      for (const symbol of this.SUPPORTED_SYMBOLS) {
        try {
          await this.ingestMinute(symbol);
        } catch (error) {
          logger.error(`❌ [SCHEDULER] Ingestion failed for ${symbol}:`, error);
        }
      }
    }, 60 * 1000); // Every minute
    
    // Backfill missing data every hour
    setInterval(async () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 2 * 60 * 60 * 1000); // Last 2 hours
      
      for (const symbol of this.SUPPORTED_SYMBOLS) {
        try {
          await this.backfillMissingData(symbol, startTime, endTime);
        } catch (error) {
          logger.error(`❌ [SCHEDULER] Backfill failed for ${symbol}:`, error);
        }
      }
    }, 60 * 60 * 1000); // Every hour
    
    // Clean and flag anomalies daily
    setInterval(async () => {
      for (const symbol of this.SUPPORTED_SYMBOLS) {
        try {
          await this.cleanAndFlagAnomalies(symbol);
        } catch (error) {
          logger.error(`❌ [SCHEDULER] Cleanup failed for ${symbol}:`, error);
        }
      }
    }, 24 * 60 * 60 * 1000); // Daily
    
    logger.info('✅ [SCHEDULER] Enhanced chart data operations started');
  }

  // Private helper methods
  
  private async fetchBinanceKline(symbol: string, timestamp: Date): Promise<any> {
    // Use existing realPriceAPI with error handling
    const result = await realPriceAPI.fetchOHLCVData([symbol], 1);
    if (!result || result.length === 0) {
      throw new Error(`No Binance data available for ${symbol}`);
    }
    return result[0];
  }
  
  private async fetchFallbackKline(symbol: string, timestamp: Date): Promise<any> {
    // Implement fallback API calls (CoinCap, etc.)
    throw new Error('Fallback API not implemented yet');
  }
  
  private normalizeFallbackVolume(volume: number, symbol: string): number {
    // Normalize volume to Binance base asset units
    // This would need symbol-specific conversion factors
    return volume;
  }
  
  private async fetchBinanceKlines(symbol: string, startTime: Date, endTime: Date): Promise<any[]> {
    // Fetch multiple klines for backfill
    const results = await realPriceAPI.fetchOHLCVData([symbol], Math.ceil((endTime.getTime() - startTime.getTime()) / (60 * 1000)));
    return results || [];
  }
  
  private async findMissingTimestamps(symbol: string, startTime: Date, endTime: Date): Promise<Date[]> {
    // Generate expected timestamps and find missing ones
    const expectedTimestamps: Date[] = [];
    const current = new Date(startTime);
    
    while (current <= endTime) {
      expectedTimestamps.push(new Date(current));
      current.setMinutes(current.getMinutes() + 1);
    }
    
    // Check which timestamps are missing or incomplete
    const existing = await db.select({
      timestamp: rollingChartData.timestamp
    })
    .from(rollingChartData)
    .where(and(
      eq(rollingChartData.symbol, symbol),
      sql`${rollingChartData.timestamp} BETWEEN ${startTime} AND ${endTime}`,
      eq(rollingChartData.isComplete, true)
    ));
    
    const existingTimes = new Set(existing.map(row => row.timestamp.getTime()));
    
    return expectedTimestamps.filter(ts => !existingTimes.has(ts.getTime()));
  }
  
  private async triggerModelRetraining(symbol: string, backfillPercentage: number): Promise<void> {
    // Implement model retraining trigger logic
    logger.info(`🤖 [RETRAINING] Triggered for ${symbol} due to ${backfillPercentage.toFixed(1)}% backfill`);
    // This would integrate with the ML training system
  }

  /**
   * QUALITY METRICS METHODS
   * Enhanced data quality and monitoring endpoints
   */
  async getOverview(): Promise<any> {
    try {
      const symbols = this.SUPPORTED_SYMBOLS;
      const overview = {
        totalSymbols: symbols.length,
        healthySymbols: 0,
        warningSymbols: 0,
        criticalSymbols: 0,
        symbols: [] as any[]
      };

      for (const symbol of symbols) {
        const stats = await this.getSymbolQualityMetrics(symbol);
        overview.symbols.push({
          symbol,
          completeness: stats.completeness,
          quality: stats.qualityScore,
          status: stats.status,
          lastUpdate: stats.lastUpdate
        });

        if (stats.status === 'healthy') overview.healthySymbols++;
        else if (stats.status === 'warning') overview.warningSymbols++;
        else overview.criticalSymbols++;
      }

      return overview;
    } catch (error) {
      logger.error('❌ [QUALITY METRICS] Failed to get overview:', error);
      throw error;
    }
  }

  async getQualityMetrics(): Promise<any> {
    try {
      const symbols = this.SUPPORTED_SYMBOLS;
      const metrics = [];

      for (const symbol of symbols) {
        const stats = await this.getSymbolQualityMetrics(symbol);
        metrics.push(stats);
      }

      return { symbols: metrics, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ [QUALITY METRICS] Failed to get quality metrics:', error);
      throw error;
    }
  }

  async getBackfillStatus(): Promise<any> {
    try {
      const symbols = this.SUPPORTED_SYMBOLS;
      const backfillStatus = [];

      for (const symbol of symbols) {
        const gaps = await this.detectGaps(symbol);
        backfillStatus.push({
          symbol,
          gapsDetected: gaps.length,
          needsBackfill: gaps.length > 0,
          lastGap: gaps.length > 0 ? gaps[gaps.length - 1] : null
        });
      }

      return { symbols: backfillStatus, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ [BACKFILL STATUS] Failed to get status:', error);
      throw error;
    }
  }

  async getValidationResults(): Promise<any> {
    try {
      const symbols = this.SUPPORTED_SYMBOLS;
      const validationResults = [];

      for (const symbol of symbols) {
        const recent = await db.select()
          .from(rollingChartData)
          .where(eq(rollingChartData.symbol, symbol))
          .orderBy(desc(rollingChartData.timestamp))
          .limit(100);

        const incomplete = recent.filter(r => !r.isComplete || r.hasMissingData);
        const total = recent.length;

        validationResults.push({
          symbol,
          totalRecords: total,
          validRecords: total - incomplete.length,
          invalidRecords: incomplete.length,
          validationRate: total > 0 ? ((total - incomplete.length) / total * 100) : 0,
          issues: incomplete.slice(0, 5).map(r => ({
            timestamp: r.timestamp,
            issues: r.hasMissingData ? ['missing_data'] : ['incomplete']
          }))
        });
      }

      return { symbols: validationResults, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ [VALIDATION] Failed to get validation results:', error);
      throw error;
    }
  }

  async detectGaps(symbol: string): Promise<any[]> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours
      
      const records = await db.select({
        timestamp: rollingChartData.timestamp,
        isComplete: rollingChartData.isComplete
      })
      .from(rollingChartData)
      .where(and(
        eq(rollingChartData.symbol, symbol),
        sql`${rollingChartData.timestamp} BETWEEN ${startTime} AND ${endTime}`
      ))
      .orderBy(asc(rollingChartData.timestamp));

      const gaps: any[] = [];
      let current = new Date(startTime);
      let recordIndex = 0;

      while (current <= endTime) {
        const currentTime = current.getTime();
        
        // Check if we have a record for this timestamp
        if (recordIndex < records.length && 
            records[recordIndex].timestamp.getTime() === currentTime &&
            records[recordIndex].isComplete) {
          recordIndex++;
        } else {
          // Found a gap - find the end of this gap
          const gapStart = new Date(current);
          while (current <= endTime && 
                 (recordIndex >= records.length || 
                  records[recordIndex].timestamp.getTime() !== current.getTime() ||
                  !records[recordIndex].isComplete)) {
            current.setMinutes(current.getMinutes() + 1);
          }
          const gapEnd = new Date(current.getTime() - 60 * 1000); // Previous minute
          
          gaps.push({
            start: gapStart,
            end: gapEnd,
            duration: Math.floor((gapEnd.getTime() - gapStart.getTime()) / (60 * 1000)) + 1
          });
          
          continue; // Don't increment current again
        }
        
        current.setMinutes(current.getMinutes() + 1);
      }

      return gaps;
    } catch (error) {
      logger.error(`❌ [GAP DETECTION] Failed for ${symbol}:`, error);
      return [];
    }
  }

  private async getSymbolQualityMetrics(symbol: string): Promise<any> {
    try {
      const recent = await db.select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(desc(rollingChartData.timestamp))
        .limit(600); // Last 10 hours

      const total = recent.length;
      const complete = recent.filter(r => r.isComplete && !r.hasMissingData).length;
      const completeness = total > 0 ? (complete / total * 100) : 0;

      let status = 'healthy';
      if (completeness < 70) status = 'critical';
      else if (completeness < 90) status = 'warning';

      return {
        symbol,
        totalRecords: total,
        completeRecords: complete,
        completeness: Math.round(completeness * 10) / 10,
        qualityScore: Math.round(completeness),
        status,
        lastUpdate: recent.length > 0 ? recent[0].timestamp : null,
        gaps: await this.detectGaps(symbol)
      };
    } catch (error) {
      logger.error(`❌ [QUALITY METRICS] Failed for ${symbol}:`, error);
      return {
        symbol,
        totalRecords: 0,
        completeRecords: 0,
        completeness: 0,
        qualityScore: 0,
        status: 'critical',
        lastUpdate: null,
        gaps: []
      };
    }
  }
}

// Export singleton instance
export const enhancedChartIngestion = new EnhancedChartIngestionService();