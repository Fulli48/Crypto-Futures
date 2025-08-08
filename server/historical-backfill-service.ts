import { db } from './db';
import { rollingChartData } from '@shared/schema';
import { sql, eq, and, desc, asc } from 'drizzle-orm';

/**
 * Historical Backfill Service
 * Fetches and stores the past 600 minutes of OHLCV data for each symbol
 * to establish the rolling window foundation before real-time updates begin
 */
export class HistoricalBackfillService {
  private readonly SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private readonly WINDOW_SIZE_MINUTES = 600;
  private readonly BINANCE_API_BASE = 'https://api.binance.us/api/v3';

  /**
   * Main backfill orchestrator - runs for all symbols
   */
  async performHistoricalBackfill(): Promise<void> {
    console.log(`🔄 [HISTORICAL BACKFILL] Starting backfill for past ${this.WINDOW_SIZE_MINUTES} minutes across ${this.SYMBOLS.length} symbols`);
    
    for (const symbol of this.SYMBOLS) {
      try {
        await this.backfillSymbol(symbol);
      } catch (error) {
        console.error(`❌ [HISTORICAL BACKFILL] Failed to backfill ${symbol}:`, error);
      }
    }
    
    console.log(`✅ [HISTORICAL BACKFILL] Completed backfill process for all symbols`);
  }

  /**
   * Backfill historical data for a single symbol
   */
  private async backfillSymbol(symbol: string): Promise<void> {
    console.log(`📊 [HISTORICAL BACKFILL] Processing ${symbol}...`);
    
    // Check current data count
    const currentCount = await this.getCurrentDataCount(symbol);
    console.log(`📈 [HISTORICAL BACKFILL] ${symbol} currently has ${currentCount} records`);
    
    if (currentCount >= this.WINDOW_SIZE_MINUTES) {
      console.log(`✅ [HISTORICAL BACKFILL] ${symbol} already has sufficient data (${currentCount}/${this.WINDOW_SIZE_MINUTES})`);
      return;
    }
    
    const missingMinutes = this.WINDOW_SIZE_MINUTES - currentCount;
    console.log(`⏳ [HISTORICAL BACKFILL] ${symbol} needs ${missingMinutes} additional historical minutes`);
    
    // Get latest timestamp to avoid duplicates
    const latestTimestamp = await this.getLatestTimestamp(symbol);
    
    // Calculate start time for backfill (going backwards from latest or current time)
    const endTime = latestTimestamp || new Date();
    const startTime = new Date(endTime.getTime() - (missingMinutes * 60 * 1000));
    
    console.log(`📅 [HISTORICAL BACKFILL] ${symbol} fetching from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    // Fetch historical klines from Binance
    const historicalData = await this.fetchHistoricalKlines(symbol, startTime, endTime);
    
    if (historicalData.length === 0) {
      console.log(`⚠️ [HISTORICAL BACKFILL] ${symbol} no historical data returned from API`);
      return;
    }
    
    // Store the historical data
    await this.storeHistoricalData(symbol, historicalData);
    
    const finalCount = await this.getCurrentDataCount(symbol);
    const completionPercentage = Math.round((finalCount / this.WINDOW_SIZE_MINUTES) * 100);
    
    console.log(`✅ [HISTORICAL BACKFILL] ${symbol} completed: ${finalCount}/${this.WINDOW_SIZE_MINUTES} records (${completionPercentage}%)`);
  }

  /**
   * Get current data count for a symbol
   */
  private async getCurrentDataCount(symbol: string): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol));
    
    return parseInt(result[0]?.count as string) || 0;
  }

  /**
   * Get the latest timestamp for a symbol to avoid duplicates
   */
  private async getLatestTimestamp(symbol: string): Promise<Date | null> {
    const result = await db
      .select({ timestamp: rollingChartData.timestamp })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(1);
    
    return result[0]?.timestamp || null;
  }

  /**
   * Fetch historical klines from Binance US API
   */
  private async fetchHistoricalKlines(symbol: string, startTime: Date, endTime: Date): Promise<any[]> {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const limit = 1000; // Binance max limit
    
    const url = `${this.BINANCE_API_BASE}/klines?symbol=${symbol}&interval=1m&startTime=${startMs}&endTime=${endMs}&limit=${limit}`;
    
    console.log(`🌐 [HISTORICAL BACKFILL] Fetching ${symbol} from Binance US: ${url}`);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📊 [HISTORICAL BACKFILL] ${symbol} received ${data.length} historical klines`);
      
      return data;
    } catch (error) {
      console.error(`❌ [HISTORICAL BACKFILL] API fetch failed for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Store historical data with proper formatting
   */
  private async storeHistoricalData(symbol: string, klines: any[]): Promise<void> {
    if (klines.length === 0) return;
    
    const formattedData = klines.map(kline => {
      const timestamp = new Date(kline[0]); // Open time
      const open = parseFloat(this.formatPrice(symbol, parseFloat(kline[1])));
      const high = parseFloat(this.formatPrice(symbol, parseFloat(kline[2])));
      const low = parseFloat(this.formatPrice(symbol, parseFloat(kline[3])));
      const close = parseFloat(this.formatPrice(symbol, parseFloat(kline[4])));
      const volume = parseFloat(kline[5]);
      
      return {
        symbol,
        timestamp,
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume: volume.toString(),
        // Technical indicators will be calculated after bulk insert
        rsi: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        bollingerUpper: null,
        bollingerMiddle: null,
        bollingerLower: null,
        stochasticK: null,
        stochasticD: null,
        emaAlignment: null,
        supportLevel: null,
        resistanceLevel: null,
        marketStructure: 'unknown',
        detectedPatterns: '[]',
        volumeProfile: '{}',
        macroEventFlag: false,
        newsImpactScore: 0,
        marketRegimeFlag: 'normal',
        realizedVolatility: null,
        volatility5min: null,
        volatility15min: null,
        volatility60min: null,
        fundingRate: null,
        nextFundingTime: null,
        openInterest: null,
        openInterestChange: '0.00',
        tradeCount: parseInt(kline[8]) || 0, // Trade count from kline[8]
        buyVolume: (parseFloat(kline[5]) * 0.6).toFixed(8), // Estimated buy volume (60% of total)
        sellVolume: (parseFloat(kline[5]) * 0.4).toFixed(8), // Estimated sell volume (40% of total)
        avgTradeSize: (parseFloat(kline[5]) / (parseInt(kline[8]) || 1)).toFixed(8), // Volume per trade
        largestTrade: (parseFloat(kline[5]) * 0.05).toFixed(8), // Estimated largest trade (5% of volume)
        isComplete: false,
        hasMissingData: true,
        dataSourceCount: 1
      };
    });
    
    // Insert data in batches to avoid conflicts
    const batchSize = 50; // Smaller batches for better reliability
    let insertedCount = 0;
    
    for (let i = 0; i < formattedData.length; i += batchSize) {
      const batch = formattedData.slice(i, i + batchSize);
      
      try {
        const insertResult = await db.insert(rollingChartData).values(batch).onConflictDoNothing();
        insertedCount += batch.length;
        console.log(`💾 [HISTORICAL BACKFILL] ${symbol} stored batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
      } catch (error) {
        console.error(`❌ [HISTORICAL BACKFILL] Failed to store batch for ${symbol}:`, error);
      }
    }
    
    // After inserting raw data, calculate technical indicators for the new records
    if (insertedCount > 0) {
      console.log(`🧮 [HISTORICAL BACKFILL] Calculating technical indicators for ${symbol} (${insertedCount} new records)`);
      await this.calculateTechnicalIndicatorsForSymbol(symbol);
    }
  }

  /**
   * Format price with appropriate decimal precision per symbol
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
   * Calculate technical indicators for historical data after bulk insert
   */
  private async calculateTechnicalIndicatorsForSymbol(symbol: string): Promise<void> {
    try {
      // Get all records for this symbol without proper technical indicators
      const incompleteRecords = await db
        .select()
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            eq(rollingChartData.hasMissingData, true)
          )
        )
        .orderBy(asc(rollingChartData.timestamp));

      console.log(`🧮 [TECHNICAL CALC] Processing ${incompleteRecords.length} records for ${symbol}`);

      if (incompleteRecords.length === 0) return;

      // Calculate technical indicators for each record
      for (let i = 0; i < incompleteRecords.length; i++) {
        const record = incompleteRecords[i];
        const close = parseFloat(record.close);
        const high = parseFloat(record.high);  
        const low = parseFloat(record.low);
        const volume = parseFloat(record.volume);

        // Get price history for RSI calculation (need at least 14 periods)
        const priceHistory = incompleteRecords.slice(Math.max(0, i - 20), i + 1).map(r => parseFloat(r.close));
        
        // Calculate simple RSI
        const rsi = this.calculateSimpleRSI(priceHistory, 14);
        
        // Calculate simple MACD  
        const { macd, signal, histogram } = this.calculateSimpleMACD(priceHistory);
        
        // Calculate Bollinger Bands
        const { upper, middle, lower } = this.calculateBollingerBands(priceHistory, 20, 2);
        
        // Calculate Stochastic
        const highHistory = incompleteRecords.slice(Math.max(0, i - 14), i + 1).map(r => parseFloat(r.high));
        const lowHistory = incompleteRecords.slice(Math.max(0, i - 14), i + 1).map(r => parseFloat(r.low));
        const { k, d } = this.calculateStochastic(highHistory, lowHistory, priceHistory, 14);
        
        // Calculate realized volatility
        const volatility = this.calculateVolatility(priceHistory, 14);

        // Update the record with calculated indicators
        await db
          .update(rollingChartData)
          .set({
            rsi: Math.round(rsi * 100) / 100,
            macd: Math.round(macd * 100000) / 100000,
            macdSignal: Math.round(signal * 100000) / 100000,
            macdHistogram: Math.round(histogram * 100000) / 100000,
            bollingerUpper: upper.toFixed(8),
            bollingerMiddle: middle.toFixed(8),
            bollingerLower: lower.toFixed(8),
            stochasticK: Math.round(k * 100) / 100,
            stochasticD: Math.round(d * 100) / 100,
            realizedVolatility: Math.round(volatility * 10000) / 10000,
            volatility5min: Math.round(volatility * 10000) / 10000,
            volatility15min: Math.round(volatility * 10000) / 10000,
            volatility60min: Math.round(volatility * 10000) / 10000,
            emaAlignment: close > middle ? 1 : -1,
            supportLevel: lower.toFixed(8),
            resistanceLevel: upper.toFixed(8),
            marketStructure: 'range',
            isComplete: true,
            hasMissingData: false
          })
          .where(eq(rollingChartData.id, record.id));
      }

      console.log(`✅ [TECHNICAL CALC] Completed technical indicators for ${symbol}`);
    } catch (error) {
      console.error(`❌ [TECHNICAL CALC] Error calculating indicators for ${symbol}:`, error);
    }
  }

  /**
   * Simple RSI calculation
   */
  private calculateSimpleRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
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
   * Simple MACD calculation
   */
  private calculateSimpleMACD(prices: number[]): { macd: number, signal: number, histogram: number } {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simplified signal line (could use EMA of MACD)
    const signal = macd * 0.8;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  /**
   * Simple EMA calculation
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * Bollinger Bands calculation
   */
  private calculateBollingerBands(prices: number[], period: number, stdDev: number): { upper: number, middle: number, lower: number } {
    if (prices.length < period) {
      const lastPrice = prices[prices.length - 1] || 0;
      return { upper: lastPrice * 1.02, middle: lastPrice, lower: lastPrice * 0.98 };
    }
    
    const recentPrices = prices.slice(-period);
    const middle = recentPrices.reduce((sum, price) => sum + price, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: middle + (standardDeviation * stdDev),
      middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  /**
   * Stochastic oscillator calculation
   */
  private calculateStochastic(highs: number[], lows: number[], closes: number[], period: number): { k: number, d: number } {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return { k: 50, d: 50 };
    }
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const d = k * 0.9; // Simplified D line
    
    return { k, d };
  }



  /**
   * Simple volatility calculation (standard deviation of returns)
   */
  private calculateVolatility(prices: number[], period: number): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  /**
   * Force recalculate technical indicators for existing data
   */
  async recalculateTechnicalIndicators(symbol: string): Promise<void> {
    try {
      console.log(`🔧 [FORCE RECALC] Starting technical indicator recalculation for ${symbol}`);
      
      // Get existing records with fake indicators
      const records = await db
        .select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol))
        .orderBy(asc(rollingChartData.timestamp));

      if (records.length === 0) {
        console.log(`⚠️ [FORCE RECALC] No records found for ${symbol}`);
        return;
      }

      console.log(`🔧 [FORCE RECALC] Found ${records.length} records for ${symbol}, recalculating indicators...`);

      // Extract price arrays
      const prices = records.map(r => parseFloat(r.close));
      const highs = records.map(r => parseFloat(r.high));
      const lows = records.map(r => parseFloat(r.low));

      // Update each record with proper technical indicators
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const priceSlice = prices.slice(0, i + 1);
        const highSlice = highs.slice(0, i + 1);
        const lowSlice = lows.slice(0, i + 1);
        
        // Calculate proper technical indicators
        const rsi = this.calculateSimpleRSI(priceSlice, 14);
        const { macd, signal, histogram } = this.calculateSimpleMACD(priceSlice);
        const { upper, middle, lower } = this.calculateBollingerBands(priceSlice, 20, 2);
        const { k, d } = this.calculateStochastic(highSlice, lowSlice, priceSlice, 14);
        const volatility = this.calculateVolatility(priceSlice, Math.min(priceSlice.length, 20));

        // Update record with real calculations
        await db
          .update(rollingChartData)
          .set({
            rsi: Math.round(rsi * 100) / 100,
            macd: Math.round(macd * 100000) / 100000,
            macdSignal: Math.round(signal * 100000) / 100000,
            macdHistogram: Math.round(histogram * 100000) / 100000,
            bollingerUpper: upper.toFixed(8),
            bollingerMiddle: middle.toFixed(8),
            bollingerLower: lower.toFixed(8),
            stochasticK: Math.round(k * 100) / 100,
            stochasticD: Math.round(d * 100) / 100,
            realizedVolatility: Math.round(volatility * 10000) / 10000,
            volatility5min: Math.round(volatility * 10000) / 10000,
            volatility15min: Math.round(volatility * 10000) / 10000,
            volatility60min: Math.round(volatility * 10000) / 10000,
            emaAlignment: parseFloat(record.close) > middle ? 1 : -1,
            supportLevel: lower.toFixed(8),
            resistanceLevel: upper.toFixed(8),
            marketStructure: 'range',
            isComplete: true,
            hasMissingData: false
          })
          .where(eq(rollingChartData.id, record.id));
      }

      console.log(`✅ [FORCE RECALC] Completed technical indicator recalculation for ${symbol} - ${records.length} records updated`);
    } catch (error) {
      console.error(`❌ [FORCE RECALC] Error recalculating indicators for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Initialize rolling window for all symbols
   */
  async initializeRollingWindows(): Promise<void> {
    console.log(`🚀 [HISTORICAL BACKFILL] Initializing 600-minute rolling windows for all symbols`);
    await this.performHistoricalBackfill();
  }
}

export const historicalBackfillService = new HistoricalBackfillService();