/**
 * AUTHORITATIVE TECHNICAL INDICATORS SERVICE
 * 
 * This is the SINGLE SOURCE OF TRUTH for all technical indicator calculations.
 * All other calculation methods are deprecated and should use this service.
 * 
 * DESIGN PRINCIPLES:
 * 1. AUTHENTIC DATA ONLY - No fake values, no fallbacks, no artificial adjustments
 * 2. STANDARD FORMULAS - Industry-standard calculations only
 * 3. PROPER ERROR HANDLING - Return null when insufficient data
 * 4. COMPREHENSIVE VALIDATION - Validate all inputs and outputs
 * 5. CONSISTENT BEHAVIOR - Same calculation method across entire system
 */

export interface TechnicalIndicators {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  sma20: number | null;
  volatility: number | null;
}

export interface OHLCData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export class TechnicalIndicatorsService {
  
  /**
   * Calculate all technical indicators for given OHLC data
   */
  static calculateAll(data: OHLCData[], currentPrice?: number): TechnicalIndicators {
    if (!data || data.length === 0) {
      return this.createNullIndicators();
    }

    // Validate and extract price arrays
    const closes = data.map(d => d.close).filter(p => !isNaN(p) && p > 0);
    const highs = data.map(d => d.high).filter(p => !isNaN(p) && p > 0);
    const lows = data.map(d => d.low).filter(p => !isNaN(p) && p > 0);
    
    if (closes.length === 0) {
      return this.createNullIndicators();
    }

    // Add current price if provided
    const workingCloses = currentPrice ? [...closes, currentPrice] : closes;
    const workingHighs = currentPrice ? [...highs, currentPrice] : highs;
    const workingLows = currentPrice ? [...lows, currentPrice] : lows;

    return {
      rsi: this.calculateRSI(workingCloses),
      macd: this.calculateMACD(workingCloses).macd,
      macdSignal: this.calculateMACD(workingCloses).signal,
      macdHistogram: this.calculateMACD(workingCloses).histogram,
      bollingerUpper: this.calculateBollingerBands(workingCloses).upper,
      bollingerMiddle: this.calculateBollingerBands(workingCloses).middle,
      bollingerLower: this.calculateBollingerBands(workingCloses).lower,
      stochasticK: this.calculateStochastic(workingHighs, workingLows, workingCloses).k,
      stochasticD: this.calculateStochastic(workingHighs, workingLows, workingCloses).d,
      ema9: this.calculateEMA(workingCloses, 9),
      ema21: this.calculateEMA(workingCloses, 21),
      ema50: this.calculateEMA(workingCloses, 50),
      sma20: this.calculateSMA(workingCloses, 20),
      volatility: this.calculateVolatility(workingCloses)
    };
  }

  /**
   * RSI Calculation - Industry Standard Wilder's Smoothing Method
   */
  static calculateRSI(prices: number[], period: number = 14): number | null {
    if (!prices || prices.length < period + 1) {
      return null;
    }

    // Validate prices
    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length < period + 1) {
      return null;
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < validPrices.length; i++) {
      changes.push(validPrices[i] - validPrices[i - 1]);
    }

    if (changes.length < period) {
      return null;
    }

    // Separate gains and losses
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    // Calculate initial averages (first period)
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    // Apply Wilder's smoothing for remaining periods
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    // Calculate RSI
    if (avgLoss === 0) {
      return 100; // All gains, extreme overbought
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Return bounded RSI
    return Math.max(0, Math.min(100, rsi));
  }

  /**
   * MACD Calculation - Standard 12/26/9 periods
   * Properly calculates MACD, Signal Line, and Histogram using historical data
   */
  static calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  } {
    if (!prices || prices.length < slowPeriod + signalPeriod) {
      return { macd: null, signal: null, histogram: null };
    }

    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length < slowPeriod + signalPeriod) {
      return { macd: null, signal: null, histogram: null };
    }

    // Calculate historical MACD values for signal line calculation
    const macdValues: number[] = [];
    
    // We need enough data points to calculate both EMAs and then the signal line
    for (let i = slowPeriod - 1; i < validPrices.length; i++) {
      const priceSlice = validPrices.slice(0, i + 1);
      const fastEMA = this.calculateEMA(priceSlice, fastPeriod);
      const slowEMA = this.calculateEMA(priceSlice, slowPeriod);
      
      if (fastEMA !== null && slowEMA !== null) {
        macdValues.push(fastEMA - slowEMA);
      }
    }

    if (macdValues.length === 0) {
      return { macd: null, signal: null, histogram: null };
    }

    // Current MACD is the last calculated value
    const macd = macdValues[macdValues.length - 1];
    
    // Calculate signal line as EMA of historical MACD values
    const signal = macdValues.length >= signalPeriod ? this.calculateEMA(macdValues, signalPeriod) : null;
    
    // Calculate histogram (MACD - Signal)
    const histogram = signal !== null ? macd - signal : null;

    return { macd, signal, histogram };
  }

  /**
   * Exponential Moving Average - Standard EMA calculation
   */
  static calculateEMA(prices: number[], period: number): number | null {
    if (!prices || prices.length === 0) {
      return null;
    }

    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length === 0) {
      return null;
    }

    if (validPrices.length === 1) {
      return validPrices[0];
    }

    const multiplier = 2 / (period + 1);
    let ema = validPrices[0]; // Start with first price

    for (let i = 1; i < validPrices.length; i++) {
      ema = (validPrices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Simple Moving Average
   */
  static calculateSMA(prices: number[], period: number): number | null {
    if (!prices || prices.length < period) {
      return null;
    }

    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length < period) {
      return null;
    }

    const recentPrices = validPrices.slice(-period);
    const sum = recentPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Bollinger Bands - Standard 20-period with 2 standard deviations
   */
  static calculateBollingerBands(prices: number[], period: number = 20, stdDevMultiplier: number = 2): {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  } {
    if (!prices || prices.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length < period) {
      return { upper: null, middle: null, lower: null };
    }

    const recentPrices = validPrices.slice(-period);
    const sma = recentPrices.reduce((acc, price) => acc + price, 0) / period;

    // Calculate standard deviation
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + (stdDev * stdDevMultiplier),
      middle: sma,
      lower: sma - (stdDev * stdDevMultiplier)
    };
  }

  /**
   * Stochastic Oscillator - Standard %K and %D calculation
   */
  static calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): {
    k: number | null;
    d: number | null;
  } {
    if (!highs || !lows || !closes || closes.length < kPeriod) {
      return { k: null, d: null };
    }

    // Validate arrays have same length
    const minLength = Math.min(highs.length, lows.length, closes.length);
    if (minLength < kPeriod) {
      return { k: null, d: null };
    }

    // Calculate %K values for recent periods
    const kValues: number[] = [];
    
    for (let i = kPeriod - 1; i < minLength; i++) {
      const periodHighs = highs.slice(i - kPeriod + 1, i + 1);
      const periodLows = lows.slice(i - kPeriod + 1, i + 1);
      
      const highestHigh = Math.max(...periodHighs);
      const lowestLow = Math.min(...periodLows);
      
      if (highestHigh === lowestLow) {
        kValues.push(50); // Avoid division by zero
      } else {
        const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
        kValues.push(Math.max(0, Math.min(100, k)));
      }
    }

    if (kValues.length === 0) {
      return { k: null, d: null };
    }

    // Current %K is the last calculated value
    const currentK = kValues[kValues.length - 1];

    // %D is the SMA of recent %K values
    let currentD: number | null = null;
    if (kValues.length >= dPeriod) {
      const recentK = kValues.slice(-dPeriod);
      currentD = recentK.reduce((acc, k) => acc + k, 0) / dPeriod;
    }

    return { k: currentK, d: currentD };
  }

  /**
   * Volatility Calculation - Standard price volatility
   */
  static calculateVolatility(prices: number[], period: number = 20): number | null {
    if (!prices || prices.length < 2) {
      return null;
    }

    const validPrices = prices.filter(p => !isNaN(p) && p > 0);
    if (validPrices.length < 2) {
      return null;
    }

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < validPrices.length; i++) {
      const returnValue = (validPrices[i] - validPrices[i - 1]) / validPrices[i - 1];
      returns.push(returnValue);
    }

    if (returns.length === 0) {
      return null;
    }

    // Calculate standard deviation of returns
    const avgReturn = returns.reduce((acc, ret) => acc + ret, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    return Math.max(0, volatility);
  }

  /**
   * Create null indicators object when data is insufficient
   */
  private static createNullIndicators(): TechnicalIndicators {
    return {
      rsi: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      bollingerUpper: null,
      bollingerMiddle: null,
      bollingerLower: null,
      stochasticK: null,
      stochasticD: null,
      ema9: null,
      ema21: null,
      ema50: null,
      sma20: null,
      volatility: null
    };
  }

  /**
   * Validate calculated indicators for sanity
   */
  static validateIndicators(indicators: TechnicalIndicators): boolean {
    // Check RSI bounds
    if (indicators.rsi !== null && (indicators.rsi < 0 || indicators.rsi > 100)) {
      console.error(`❌ [VALIDATION] Invalid RSI: ${indicators.rsi}`);
      return false;
    }

    // Check Stochastic bounds
    if (indicators.stochasticK !== null && (indicators.stochasticK < 0 || indicators.stochasticK > 100)) {
      console.error(`❌ [VALIDATION] Invalid Stochastic K: ${indicators.stochasticK}`);
      return false;
    }

    if (indicators.stochasticD !== null && (indicators.stochasticD < 0 || indicators.stochasticD > 100)) {
      console.error(`❌ [VALIDATION] Invalid Stochastic D: ${indicators.stochasticD}`);
      return false;
    }

    // Check for NaN values
    for (const [key, value] of Object.entries(indicators)) {
      if (value !== null && isNaN(value)) {
        console.error(`❌ [VALIDATION] NaN value for ${key}: ${value}`);
        return false;
      }
    }

    return true;
  }
}