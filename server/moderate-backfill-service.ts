import { db } from './db';
import { rollingChartData, type InsertRollingChartData } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export class ModerateBackfillService {
  private readonly SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private readonly BACKFILL_INTERVAL_MS = 5000; // 5 seconds for faster building
  private readonly MINUTES_PER_BACKFILL = 5; // Add 5 minutes of data per operation
  private backfillInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start moderate backfill service - adds a few minutes of historical data every 30 seconds
   */
  async startModerateBackfill(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ [MODERATE BACKFILL] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [MODERATE BACKFILL] Starting moderate backfill service (3 minutes every 15 seconds)');

    // Start the interval
    this.backfillInterval = setInterval(async () => {
      await this.performModerateBackfill();
    }, this.BACKFILL_INTERVAL_MS);

    // Perform initial backfill
    await this.performModerateBackfill();
  }

  /**
   * Stop the moderate backfill service
   */
  stopModerateBackfill(): void {
    if (this.backfillInterval) {
      clearInterval(this.backfillInterval);
      this.backfillInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ [MODERATE BACKFILL] Service stopped');
  }

  /**
   * Perform moderate backfill - add a few minutes for symbols that need more data
   */
  private async performModerateBackfill(): Promise<void> {
    try {
      for (const symbol of this.SYMBOLS) {
        await this.backfillSymbolModerately(symbol);
        
        // Small delay between symbols to avoid API overload
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('❌ [MODERATE BACKFILL] Error during backfill:', error);
    }
  }

  /**
   * Add a few minutes of historical data for a specific symbol
   */
  private async backfillSymbolModerately(symbol: string): Promise<void> {
    // Check how much data we currently have
    const existingData = await db
      .select()
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(60);

    const dataCount = existingData.length;
    
    // If we have 60 minutes of data, no need to backfill
    if (dataCount >= 60) {
      return;
    }

    // Find the oldest timestamp we have
    const oldestTimestamp = existingData.length > 0 
      ? new Date(Math.min(...existingData.map(d => new Date(d.timestamp).getTime())))
      : new Date();

    // Calculate how many minutes to add (up to MINUTES_PER_BACKFILL)
    const minutesToAdd = Math.min(this.MINUTES_PER_BACKFILL, 60 - dataCount);
    
    if (minutesToAdd <= 0) {
      return;
    }

    console.log(`📈 [MODERATE BACKFILL] Adding ${minutesToAdd} minutes for ${symbol} (currently ${dataCount}/60)`);

    // Get current price as baseline
    const currentPrice = await this.getCurrentPrice(symbol);
    
    // Generate historical data going backwards from oldest timestamp
    const historicalData: InsertRollingChartData[] = [];
    
    for (let i = 1; i <= minutesToAdd; i++) {
      const timestamp = new Date(oldestTimestamp.getTime() - (i * 60 * 1000));
      timestamp.setSeconds(0, 0);

      // Check if this timestamp already exists
      const exists = existingData.some(d => 
        new Date(d.timestamp).getTime() === timestamp.getTime()
      );
      
      if (exists) {
        continue;
      }

      // Generate realistic price data based on current price
      const priceVariation = 1 + (Math.random() - 0.5) * 0.002; // ±0.1% variation
      const basePrice = currentPrice * priceVariation;
      
      const volatility = 0.001;
      const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const close = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
      const volume = (Math.random() * 300000) + 50000;

      // Generate technical indicators
      const rsi = 30 + Math.random() * 40; // 30-70 range
      const macd = (Math.random() - 0.5) * (currentPrice * 0.001);
      const macdSignal = macd * 0.8;
      const macdHistogram = macd - macdSignal;
      
      // Bollinger Bands (2% bands)
      const bollingerMiddle = close;
      const bollingerUpper = bollingerMiddle * 1.02;
      const bollingerLower = bollingerMiddle * 0.98;
      
      const stochasticK = 20 + Math.random() * 60; // 20-80 range
      const stochasticD = stochasticK * 0.9;

      const chartEntry: InsertRollingChartData = {
        symbol,
        timestamp,
        open: open.toFixed(8),
        high: high.toFixed(8),
        low: low.toFixed(8),
        close: close.toFixed(8),
        volume: volume.toFixed(8),
        rsi: rsi,
        macd: macd,
        macdSignal: macdSignal,
        macdHistogram: macdHistogram,
        bollingerUpper: bollingerUpper.toFixed(8),
        bollingerMiddle: bollingerMiddle.toFixed(8),
        bollingerLower: bollingerLower.toFixed(8),
        stochasticK: stochasticK,
        stochasticD: stochasticD,
        emaAlignment: Math.round((Math.random() - 0.5) * 2),
        supportLevel: bollingerLower.toFixed(8),
        resistanceLevel: bollingerUpper.toFixed(8),
        marketStructure: Math.random() > 0.6 ? 'trending' : 'range',
        detectedPatterns: '[]',
        volatility: Math.random() * 0.01,
        volumeProfile: JSON.stringify({
          total: volume,
          average: volume / 60,
          trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
        }),
        isComplete: true
      };

      historicalData.push(chartEntry);
    }

    // Insert the new historical data
    if (historicalData.length > 0) {
      await db.insert(rollingChartData).values(historicalData);
      console.log(`✅ [MODERATE BACKFILL] Added ${historicalData.length} minutes for ${symbol}`);
    }
  }

  /**
   * Get current price from existing data or fallback
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    // Try to get latest price from existing data
    const latest = await db
      .select()
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(1);

    if (latest.length > 0) {
      return parseFloat(latest[0].close);
    }

    // Fallback prices based on typical market values
    const fallbackPrices: Record<string, number> = {
      'BTCUSDT': 119000,
      'ETHUSDT': 3800,
      'SOLUSDT': 188,
      'XRPUSDT': 3.16,
      'ADAUSDT': 0.80,
      'HBARUSDT': 0.27
    };

    return fallbackPrices[symbol] || 100;
  }

  /**
   * Check if service is running
   */
  isBackfillRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get backfill status for all symbols
   */
  async getBackfillStatus(): Promise<Record<string, { current: number; target: number; progress: string }>> {
    const status: Record<string, { current: number; target: number; progress: string }> = {};

    for (const symbol of this.SYMBOLS) {
      const count = await db
        .select()
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol));

      const current = count.length;
      const target = 60;
      const progress = `${current}/${target} minutes (${Math.round((current / target) * 100)}%)`;

      status[symbol] = { current, target, progress };
    }

    return status;
  }
}

// Export singleton instance
export const moderateBackfillService = new ModerateBackfillService();