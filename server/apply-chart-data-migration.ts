import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * IMMEDIATE DATABASE MIGRATION APPLICATION
 * 
 * Applies the enhanced chart data system database changes immediately
 * to resolve the "source column does not exist" error.
 */

export async function applyChartDataMigration(): Promise<void> {
  try {
    console.log('🚀 [MIGRATION] Applying enhanced chart data schema changes...');
    
    // Add the source column that's causing the error
    await db.execute(sql`
      ALTER TABLE rolling_chart_data 
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'BINANCE';
    `);
    
    console.log('✅ [MIGRATION] Source column added successfully');
    
    // Update existing records to have the BINANCE source
    await db.execute(sql`
      UPDATE rolling_chart_data 
      SET source = 'BINANCE'
      WHERE source IS NULL;
    `);
    
    console.log('✅ [MIGRATION] Existing records updated with source = BINANCE');
    
    // Create the unique index for better performance
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rolling_chart_symbol_timestamp_v2 
      ON rolling_chart_data(symbol, timestamp);
    `);
    
    console.log('✅ [MIGRATION] Performance index created');
    
    // Verify the migration
    const testResult = await db.execute(sql`
      SELECT source, COUNT(*) as count
      FROM rolling_chart_data 
      GROUP BY source
      LIMIT 5;
    `);
    
    console.log('📊 [MIGRATION] Source distribution:', testResult);
    console.log('✅ [MIGRATION] Enhanced chart data migration completed successfully');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Migration failed:', error);
    throw error;
  }
}

// Export for integration
export { applyChartDataMigration };