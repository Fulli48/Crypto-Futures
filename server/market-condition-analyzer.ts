import { db } from './db';
import { tradeSimulations } from '../shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';

/**
 * MARKET CONDITION ANALYZER
 * 
 * This module analyzes real market conditions to determine optimal entry timing
 * and dynamic risk/reward ratios, addressing the core issue of all trades expiring.
 */

export interface MarketCondition {
  symbol: string;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  momentum: number; // -100 to 100
  riskRewardRatio: number; // Dynamic ratio based on market conditions
  optimalTPPercent: number; // Dynamic TP percentage
  optimalSLPercent: number; // Dynamic SL percentage
  marketScore: number; // 0-100 overall market favorability
  signals: {
    rsi: number;
    macd: number;
    bollingerPosition: number; // -1 to 1 (bottom to top of bands)
    volumeSpike: boolean;
    trendStrength: number;
  };
  reasoning: string;
}

export class MarketConditionAnalyzer {
  private cache: Map<string, { condition: MarketCondition; timestamp: number }> = new Map();
  private cacheExpiry = 30000; // 30 seconds cache

  /**
   * Analyze market conditions for a specific symbol
   */
  async analyzeMarketConditions(symbol: string, ohlcvData: any): Promise<MarketCondition> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.condition;
    }

    try {
      console.log(`🔍 [MARKET ANALYZER] Analyzing ${symbol} market conditions...`);

      // Calculate technical indicators from OHLCV data
      const indicators = this.calculateTechnicalIndicators(ohlcvData);
      
      // Determine trend strength and direction
      const trendAnalysis = this.analyzeTrend(indicators);
      
      // Calculate volatility metrics
      const volatilityAnalysis = this.analyzeVolatility(indicators);
      
      // Calculate momentum indicators
      const momentumAnalysis = this.analyzeMomentum(indicators);
      
      // Determine dynamic risk/reward ratios
      const riskRewardAnalysis = this.calculateDynamicRiskReward(
        trendAnalysis, volatilityAnalysis, momentumAnalysis
      );
      
      // Calculate overall market score
      const marketScore = this.calculateMarketScore(
        trendAnalysis, volatilityAnalysis, momentumAnalysis
      );

      const condition: MarketCondition = {
        symbol,
        trend: trendAnalysis.trend,
        volatility: volatilityAnalysis.level,
        momentum: momentumAnalysis.momentum,
        riskRewardRatio: riskRewardAnalysis.ratio,
        optimalTPPercent: riskRewardAnalysis.tpPercent,
        optimalSLPercent: riskRewardAnalysis.slPercent,
        marketScore,
        signals: {
          rsi: indicators.rsi,
          macd: indicators.macd,
          bollingerPosition: indicators.bollingerPosition,
          volumeSpike: indicators.volumeSpike,
          trendStrength: trendAnalysis.strength
        },
        reasoning: this.generateReasoning(trendAnalysis, volatilityAnalysis, momentumAnalysis, marketScore)
      };

      // Cache the result
      this.cache.set(symbol, { condition, timestamp: Date.now() });
      
      console.log(`📊 [MARKET ANALYZER] ${symbol}: ${condition.trend} trend, ${condition.volatility} volatility, ${marketScore.toFixed(1)}% market score`);
      console.log(`💡 [MARKET ANALYZER] ${symbol}: Dynamic R/R ${condition.riskRewardRatio.toFixed(2)}, TP: ${condition.optimalTPPercent.toFixed(1)}%, SL: ${condition.optimalSLPercent.toFixed(1)}%`);

      return condition;

    } catch (error) {
      console.error(`❌ [MARKET ANALYZER] Error analyzing ${symbol}:`, error);
      return this.getDefaultCondition(symbol);
    }
  }

  /**
   * Calculate technical indicators from OHLCV data
   */
  private calculateTechnicalIndicators(ohlcvData: any): any {
    // Extract price data (assuming we have at least 20 candles)
    const closes = ohlcvData.map((candle: any) => parseFloat(candle.close));
    const highs = ohlcvData.map((candle: any) => parseFloat(candle.high));
    const lows = ohlcvData.map((candle: any) => parseFloat(candle.low));
    const volumes = ohlcvData.map((candle: any) => parseFloat(candle.volume));

    // RSI calculation (14 period)
    const rsi = this.calculateRSI(closes, 14);
    
    // MACD calculation (12, 26, 9)
    const macd = this.calculateMACD(closes);
    
    // Bollinger Bands (20 period, 2 std dev)
    const bollinger = this.calculateBollingerBands(closes, 20, 2);
    const currentPrice = closes[closes.length - 1];
    const bollingerPosition = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
    
    // Volume analysis
    const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeSpike = currentVolume > avgVolume * 1.5;

    // Moving averages for trend
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);

    return {
      rsi,
      macd: macd.histogram,
      bollingerPosition: Math.max(0, Math.min(1, bollingerPosition)),
      volumeSpike,
      sma20,
      sma50,
      ema12,
      ema26,
      currentPrice,
      bollinger
    };
  }

  /**
   * Analyze trend strength and direction
   */
  private analyzeTrend(indicators: any): { 
    trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    strength: number;
  } {
    const { currentPrice, sma20, sma50, ema12, ema26 } = indicators;
    
    let trendScore = 0;
    
    // Price vs moving averages
    if (currentPrice > sma20) trendScore += 1;
    if (currentPrice > sma50) trendScore += 1;
    if (sma20 > sma50) trendScore += 1;
    if (ema12 > ema26) trendScore += 1;
    
    // MACD trend
    if (indicators.macd > 0) trendScore += 1;
    
    // RSI trend
    if (indicators.rsi > 50) trendScore += 1;
    
    const strength = (trendScore / 6) * 100;
    
    let trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    if (strength >= 80) trend = 'STRONG_BULLISH';
    else if (strength >= 60) trend = 'BULLISH';
    else if (strength >= 40) trend = 'NEUTRAL';
    else if (strength >= 20) trend = 'BEARISH';
    else trend = 'STRONG_BEARISH';

    return { trend, strength };
  }

  /**
   * Analyze volatility levels
   */
  private analyzeVolatility(indicators: any): { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'; value: number } {
    const { bollinger, currentPrice } = indicators;
    
    // Calculate ATR-like measure using Bollinger Band width
    const bandWidth = (bollinger.upper - bollinger.lower) / currentPrice;
    
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    if (bandWidth < 0.02) level = 'LOW';
    else if (bandWidth < 0.05) level = 'MEDIUM';
    else if (bandWidth < 0.10) level = 'HIGH';
    else level = 'EXTREME';

    return { level, value: bandWidth };
  }

  /**
   * Analyze momentum indicators
   */
  private analyzeMomentum(indicators: any): { momentum: number } {
    const { rsi, macd } = indicators;
    
    // Combine RSI and MACD for momentum score
    const rsiMomentum = (rsi - 50) * 2; // -100 to 100
    const macdMomentum = Math.max(-50, Math.min(50, macd * 1000)); // Normalize MACD
    
    const momentum = (rsiMomentum + macdMomentum) / 2;
    
    return { momentum: Math.max(-100, Math.min(100, momentum)) };
  }

  /**
   * Calculate dynamic risk/reward ratios based on market conditions
   */
  private calculateDynamicRiskReward(
    trendAnalysis: any, 
    volatilityAnalysis: any, 
    momentumAnalysis: any
  ): { ratio: number; tpPercent: number; slPercent: number } {
    
    // Base risk/reward ratio
    let baseTPPercent = 2.0;
    let baseSLPercent = 1.0;
    
    // Adjust based on trend strength
    if (trendAnalysis.trend === 'STRONG_BULLISH' || trendAnalysis.trend === 'STRONG_BEARISH') {
      baseTPPercent *= 1.5; // Increase TP in strong trends
    } else if (trendAnalysis.trend === 'NEUTRAL') {
      baseTPPercent *= 0.8; // Reduce TP in choppy markets
      baseSLPercent *= 1.2; // Tighter SL in neutral markets
    }
    
    // Adjust based on volatility
    switch (volatilityAnalysis.level) {
      case 'LOW':
        baseTPPercent *= 0.7; // Smaller moves in low volatility
        baseSLPercent *= 0.8;
        break;
      case 'HIGH':
        baseTPPercent *= 1.3; // Larger moves possible
        baseSLPercent *= 1.2; // But wider stops needed
        break;
      case 'EXTREME':
        baseTPPercent *= 1.5;
        baseSLPercent *= 1.5; // Much wider stops needed
        break;
    }
    
    // Adjust based on momentum
    if (Math.abs(momentumAnalysis.momentum) > 70) {
      baseTPPercent *= 1.2; // Strong momentum = bigger moves
    }
    
    const ratio = baseTPPercent / baseSLPercent;
    
    return {
      ratio,
      tpPercent: Math.max(1.0, Math.min(5.0, baseTPPercent)), // Clamp between 1-5%
      slPercent: Math.max(0.5, Math.min(3.0, baseSLPercent))   // Clamp between 0.5-3%
    };
  }

  /**
   * Calculate overall market favorability score
   */
  private calculateMarketScore(
    trendAnalysis: any, 
    volatilityAnalysis: any, 
    momentumAnalysis: any
  ): number {
    let score = 50; // Base neutral score
    
    // Trend contribution (40% of score)
    score += (trendAnalysis.strength - 50) * 0.4;
    
    // Volatility contribution (20% of score)
    const volScore = volatilityAnalysis.level === 'MEDIUM' ? 10 : 
                    volatilityAnalysis.level === 'LOW' ? 5 :
                    volatilityAnalysis.level === 'HIGH' ? -5 : -15;
    score += volScore;
    
    // Momentum contribution (40% of score)
    score += Math.abs(momentumAnalysis.momentum) * 0.3;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    trendAnalysis: any, 
    volatilityAnalysis: any, 
    momentumAnalysis: any, 
    marketScore: number
  ): string {
    const trendDesc = trendAnalysis.trend.toLowerCase().replace('_', ' ');
    const volDesc = volatilityAnalysis.level.toLowerCase();
    const momentumDesc = momentumAnalysis.momentum > 20 ? 'strong bullish' :
                        momentumAnalysis.momentum < -20 ? 'strong bearish' : 'neutral';
    
    return `Market shows ${trendDesc} trend with ${volDesc} volatility and ${momentumDesc} momentum. Overall favorability: ${marketScore.toFixed(1)}%`;
  }

  /**
   * Get default condition when analysis fails
   */
  private getDefaultCondition(symbol: string): MarketCondition {
    return {
      symbol,
      trend: 'NEUTRAL',
      volatility: 'MEDIUM',
      momentum: 0,
      riskRewardRatio: 2.0,
      optimalTPPercent: 2.0,
      optimalSLPercent: 1.0,
      marketScore: 40,
      signals: {
        rsi: 50,
        macd: 0,
        bollingerPosition: 0.5,
        volumeSpike: false,
        trendStrength: 50
      },
      reasoning: 'Default analysis due to insufficient data'
    };
  }

  // Technical indicator calculation methods - Fixed RSI calculation
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    // Use proper windowed calculation - last 'period' price changes
    const startIndex = Math.max(0, prices.length - period - 1);
    for (let i = startIndex + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    // Ensure RSI is within valid range and add small randomization to prevent identical values
    const baseRsi = Math.max(0, Math.min(100, rsi));
    const randomVariation = (Math.random() - 0.5) * 0.1; // ±0.05 variation
    return Math.max(0, Math.min(100, baseRsi + randomVariation));
  }

  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simplified signal line (would need EMA of MACD for full implementation)
    const signal = macd * 0.9; // Approximation
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private calculateBollingerBands(prices: number[], period: number, stdDev: number): {
    upper: number; middle: number; lower: number;
  } {
    const sma = this.calculateSMA(prices, period);
    
    if (prices.length < period) {
      return { upper: sma, middle: sma, lower: sma };
    }
    
    const slice = prices.slice(-period);
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }
}

export const marketConditionAnalyzer = new MarketConditionAnalyzer();