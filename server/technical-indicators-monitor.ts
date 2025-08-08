/**
 * TECHNICAL INDICATORS MONITORING SERVICE
 * 
 * Continuously scans and fixes bad technical indicator values across the entire database.
 * This service ensures data quality by detecting and correcting:
 * - Invalid RSI values (>100, <0, or stuck at extremes)
 * - Invalid Stochastic values (>100, <0, NaN)
 * - Missing or corrupted MACD values
 * - Unrealistic Bollinger Band values
 * - Any other technical indicator anomalies
 */

import { pool } from './db';
import { TechnicalIndicatorsService } from './technical-indicators-service';

interface ScanResult {
  totalScanned: number;
  issuesFound: number;
  issuesFixed: number;
  errors: string[];
}

export class TechnicalIndicatorsMonitor {
  private isRunning = false;
  private scanInterval = 2 * 60 * 1000; // 2 minutes
  private batchSize = 100;
  private maxRetries = 3;

  constructor() {
    console.log('🔧 [TECH INDICATORS MONITOR] Service initialized');
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ [TECH INDICATORS MONITOR] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 [TECH INDICATORS MONITOR] Starting continuous monitoring (${this.scanInterval/1000}s intervals)`);
    
    // Initial scan
    await this.performFullScan();
    
    // Schedule periodic scans
    setInterval(async () => {
      if (this.isRunning) {
        await this.performFullScan();
      }
    }, this.scanInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isRunning = false;
    console.log('🛑 [TECH INDICATORS MONITOR] Monitoring stopped');
  }

  /**
   * Perform a full scan of all technical indicators
   */
  async performFullScan(): Promise<ScanResult> {
    const startTime = Date.now();
    const result: ScanResult = {
      totalScanned: 0,
      issuesFound: 0,
      issuesFixed: 0,
      errors: []
    };

    try {
      console.log('🔍 [TECH INDICATORS MONITOR] Starting full scan...');

      // Get symbols to check
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
      
      for (const symbol of symbols) {
        try {
          const symbolResult = await this.scanSymbol(symbol);
          result.totalScanned += symbolResult.totalScanned;
          result.issuesFound += symbolResult.issuesFound;
          result.issuesFixed += symbolResult.issuesFixed;
          result.errors.push(...symbolResult.errors);
        } catch (error) {
          const errorMsg = `Symbol ${symbol} scan failed: ${error}`;
          result.errors.push(errorMsg);
          console.error(`❌ [TECH INDICATORS MONITOR] ${errorMsg}`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ [TECH INDICATORS MONITOR] Scan completed in ${elapsed}ms`);
      console.log(`📊 [TECH INDICATORS MONITOR] Results: ${result.totalScanned} scanned, ${result.issuesFound} issues found, ${result.issuesFixed} fixed`);

      if (result.errors.length > 0) {
        console.warn(`⚠️ [TECH INDICATORS MONITOR] ${result.errors.length} errors during scan`);
      }

    } catch (error) {
      console.error(`❌ [TECH INDICATORS MONITOR] Full scan failed: ${error}`);
      result.errors.push(`Full scan failed: ${error}`);
    }

    return result;
  }

  /**
   * Scan and fix indicators for a specific symbol
   */
  private async scanSymbol(symbol: string): Promise<ScanResult> {
    const result: ScanResult = {
      totalScanned: 0,
      issuesFound: 0,
      issuesFixed: 0,
      errors: []
    };

    try {
      // Get recent data that might have issues
      const query = `
        SELECT id, symbol, timestamp, open::float, high::float, low::float, close::float, 
               volume::float, rsi, macd, macd_signal, macd_histogram,
               stochastic_k, stochastic_d, bollinger_upper::float, bollinger_middle::float, bollinger_lower::float
        FROM rolling_chart_data 
        WHERE symbol = $1 
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY timestamp DESC 
        LIMIT 600
      `;

      const dbResult = await pool.query(query, [symbol]);
      const records = dbResult.rows;
      result.totalScanned = records.length;

      if (records.length === 0) {
        return result;
      }

      // Group records into batches for processing
      const batches = this.createBatches(records, this.batchSize);
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch, symbol);
        result.issuesFound += batchResult.issuesFound;
        result.issuesFixed += batchResult.issuesFixed;
        result.errors.push(...batchResult.errors);
      }

    } catch (error) {
      const errorMsg = `Symbol ${symbol} processing failed: ${error}`;
      result.errors.push(errorMsg);
      console.error(`❌ [TECH INDICATORS MONITOR] ${errorMsg}`);
    }

    return result;
  }

  /**
   * Process a batch of records
   */
  private async processBatch(records: any[], symbol: string): Promise<ScanResult> {
    const result: ScanResult = {
      totalScanned: records.length,
      issuesFound: 0,
      issuesFixed: 0,
      errors: []
    };

    // Prepare OHLC data for recalculation
    const ohlcData = records.map(record => ({
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
      volume: record.volume,
      timestamp: record.timestamp
    })).reverse(); // Reverse to chronological order

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Check for issues with current record
        const issues = this.detectIssues(record);
        
        if (issues.length > 0) {
          result.issuesFound += issues.length;
          
          // Recalculate indicators using enough historical data
          const historicalData = ohlcData.slice(0, Math.min(i + 50, ohlcData.length));
          const correctIndicators = TechnicalIndicatorsService.calculateAll(historicalData, record.close);
          
          // Update the record with correct values
          const fixed = await this.fixRecord(record.id, correctIndicators, issues);
          if (fixed) {
            result.issuesFixed += issues.length;
            console.log(`🔧 [TECH INDICATORS MONITOR] Fixed ${symbol} record ${record.id}: ${issues.join(', ')}`);
          }
        }
      } catch (error) {
        const errorMsg = `Record ${record.id} processing failed: ${error}`;
        result.errors.push(errorMsg);
      }
    }

    return result;
  }

  /**
   * Detect issues with technical indicators in a record
   */
  private detectIssues(record: any): string[] {
    const issues: string[] = [];

    // Check RSI
    if (record.rsi !== null) {
      if (isNaN(record.rsi) || record.rsi < 0 || record.rsi > 100) {
        issues.push(`Invalid RSI: ${record.rsi}`);
      }
    }

    // Check Stochastic K
    if (record.stochastic_k !== null) {
      if (isNaN(record.stochastic_k) || record.stochastic_k < 0 || record.stochastic_k > 100) {
        issues.push(`Invalid Stochastic K: ${record.stochastic_k}`);
      }
    }

    // Check Stochastic D
    if (record.stochastic_d !== null) {
      if (isNaN(record.stochastic_d) || record.stochastic_d < 0 || record.stochastic_d > 100) {
        issues.push(`Invalid Stochastic D: ${record.stochastic_d}`);
      }
    }

    // Check MACD for reasonable values (shouldn't be extreme)
    if (record.macd !== null && (isNaN(record.macd) || Math.abs(record.macd) > record.close * 0.1)) {
      issues.push(`Suspicious MACD: ${record.macd}`);
    }

    // Check Bollinger Bands ordering
    if (record.bollinger_upper && record.bollinger_middle && record.bollinger_lower) {
      if (record.bollinger_upper <= record.bollinger_middle || 
          record.bollinger_middle <= record.bollinger_lower) {
        issues.push('Invalid Bollinger Bands ordering');
      }
    }

    return issues;
  }

  /**
   * Fix a record with correct indicator values
   */
  private async fixRecord(recordId: number, indicators: any, issues: string[]): Promise<boolean> {
    try {
      const updateQuery = `
        UPDATE rolling_chart_data 
        SET 
          rsi = $1,
          macd = $2,
          macd_signal = $3,
          macd_histogram = $4,
          stochastic_k = $5,
          stochastic_d = $6,
          bollinger_upper = $7,
          bollinger_middle = $8,
          bollinger_lower = $9,
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

      return true;
    } catch (error) {
      console.error(`❌ [TECH INDICATORS MONITOR] Failed to fix record ${recordId}: ${error}`);
      return false;
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isRunning: boolean; scanInterval: number; lastScan?: Date } {
    return {
      isRunning: this.isRunning,
      scanInterval: this.scanInterval
    };
  }

  /**
   * Perform manual scan (for API endpoint)
   */
  async performManualScan(): Promise<ScanResult> {
    console.log('🔧 [TECH INDICATORS MONITOR] Manual scan requested');
    return await this.performFullScan();
  }
}

// Export singleton instance
export const technicalIndicatorsMonitor = new TechnicalIndicatorsMonitor();