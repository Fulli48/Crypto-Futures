/**
 * Continuous RSI Worker Service (TypeScript)
 * Runs continuously to fill missing RSI values and replace stale/incorrect calculations
 * Integrated with the existing TypeScript backend system
 */

import { db } from './db';
import { rollingChartData } from '../shared/schema';
import { eq, sql, and, or, isNull, lt, gte, desc, asc } from 'drizzle-orm';

export class ContinuousRSIWorkerService {
  private isRunning = false;
  private processingInterval = 30000; // 30 seconds
  private batchSize = 50;
  private symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Calculate RSI from price data
   */
  private calculateRSI(prices: number[], period = 14): number | null {
    if (prices.length < period + 1) return null;

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }

    if (gains.length < period) return null;

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Apply smoothing for remaining periods
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    // Calculate RSI
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi * 100) / 100;
  }

  /**
   * Find records that need RSI recalculation
   * Targets: null RSI, RSI = 50 (fake), RSI = 0, very old RSI values
   */
  private async findRecordsNeedingRSI(symbol: string, limit = 50) {
    try {
      const records = await db
        .select({
          id: rollingChartData.id,
          timestamp: rollingChartData.timestamp,
          close: rollingChartData.close,
          rsi: rollingChartData.rsi,
          updatedAt: rollingChartData.updatedAt
        })
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            or(
              isNull(rollingChartData.rsi),                    // Missing RSI
              eq(rollingChartData.rsi, 50),                   // Fake RSI = 50
              eq(rollingChartData.rsi, 0),                    // Invalid RSI = 0
              eq(rollingChartData.rsi, 70.66),               // Stale RSI = 70.66
              between(rollingChartData.rsi, 70.65, 70.67),   // Near-stale RSI values
              lt(rollingChartData.updatedAt, 
                 sql`NOW() - INTERVAL '10 minutes'`)         // Old RSI (> 10 minutes) - more aggressive refresh
            )
          )
        )
        .orderBy(asc(rollingChartData.timestamp))
        .limit(limit);

      return records;
    } catch (error) {
      console.error(`Error finding records needing RSI for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get price history for RSI calculation
   */
  private async getPriceHistory(symbol: string, beforeTimestamp: Date, limit = 30) {
    try {
      const prices = await db
        .select({
          close: rollingChartData.close,
          timestamp: rollingChartData.timestamp
        })
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            lt(rollingChartData.timestamp, beforeTimestamp)
          )
        )
        .orderBy(desc(rollingChartData.timestamp))
        .limit(limit);

      return prices.reverse().map(p => parseFloat(p.close as string));
    } catch (error) {
      console.error(`Error getting price history for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Update RSI value in database
   */
  private async updateRSI(recordId: number, newRSI: number): Promise<boolean> {
    try {
      await db
        .update(rollingChartData)
        .set({ 
          rsi: newRSI,
          updatedAt: new Date()
        })
        .where(eq(rollingChartData.id, recordId));
      
      return true;
    } catch (error) {
      console.error(`Error updating RSI for record ${recordId}:`, error);
      return false;
    }
  }

  /**
   * Process RSI updates for a single symbol
   */
  private async processSymbolRSI(symbol: string) {
    const records = await this.findRecordsNeedingRSI(symbol, this.batchSize);
    
    if (records.length === 0) {
      return { processed: 0, updated: 0 };
    }

    console.log(`🔄 [RSI WORKER] Processing ${records.length} RSI updates for ${symbol}`);
    
    let updated = 0;
    
    for (const record of records) {
      // Get price history for this record
      const priceHistory = await this.getPriceHistory(symbol, record.timestamp, 30);
      
      if (priceHistory.length >= 15) {
        // Add current price to history
        priceHistory.push(parseFloat(record.close as string));
        
        // Calculate new RSI
        const newRSI = this.calculateRSI(priceHistory, 14);
        
        if (newRSI !== null && newRSI !== record.rsi) {
          const success = await this.updateRSI(record.id, newRSI);
          if (success) {
            updated++;
            console.log(`✅ [RSI WORKER] ${symbol}: Updated RSI ${record.rsi || 'null'} → ${newRSI} at ${record.timestamp}`);
          }
        }
      }
    }

    return { processed: records.length, updated };
  }

  /**
   * Main processing cycle
   */
  private async processCycle() {
    if (this.isRunning) {
      console.log('⚠️ [RSI WORKER] Previous cycle still running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [RSI WORKER] Starting processing cycle...');

    let totalProcessed = 0;
    let totalUpdated = 0;

    try {
      for (const symbol of this.symbols) {
        const result = await this.processSymbolRSI(symbol);
        totalProcessed += result.processed;
        totalUpdated += result.updated;
        
        // Small delay between symbols to avoid overwhelming the database
        if (result.updated > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (totalUpdated > 0) {
        console.log(`📊 [RSI WORKER] Cycle complete: ${totalUpdated}/${totalProcessed} RSI values updated`);
      }
    } catch (error) {
      console.error('❌ [RSI WORKER] Error in processing cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the continuous worker
   */
  public start() {
    console.log('🚀 [RSI WORKER] Starting Continuous RSI Worker...');
    console.log(`⏱️ [RSI WORKER] Processing interval: ${this.processingInterval / 1000}s`);
    console.log(`📊 [RSI WORKER] Batch size: ${this.batchSize} records per symbol`);
    
    // Run initial cycle
    this.processCycle();
    
    // Set up continuous processing
    this.intervalId = setInterval(() => {
      this.processCycle();
    }, this.processingInterval);
  }

  /**
   * Stop the continuous worker
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 [RSI WORKER] Continuous RSI Worker stopped');
    }
  }

  /**
   * Get worker status
   */
  public getStatus() {
    return {
      running: this.intervalId !== null,
      processing: this.isRunning,
      interval: this.processingInterval,
      batchSize: this.batchSize,
      symbols: this.symbols
    };
  }
}