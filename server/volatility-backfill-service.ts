import { db } from './db';
import { rollingChartData } from '@shared/schema';
import { eq, sql, and, isNull, or } from 'drizzle-orm';

export class VolatilityBackfillService {
  private readonly SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];

  /**
   * COMPREHENSIVE VOLATILITY BACKFILL: Ensure ALL chart records have volatility calculations
   */
  async executeComprehensiveVolatilityBackfill(): Promise<void> {
    console.log('🧮 [COMPREHENSIVE VOLATILITY] Starting complete volatility backfill for all records...');
    
    try {
      let totalUpdated = 0;
      
      for (const symbol of this.SUPPORTED_SYMBOLS) {
        const symbolUpdated = await this.backfillVolatilityForSymbol(symbol);
        totalUpdated += symbolUpdated;
      }
      
      console.log(`✅ [COMPREHENSIVE VOLATILITY] Backfill completed - updated ${totalUpdated} records with volatility calculations`);
    } catch (error) {
      console.error('❌ [COMPREHENSIVE VOLATILITY] Error during comprehensive volatility backfill:', error);
    }
  }

  /**
   * Backfill volatility for a specific symbol
   */
  private async backfillVolatilityForSymbol(symbol: string): Promise<number> {
    console.log(`📊 [VOLATILITY BACKFILL] Processing ${symbol}...`);
    
    try {
      // Get all records without volatility data for this symbol
      const recordsWithoutVolatility = await db
        .select()
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            or(
              isNull(rollingChartData.realizedVolatility),
              eq(rollingChartData.realizedVolatility, 0),
              isNull(rollingChartData.volatility5min),
              eq(rollingChartData.volatility5min, 0)
            )
          )
        )
        .orderBy(rollingChartData.timestamp);

      if (recordsWithoutVolatility.length === 0) {
        console.log(`✅ [VOLATILITY BACKFILL] ${symbol}: All records already have volatility data`);
        return 0;
      }

      console.log(`🔧 [VOLATILITY BACKFILL] ${symbol}: Found ${recordsWithoutVolatility.length} records without volatility`);

      // Get all records for this symbol to calculate proper volatility windows
      const allRecords = await db
        .select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(rollingChartData.timestamp);

      let updatedCount = 0;

      // Process each record without volatility
      for (const record of recordsWithoutVolatility) {
        const recordTimestamp = new Date(record.timestamp);
        
        // Find the index of this record in the full dataset
        const recordIndex = allRecords.findIndex(r => 
          new Date(r.timestamp).getTime() === recordTimestamp.getTime()
        );
        
        if (recordIndex === -1) continue;

        // Calculate volatility using available price history
        const volatilityData = this.calculateVolatilityForRecord(allRecords, recordIndex);

        if (volatilityData.realized > 0) {
          // Update the record with calculated volatility
          await db
            .update(rollingChartData)
            .set({
              realizedVolatility: volatilityData.realized,
              volatility5min: volatilityData.fiveMin,
              volatility15min: volatilityData.fifteenMin,
              volatility60min: volatilityData.sixtyMin
            })
            .where(
              and(
                eq(rollingChartData.symbol, symbol),
                eq(rollingChartData.timestamp, record.timestamp)
              )
            );

          updatedCount++;
        }
      }

      console.log(`✅ [VOLATILITY BACKFILL] ${symbol}: Updated ${updatedCount}/${recordsWithoutVolatility.length} records with volatility calculations`);
      return updatedCount;

    } catch (error) {
      console.error(`❌ [VOLATILITY BACKFILL] Error processing ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Calculate volatility for a specific record using available price history
   */
  private calculateVolatilityForRecord(allRecords: any[], targetIndex: number): {
    realized: number;
    fiveMin: number;
    fifteenMin: number;
    sixtyMin: number;
  } {
    if (targetIndex < 1) {
      return { realized: 0, fiveMin: 0, fifteenMin: 0, sixtyMin: 0 };
    }

    // Get price data for volatility calculation windows
    const prices = allRecords.slice(0, targetIndex + 1).map(r => parseFloat(r.close));
    
    // Calculate realized volatility (using all available data, minimum 2 points)
    const realizedVol = this.calculateRealizedVolatility(prices);
    
    // Calculate windowed volatilities
    const fiveMinVol = this.calculateWindowedVolatility(prices, 5);
    const fifteenMinVol = this.calculateWindowedVolatility(prices, 15);
    const sixtyMinVol = this.calculateWindowedVolatility(prices, 60);

    return {
      realized: realizedVol,
      fiveMin: fiveMinVol,
      fifteenMin: fifteenMinVol,
      sixtyMin: sixtyMinVol
    };
  }

  /**
   * Calculate realized volatility from price array
   */
  private calculateRealizedVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    // Calculate log returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > 0 && prices[i-1] > 0) {
        returns.push(Math.log(prices[i] / prices[i-1]));
      }
    }

    if (returns.length < 2) return 0;

    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(60 * 24 * 365); // Annualized

    return volatility * 100; // Convert to percentage
  }

  /**
   * Calculate windowed volatility (last N periods)
   */
  private calculateWindowedVolatility(prices: number[], windowSize: number): number {
    if (prices.length < 2) return 0;

    // Use the last windowSize prices (or all available if less)
    const windowPrices = prices.slice(-Math.min(windowSize, prices.length));
    
    return this.calculateRealizedVolatility(windowPrices);
  }

  /**
   * Quick check if symbol needs volatility backfill
   */
  async checkVolatilityStatus(symbol: string): Promise<{
    totalRecords: number;
    recordsWithVolatility: number;
    recordsNeedingBackfill: number;
  }> {
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol));

    const withVolatilityCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(rollingChartData)
      .where(
        and(
          eq(rollingChartData.symbol, symbol),
          sql`${rollingChartData.realizedVolatility} > 0`
        )
      );

    const total = totalCount[0]?.count || 0;
    const withVol = withVolatilityCount[0]?.count || 0;

    return {
      totalRecords: total,
      recordsWithVolatility: withVol,
      recordsNeedingBackfill: total - withVol
    };
  }
}

export const volatilityBackfillService = new VolatilityBackfillService();