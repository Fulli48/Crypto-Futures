/**
 * COMPREHENSIVE INDICATOR CORRECTOR
 * 
 * This service immediately corrects all bad technical indicator values in the database
 * using the authoritative technical indicators service. This is a one-time fix script
 * that will run on startup to clean up all existing bad data.
 */

import { pool } from './db';
import { TechnicalIndicatorsService } from './technical-indicators-service';

export class ComprehensiveIndicatorCorrector {
  
  /**
   * Fix all bad technical indicator values across the entire database
   */
  static async fixAllIndicators(): Promise<void> {
    console.log('🚀 [COMPREHENSIVE CORRECTOR] Starting full database correction...');
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
    const totalStartTime = Date.now();
    
    for (const symbol of symbols) {
      try {
        await this.fixSymbolIndicators(symbol);
      } catch (error) {
        console.error(`❌ [COMPREHENSIVE CORRECTOR] Failed to fix ${symbol}: ${error}`);
      }
    }
    
    const totalElapsed = Date.now() - totalStartTime;
    console.log(`✅ [COMPREHENSIVE CORRECTOR] Complete database correction finished in ${totalElapsed}ms`);
  }
  
  /**
   * Fix all indicators for a specific symbol
   */
  private static async fixSymbolIndicators(symbol: string): Promise<void> {
    console.log(`🔧 [COMPREHENSIVE CORRECTOR] Fixing ${symbol} indicators...`);
    
    // Get all records for this symbol from last 7 days (enough to recalculate properly)
    const query = `
      SELECT id, symbol, timestamp, open::float, high::float, low::float, close::float, 
             volume::float, rsi, macd, stochastic_k, stochastic_d
      FROM rolling_chart_data 
      WHERE symbol = $1 
        AND timestamp >= NOW() - INTERVAL '7 days'
      ORDER BY timestamp ASC
    `;
    
    const result = await pool.query(query, [symbol]);
    const records = result.rows;
    
    if (records.length === 0) {
      console.log(`⚠️ [COMPREHENSIVE CORRECTOR] No data found for ${symbol}`);
      return;
    }
    
    console.log(`📊 [COMPREHENSIVE CORRECTOR] Processing ${records.length} records for ${symbol}`);
    
    // Convert to OHLC format for calculations
    const ohlcData = records.map(record => ({
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume,
      timestamp: record.timestamp
    }));
    
    let fixedCount = 0;
    let errorCount = 0;
    
    // Process each record with sufficient historical context
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Use up to 100 historical points for calculation context
        const historicalStart = Math.max(0, i - 99);
        const contextData = ohlcData.slice(historicalStart, i + 1);
        
        // Calculate correct indicators
        const correctIndicators = TechnicalIndicatorsService.calculateAll(contextData, record.close);
        
        // Check if current values are bad and need fixing
        const needsFix = this.needsCorrection(record, correctIndicators);
        
        if (needsFix.length > 0) {
          // Update with correct values
          await this.updateRecord(record.id, correctIndicators);
          fixedCount++;
          
          console.log(`🔧 [COMPREHENSIVE CORRECTOR] Fixed ${symbol} record ${record.id}: ${needsFix.join(', ')}`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ [COMPREHENSIVE CORRECTOR] Error processing ${symbol} record ${record.id}: ${error}`);
      }
    }
    
    console.log(`✅ [COMPREHENSIVE CORRECTOR] ${symbol} complete: ${fixedCount} fixed, ${errorCount} errors`);
  }
  
  /**
   * Check if a record needs correction
   */
  private static needsCorrection(record: any, correctIndicators: any): string[] {
    const issues: string[] = [];
    
    // Check RSI
    if (record.rsi !== null) {
      if (isNaN(record.rsi) || record.rsi < 0 || record.rsi > 100) {
        issues.push('Invalid RSI');
      } else if (record.rsi === 100 && correctIndicators.rsi !== null && correctIndicators.rsi < 99) {
        issues.push('Stuck RSI at 100');
      } else if (record.rsi === 0 && correctIndicators.rsi !== null && correctIndicators.rsi > 1) {
        issues.push('Stuck RSI at 0');
      }
    }
    
    // Check Stochastic K
    if (record.stochastic_k !== null) {
      if (isNaN(record.stochastic_k) || record.stochastic_k < 0 || record.stochastic_k > 100) {
        issues.push('Invalid Stochastic K');
      }
    }
    
    // Check Stochastic D
    if (record.stochastic_d !== null) {
      if (isNaN(record.stochastic_d) || record.stochastic_d < 0 || record.stochastic_d > 100) {
        issues.push('Invalid Stochastic D');
      }
    }
    
    // Check MACD for extreme values
    if (record.macd !== null && (isNaN(record.macd) || Math.abs(record.macd) > record.close * 0.2)) {
      issues.push('Invalid MACD');
    }
    
    return issues;
  }
  
  /**
   * Update a record with correct indicator values
   */
  private static async updateRecord(recordId: number, indicators: any): Promise<void> {
    const updateQuery = `
      UPDATE rolling_chart_data 
      SET 
        rsi = $1,
        macd = $2,
        macd_signal = $3,
        macd_histogram = $4,
        stochastic_k = $5,
        stochastic_d = $6,
        bollinger_upper = $7::text,
        bollinger_middle = $8::text,
        bollinger_lower = $9::text,
        updated_at = NOW()
      WHERE id = $10
    `;

    await pool.query(updateQuery, [
      indicators.rsi,
      indicators.macd,
      indicators.macdSignal,
      indicators.macdHistogram,
      indicators.stochasticK,
      indicators.stochasticD,
      indicators.bollingerUpper?.toString(),
      indicators.bollingerMiddle?.toString(),
      indicators.bollingerLower?.toString(),
      recordId
    ]);
  }
}

// Auto-run on module load to fix database immediately
ComprehensiveIndicatorCorrector.fixAllIndicators().catch(console.error);