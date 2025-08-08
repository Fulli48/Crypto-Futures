import { db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './logging-service';

/**
 * DATABASE MIGRATION SERVICE
 * 
 * Handles database schema migrations for the enhanced chart data system.
 * Ensures proper database structure with indexes and constraints.
 */

export class DatabaseMigrationService {
  
  /**
   * Run all necessary migrations for enhanced chart data system
   */
  async runEnhancedChartDataMigrations(): Promise<void> {
    try {
      logger.info('🚀 [MIGRATION] Starting enhanced chart data migrations');
      
      await this.addSourceTrackingColumns();
      await this.createIndexesAndConstraints();
      await this.updateExistingDataDefaults();
      
      logger.info('✅ [MIGRATION] All enhanced chart data migrations completed successfully');
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Migration failed:', error);
      throw error;
    }
  }
  
  /**
   * Add source tracking and quality columns
   */
  private async addSourceTrackingColumns(): Promise<void> {
    try {
      logger.info('🔄 [MIGRATION] Adding source tracking columns...');
      
      // Add new columns if they don't exist
      await db.execute(sql`
        ALTER TABLE rolling_chart_data 
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'BINANCE';
      `);
      
      // Ensure has_missing_data and is_complete columns exist with proper defaults
      await db.execute(sql`
        ALTER TABLE rolling_chart_data 
        ALTER COLUMN has_missing_data SET DEFAULT FALSE,
        ALTER COLUMN is_complete SET DEFAULT TRUE;
      `);
      
      logger.info('✅ [MIGRATION] Source tracking columns added');
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Failed to add source tracking columns:', error);
      throw error;
    }
  }
  
  /**
   * Create performance indexes and constraints
   */
  private async createIndexesAndConstraints(): Promise<void> {
    try {
      logger.info('🔄 [MIGRATION] Creating indexes and constraints...');
      
      // Create unique constraint on symbol + timestamp (handle existing duplicates first)
      await db.execute(sql`
        -- Remove exact duplicates before creating unique constraint
        DELETE FROM rolling_chart_data a
        USING rolling_chart_data b
        WHERE a.id < b.id
          AND a.symbol = b.symbol
          AND a.timestamp = b.timestamp;
      `);
      
      // Create unique index on symbol + timestamp
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_rolling_chart_symbol_timestamp 
        ON rolling_chart_data(symbol, timestamp);
      `);
      
      // Create performance indexes
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_rolling_chart_source_quality 
        ON rolling_chart_data(source, has_missing_data, is_complete);
      `);
      
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_rolling_chart_symbol_timestamp_complete 
        ON rolling_chart_data(symbol, timestamp) 
        WHERE is_complete = true AND has_missing_data = false;
      `);
      
      // Create index for ML data retrieval
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_rolling_chart_ml_training 
        ON rolling_chart_data(symbol, timestamp DESC) 
        WHERE is_complete = true AND has_missing_data = false;
      `);
      
      // Create index for volume anomaly detection
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_rolling_chart_volume_analysis 
        ON rolling_chart_data(symbol, volume) 
        WHERE CAST(volume AS NUMERIC) > 0;
      `);
      
      logger.info('✅ [MIGRATION] Indexes and constraints created');
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Failed to create indexes and constraints:', error);
      throw error;
    }
  }
  
  /**
   * Update existing data with proper defaults
   */
  private async updateExistingDataDefaults(): Promise<void> {
    try {
      logger.info('🔄 [MIGRATION] Updating existing data defaults...');
      
      // Set default source for existing records
      const updatedSourceCount = await db.execute(sql`
        UPDATE rolling_chart_data 
        SET source = 'BINANCE'
        WHERE source IS NULL;
      `);
      
      // Set default quality flags for existing records
      const updatedQualityCount = await db.execute(sql`
        UPDATE rolling_chart_data 
        SET 
          has_missing_data = CASE 
            WHEN rsi IS NULL OR macd IS NULL OR volume = '0' THEN TRUE 
            ELSE FALSE 
          END,
          is_complete = CASE 
            WHEN rsi IS NOT NULL AND macd IS NOT NULL AND volume != '0' THEN TRUE 
            ELSE FALSE 
          END
        WHERE has_missing_data IS NULL OR is_complete IS NULL;
      `);
      
      logger.info(`✅ [MIGRATION] Updated defaults - Source: ${updatedSourceCount.length} records, Quality: ${updatedQualityCount.length} records`);
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Failed to update existing data defaults:', error);
      throw error;
    }
  }
  
  /**
   * Check migration status and data quality
   */
  async checkMigrationStatus(): Promise<{
    migrationsComplete: boolean;
    dataQualityStats: any;
    indexesCreated: boolean;
  }> {
    try {
      // Check if new columns exist
      const columnsCheck = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'rolling_chart_data' 
        AND column_name IN ('source', 'has_missing_data', 'is_complete');
      `);
      
      const hasRequiredColumns = columnsCheck.length >= 3;
      
      // Check if indexes exist
      const indexesCheck = await db.execute(sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'rolling_chart_data' 
        AND indexname LIKE 'idx_rolling_chart_%';
      `);
      
      const hasRequiredIndexes = indexesCheck.length >= 4;
      
      // Get data quality statistics
      const qualityStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN source = 'BINANCE' THEN 1 END) as binance_records,
          COUNT(CASE WHEN source = 'FALLBACK' THEN 1 END) as fallback_records,
          COUNT(CASE WHEN source = 'BINANCE_BACKFILL' THEN 1 END) as backfill_records,
          COUNT(CASE WHEN is_complete = true THEN 1 END) as complete_records,
          COUNT(CASE WHEN has_missing_data = true THEN 1 END) as flagged_records,
          ROUND(AVG(CASE WHEN is_complete = true THEN 100.0 ELSE 0.0 END), 2) as completion_percentage
        FROM rolling_chart_data;
      `);
      
      const stats = qualityStats[0] || {};
      
      return {
        migrationsComplete: hasRequiredColumns,
        indexesCreated: hasRequiredIndexes,
        dataQualityStats: {
          totalRecords: parseInt(stats.total_records || '0'),
          binanceRecords: parseInt(stats.binance_records || '0'),
          fallbackRecords: parseInt(stats.fallback_records || '0'),
          backfillRecords: parseInt(stats.backfill_records || '0'),
          completeRecords: parseInt(stats.complete_records || '0'),
          flaggedRecords: parseInt(stats.flagged_records || '0'),
          completionPercentage: parseFloat(stats.completion_percentage || '0')
        }
      };
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Failed to check migration status:', error);
      throw error;
    }
  }
  
  /**
   * Rollback migrations (if needed)
   */
  async rollbackMigrations(): Promise<void> {
    try {
      logger.warn('🔄 [MIGRATION] Rolling back enhanced chart data migrations...');
      
      // Drop indexes
      await db.execute(sql`
        DROP INDEX IF EXISTS idx_rolling_chart_symbol_timestamp;
        DROP INDEX IF EXISTS idx_rolling_chart_source_quality;
        DROP INDEX IF EXISTS idx_rolling_chart_symbol_timestamp_complete;
        DROP INDEX IF EXISTS idx_rolling_chart_ml_training;
        DROP INDEX IF EXISTS idx_rolling_chart_volume_analysis;
      `);
      
      // Remove columns (only if safe to do so)
      await db.execute(sql`
        ALTER TABLE rolling_chart_data 
        DROP COLUMN IF EXISTS source;
      `);
      
      logger.warn('⚠️ [MIGRATION] Rollback completed');
      
    } catch (error) {
      logger.error('❌ [MIGRATION] Rollback failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const databaseMigration = new DatabaseMigrationService();