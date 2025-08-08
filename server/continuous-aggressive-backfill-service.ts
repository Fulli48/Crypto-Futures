import { db } from './db';
import { rollingChartData, type InsertRollingChartData } from '@shared/schema';
import { eq, and, desc, asc, sql, isNull, ne } from 'drizzle-orm';

/**
 * Continuous Aggressive Backfill Service
 * Continuously backfills historical data to reach the 600-minute rolling window
 * Fetches all available API data per minute over time, not all at once
 */
export class ContinuousAggressiveBackfillService {
  private readonly SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private readonly TARGET_WINDOW_MINUTES = 600; // Target 600 minutes
  private readonly BACKFILL_INTERVAL_MS = 3000; // Every 3 seconds
  private readonly MINUTES_PER_BATCH = 15; // Process 15 minutes per batch
  private readonly BINANCE_API_BASE = 'https://api.binance.us/api/v3';
  private readonly MAX_API_REQUESTS_PER_MINUTE = 180; // Conservative API limit
  
  private backfillInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private requestCount = 0;
  private requestResetTime = Date.now();
  private currentSymbolIndex = 0;
  
  /**
   * Start continuous aggressive backfill service
   */
  async startContinuousBackfill(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ [AGGRESSIVE BACKFILL] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 [AGGRESSIVE BACKFILL] Starting continuous backfill service (${this.MINUTES_PER_BATCH} minutes every ${this.BACKFILL_INTERVAL_MS/1000}s)`);

    // Start the interval - processes one symbol at a time in rotation
    this.backfillInterval = setInterval(async () => {
      await this.performContinuousBackfill();
    }, this.BACKFILL_INTERVAL_MS);

    // Perform initial backfill
    await this.performContinuousBackfill();
  }

  /**
   * Stop the continuous backfill service
   */
  stopContinuousBackfill(): void {
    if (this.backfillInterval) {
      clearInterval(this.backfillInterval);
      this.backfillInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ [AGGRESSIVE BACKFILL] Service stopped');
  }

  /**
   * Perform continuous backfill - processes one symbol per cycle to distribute API calls
   */
  private async performContinuousBackfill(): Promise<void> {
    try {
      // Reset API request counter every minute
      const now = Date.now();
      if (now - this.requestResetTime > 60000) {
        this.requestCount = 0;
        this.requestResetTime = now;
      }

      // Check API rate limit
      if (this.requestCount >= this.MAX_API_REQUESTS_PER_MINUTE) {
        console.log('⏸️ [AGGRESSIVE BACKFILL] API rate limit reached, waiting...');
        return;
      }

      // Process current symbol in rotation
      const symbol = this.SYMBOLS[this.currentSymbolIndex];
      await this.backfillSymbolContinuously(symbol);
      
      // Move to next symbol
      this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.SYMBOLS.length;

    } catch (error) {
      console.error('❌ [AGGRESSIVE BACKFILL] Error during backfill:', error);
    }
  }

  /**
   * Aggressively backfill historical data for a specific symbol
   */
  private async backfillSymbolContinuously(symbol: string): Promise<void> {
    // Get current data stats
    const stats = await this.getSymbolDataStats(symbol);
    
    // If we've reached the target, skip this symbol
    if (stats.totalRecords >= this.TARGET_WINDOW_MINUTES) {
      return;
    }

    const completionPercent = Math.round((stats.totalRecords / this.TARGET_WINDOW_MINUTES) * 100);
    console.log(`📊 [AGGRESSIVE BACKFILL] ${symbol}: ${stats.totalRecords}/${this.TARGET_WINDOW_MINUTES} records (${completionPercent}%)`);

    // Find actual gaps in the data to backfill
    const gapInfo = await this.findDataGaps(symbol);
    
    if (!gapInfo) {
      console.log(`📈 [AGGRESSIVE BACKFILL] ${symbol} no gaps found - data is continuous or insufficient`);
      return;
    }

    const { startTime, endTime } = gapInfo;

    console.log(`📅 [AGGRESSIVE BACKFILL] ${symbol} fetching ${this.MINUTES_PER_BATCH} minutes: ${startTime.toISOString()} to ${endTime.toISOString()}`);

    try {
      // Fetch historical data from Binance API
      console.log(`🌐 [AGGRESSIVE BACKFILL] ${symbol} making API call to Binance...`);
      const historicalData = await this.fetchHistoricalKlines(symbol, startTime, endTime);
      this.requestCount++;
      
      console.log(`📦 [AGGRESSIVE BACKFILL] ${symbol} received ${historicalData.length} kline records from API`);

      if (historicalData.length === 0) {
        console.log(`⚠️ [AGGRESSIVE BACKFILL] ${symbol} no data returned from API for time range ${startTime.toISOString()} to ${endTime.toISOString()}`);
        return;
      }

      // Store the data with technical indicators
      console.log(`💾 [AGGRESSIVE BACKFILL] ${symbol} processing ${historicalData.length} records with technical indicators...`);
      const storedCount = await this.storeHistoricalDataWithIndicators(symbol, historicalData);
      
      if (storedCount > 0) {
        const newTotal = stats.totalRecords + storedCount;
        const newCompletionPercent = Math.round((newTotal / this.TARGET_WINDOW_MINUTES) * 100);
        console.log(`✅ [AGGRESSIVE BACKFILL] ${symbol} added ${storedCount} records → ${newTotal}/${this.TARGET_WINDOW_MINUTES} (${newCompletionPercent}%)`);
      } else {
        console.log(`⚠️ [AGGRESSIVE BACKFILL] ${symbol} processed ${historicalData.length} records but ${storedCount} were stored (duplicates skipped)`);
      }

    } catch (error) {
      console.error(`❌ [AGGRESSIVE BACKFILL] ${symbol} error:`, error instanceof Error ? error.message : error);
      console.error(`❌ [AGGRESSIVE BACKFILL] ${symbol} failed for time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
    }
  }

  /**
   * Find gaps in the data that need to be backfilled
   */
  private async findDataGaps(symbol: string): Promise<{ startTime: Date; endTime: Date } | null> {
    // Get all timestamps for this symbol, ordered by time
    const existingData = await db
      .select({ timestamp: rollingChartData.timestamp })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(asc(rollingChartData.timestamp));

    if (existingData.length === 0) {
      // No data exists, start backfilling from current time going backward
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (this.MINUTES_PER_BATCH * 60 * 1000));
      return { startTime, endTime };
    }

    if (existingData.length < 10) {
      // Very little data, backfill before the earliest record
      const earliestTime = new Date(existingData[0].timestamp);
      const endTime = new Date(earliestTime.getTime() - 60000); // 1 minute before earliest
      const startTime = new Date(endTime.getTime() - (this.MINUTES_PER_BATCH * 60 * 1000));
      return { startTime, endTime };
    }

    // Look for gaps in the existing data (missing minutes)
    for (let i = 1; i < existingData.length; i++) {
      const currentTime = new Date(existingData[i].timestamp);
      const previousTime = new Date(existingData[i - 1].timestamp);
      const timeDiffMinutes = (currentTime.getTime() - previousTime.getTime()) / (60 * 1000);

      // If there's a gap of more than 2 minutes, fill it
      if (timeDiffMinutes > 2) {
        const gapStartTime = new Date(previousTime.getTime() + 60000); // 1 minute after previous
        const gapEndTime = new Date(Math.min(
          gapStartTime.getTime() + (this.MINUTES_PER_BATCH * 60 * 1000),
          currentTime.getTime() - 60000 // 1 minute before current
        ));
        
        if (gapEndTime > gapStartTime) {
          return { startTime: gapStartTime, endTime: gapEndTime };
        }
      }
    }

    // No gaps found in existing data, backfill before the earliest record
    const earliestTime = new Date(existingData[0].timestamp);
    const endTime = new Date(earliestTime.getTime() - 60000); // 1 minute before earliest
    const startTime = new Date(endTime.getTime() - (this.MINUTES_PER_BATCH * 60 * 1000));
    
    // Don't go too far back (limit to 7 days)
    const maxHistoryTime = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    if (startTime < maxHistoryTime) {
      return null; // Don't backfill beyond 7 days
    }

    return { startTime, endTime };
  }

  /**
   * Get data statistics for a symbol
   */
  private async getSymbolDataStats(symbol: string): Promise<{
    totalRecords: number;
    earliestTimestamp?: Date;
    latestTimestamp?: Date;
  }> {
    const countResult = await db
      .select({ count: sql`count(*)` })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol));

    const totalRecords = Number(countResult[0]?.count || 0);

    if (totalRecords === 0) {
      return { totalRecords };
    }

    const rangeResult = await db
      .select({
        earliest: sql`min(timestamp)`,
        latest: sql`max(timestamp)`
      })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol));

    return {
      totalRecords,
      earliestTimestamp: rangeResult[0]?.earliest ? new Date(rangeResult[0].earliest as string) : undefined,
      latestTimestamp: rangeResult[0]?.latest ? new Date(rangeResult[0].latest as string) : undefined
    };
  }

  /**
   * Fetch historical klines from Binance API
   */
  private async fetchHistoricalKlines(symbol: string, startTime: Date, endTime: Date): Promise<any[]> {
    const url = `${this.BINANCE_API_BASE}/klines`;
    const params = new URLSearchParams({
      symbol: symbol,
      interval: '1m',
      startTime: startTime.getTime().toString(),
      endTime: endTime.getTime().toString(),
      limit: '1000'
    });

    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * Store historical data with calculated technical indicators
   */
  private async storeHistoricalDataWithIndicators(symbol: string, klineData: any[]): Promise<number> {
    if (klineData.length === 0) return 0;

    const dataToInsert: InsertRollingChartData[] = [];

    for (const kline of klineData) {
      const timestamp = new Date(kline[0]);
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);

      // Check if this timestamp already exists
      const existing = await db
        .select()
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            eq(rollingChartData.timestamp, timestamp)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue; // Skip duplicate
      }

      // Calculate basic technical indicators
      const indicators = await this.calculateTechnicalIndicators(symbol, {
        timestamp, open, high, low, close, volume
      });

      dataToInsert.push({
        symbol,
        timestamp,
        open: this.formatPrice(symbol, open),
        high: this.formatPrice(symbol, high),
        low: this.formatPrice(symbol, low),
        close: this.formatPrice(symbol, close),
        volume: this.formatVolume(volume),
        rsi: indicators.rsi,
        macd: indicators.macd,
        realizedVolatility: indicators.volatility,
        bollingerUpper: indicators.bollingerUpper,
        bollingerLower: indicators.bollingerLower,
        stochasticK: indicators.stochasticK,
        stochasticD: indicators.stochasticD,
        supportLevel: indicators.supportLevel,
        resistanceLevel: indicators.resistanceLevel,
        emaAlignment: indicators.emaAlignment,
        marketStructure: indicators.marketStructure,
        detectedPatterns: JSON.stringify(indicators.detectedPatterns || {}),
        volumeProfile: JSON.stringify(indicators.volumeProfile || {}),
        isComplete: true
      });
    }

    if (dataToInsert.length === 0) return 0;

    // Insert data in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < dataToInsert.length; i += batchSize) {
      const batch = dataToInsert.slice(i, i + batchSize);
      
      try {
        await db.insert(rollingChartData).values(batch);
        insertedCount += batch.length;
      } catch (error) {
        console.error(`❌ [AGGRESSIVE BACKFILL] Error inserting batch:`, error);
        console.error(`❌ [AGGRESSIVE BACKFILL] First batch item:`, JSON.stringify(batch[0], null, 2));
      }
    }

    return insertedCount;
  }

  /**
   * Calculate technical indicators for a single data point
   */
  private async calculateTechnicalIndicators(symbol: string, current: {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }): Promise<any> {
    // Get recent data for indicator calculations
    const recentData = await db
      .select()
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(50);

    const closes = [current.close, ...recentData.map(d => parseFloat(d.close))];
    const highs = [current.high, ...recentData.map(d => parseFloat(d.high))];
    const lows = [current.low, ...recentData.map(d => parseFloat(d.low))];

    // Calculate RSI (simplified 14-period)
    const rsi = this.calculateRSI(closes, 14);
    
    // Calculate MACD (simplified)
    const macd = this.calculateMACD(closes);
    
    // Calculate volatility (simple method)
    const volatility = this.calculateVolatility(closes);
    
    // Calculate Bollinger Bands
    const bollinger = this.calculateBollingerBands(closes, 20, 2);
    
    // Calculate Stochastic
    const stochastic = this.calculateStochastic(highs, lows, closes, 14);

    // Ensure all values are properly typed for database insertion
    const safeRsi = rsi !== null && !isNaN(rsi) ? parseFloat(rsi.toFixed(4)) : 50.0;
    const safeMacd = macd !== null && !isNaN(macd) ? parseFloat(macd.toFixed(4)) : 0.0;
    const safeVolatility = volatility !== null && !isNaN(volatility) ? parseFloat(volatility.toFixed(4)) : 0.8;
    const safeBollingerUpper = bollinger.upper !== null && !isNaN(bollinger.upper) ? parseFloat(bollinger.upper.toFixed(6)) : current.close * 1.02;
    const safeBollingerLower = bollinger.lower !== null && !isNaN(bollinger.lower) ? parseFloat(bollinger.lower.toFixed(6)) : current.close * 0.98;
    const safeStochasticK = stochastic.k !== null && !isNaN(stochastic.k) ? parseFloat(stochastic.k.toFixed(4)) : 50.0;
    const safeStochasticD = stochastic.d !== null && !isNaN(stochastic.d) ? parseFloat(stochastic.d.toFixed(4)) : 50.0;
    const safeSupportLevel = parseFloat((current.low * 0.99).toFixed(6));
    const safeResistanceLevel = parseFloat((current.high * 1.01).toFixed(6));
    
    // Convert any potential string trend values to proper integer alignment
    const safeEmaAlignment = 0; // Always use integer 0 for neutral
    const safeMarketStructure = 'range'; // Always use string for market structure
    
    return {
      rsi: safeRsi,
      macd: safeMacd,
      volatility: safeVolatility,
      bollingerUpper: safeBollingerUpper,
      bollingerLower: safeBollingerLower,
      stochasticK: safeStochasticK,
      stochasticD: safeStochasticD,
      supportLevel: safeSupportLevel,
      resistanceLevel: safeResistanceLevel,
      emaAlignment: safeEmaAlignment, // Integer field - must be numeric (0=neutral, 1=bullish, -1=bearish)
      marketStructure: safeMarketStructure, // Text field - must be string
      detectedPatterns: {},
      volumeProfile: {}
    };
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i - 1] - prices[i];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(prices: number[]): number | null {
    if (prices.length < 26) return null;

    const ema12 = this.calculateEMA(prices.slice(0, 12), 12);
    const ema26 = this.calculateEMA(prices.slice(0, 26), 26);

    if (ema12 === null || ema26 === null) return null;

    return ema12 - ema26;
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = prices[prices.length - 1];

    for (let i = prices.length - 2; i >= 0; i--) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Calculate volatility with enhanced fallback handling
   */
  private calculateVolatility(prices: number[]): number | null {
    if (prices.length < 2) {
      // Return a market-typical volatility based on asset type
      return this.getDefaultVolatility(prices[0] || 1);
    }

    const returns = [];
    for (let i = 1; i < Math.min(prices.length, 20); i++) {
      const price1 = prices[i - 1];
      const price2 = prices[i];
      
      // Guard against zero or negative prices
      if (price1 <= 0 || price2 <= 0) continue;
      
      returns.push(Math.log(price1 / price2));
    }

    if (returns.length === 0) {
      return this.getDefaultVolatility(prices[0] || 1);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    const volatility = Math.sqrt(variance * 252); // Annualized
    
    // Return reasonable volatility values (0.1 to 2.0 range)
    return Math.max(0.1, Math.min(2.0, volatility));
  }

  /**
   * Get default volatility based on price level (asset type estimation)
   */
  private getDefaultVolatility(price: number): number {
    if (price > 50000) return 0.8; // BTC-like
    if (price > 2000) return 0.6;  // ETH-like
    if (price > 100) return 0.9;   // SOL-like
    if (price > 1) return 0.7;     // XRP/ADA-like
    return 0.8; // HBAR-like
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2): {
    upper: number | null;
    lower: number | null;
  } {
    if (prices.length < period) return { upper: null, lower: null };

    const slice = prices.slice(0, period);
    const sma = slice.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + (stdDev * multiplier),
      lower: sma - (stdDev * multiplier)
    };
  }

  /**
   * Calculate Stochastic
   */
  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number = 14): {
    k: number | null;
    d: number | null;
  } {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return { k: null, d: null };
    }

    const periodHighs = highs.slice(0, period);
    const periodLows = lows.slice(0, period);
    const currentClose = closes[0];

    const highestHigh = Math.max(...periodHighs);
    const lowestLow = Math.min(...periodLows);

    if (highestHigh === lowestLow) return { k: 50, d: 50 };

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    return {
      k,
      d: k // Simplified - normally D is 3-period SMA of K
    };
  }

  /**
   * Format price with appropriate precision
   */
  private formatPrice(symbol: string, price: number): string {
    if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
      return price.toFixed(2);
    } else if (symbol === 'SOLUSDT' || symbol === 'ADAUSDT') {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  }

  /**
   * Format volume
   */
  private formatVolume(volume: number): string {
    return volume.toFixed(3);
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    requestCount: number;
    maxRequestsPerMinute: number;
    currentSymbol: string;
    targetWindowMinutes: number;
    minutesPerBatch: number;
    intervalMs: number;
  } {
    return {
      running: this.isRunning,
      requestCount: this.requestCount,
      maxRequestsPerMinute: this.MAX_API_REQUESTS_PER_MINUTE,
      currentSymbol: this.SYMBOLS[this.currentSymbolIndex],
      targetWindowMinutes: this.TARGET_WINDOW_MINUTES,
      minutesPerBatch: this.MINUTES_PER_BATCH,
      intervalMs: this.BACKFILL_INTERVAL_MS
    };
  }
}

// Export singleton instance
export const continuousAggressiveBackfillService = new ContinuousAggressiveBackfillService();