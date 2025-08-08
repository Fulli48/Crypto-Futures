import { db } from './db';
import { tradeSimulations, learningWeights, rollingChartData } from '../shared/schema';
import { eq, desc, and, gte, ne, sql } from 'drizzle-orm';
import { marketConditionAnalyzer, MarketCondition } from './market-condition-analyzer';
import { successScorePredictor, SuccessScorePrediction } from './success-score-predictor';

/**
 * ENHANCED TRADING ENGINE
 * 
 * This replaces the gambling-level trading system with calculated algorithmic trading
 * that uses market condition analysis, dynamic risk/reward ratios, and proper entry timing.
 */

export interface EnhancedTradeSignal {
  symbol: string;
  signal: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  profitLikelihood: number;
  entryScore: number; // 0-100 optimal entry timing score
  dynamicTP: number;   // Dynamic take profit percentage
  dynamicSL: number;   // Dynamic stop loss percentage
  riskRewardRatio: number;
  marketCondition: MarketCondition;
  successScorePrediction: SuccessScorePrediction; // NEW: Success score prediction
  reasoning: string;
  shouldCreateTrade: boolean; // Only true for high-quality setups with positive success score potential
}

export class EnhancedTradingEngine {
  private readonly MINIMUM_ENTRY_SCORE = 35; // Lowered to allow more diversity across cryptocurrencies
  private readonly MINIMUM_MARKET_SCORE = 30; // Lowered to enable trades for all 6 approved symbols  
  private readonly MINIMUM_CONFIDENCE = 45;   // Lowered from 70% to 45% to match actual ML signal range
  private readonly MINIMUM_CHART_DATA_POINTS = 20; // Reduced from 60 to 20 minutes for faster trade creation
  private readonly PER_SYMBOL_LEARNING_THRESHOLD = 1; // Reduced from 3 to 1 trade for immediate learning activation
  private readonly MINIMUM_RR_RATIO = 1.0;    // Reduced to 1.0 to allow more trading opportunities
  private readonly MINIMUM_SUCCESS_SCORE_PREDICTION = 0.0; // Allow all success score predictions
  private readonly MINIMUM_SUCCESS_PROBABILITY = 20.0;     // Reduced to enable more trading activity

  /**
   * Generate enhanced trading signal with market condition analysis
   */
  async generateEnhancedSignal(symbol: string, ohlcvData: any): Promise<EnhancedTradeSignal> {
    try {
      console.log(`🎯 [ENHANCED ENGINE] Analyzing ${symbol} for high-quality trade setup...`);

      // Step 1: Analyze market conditions
      const marketCondition = await marketConditionAnalyzer.analyzeMarketConditions(symbol, ohlcvData);
      
      // Step 2: Calculate entry timing score
      const entryScore = this.calculateEntryTimingScore(marketCondition);
      
      // Step 3: Generate base ML confidence and profit likelihood
      const baseMLSignal = await this.generateBaseMLSignal(symbol, marketCondition);
      
      // Step 4: Apply market condition enhancements
      const enhancedSignal = this.applyMarketEnhancements(baseMLSignal, marketCondition, entryScore);
      
      // Step 5: NEW - Predict success score likelihood
      const successScorePrediction = await successScorePredictor.predictTradeSuccessScore(
        symbol,
        enhancedSignal.signal as 'LONG' | 'SHORT',
        marketCondition,
        enhancedSignal.confidence,
        enhancedSignal.profitLikelihood
      );
      
      // Step 6: Filter out weak WAIT signals before determining if trade should be created
      // Don't simulate WAIT signals with low confidence - system learns from actionable trades only
      if (enhancedSignal.signal === 'WAIT' && (enhancedSignal.confidence < 70 || enhancedSignal.profitLikelihood < 55)) {
        console.log(`🚫 [WEAK SIGNAL FILTER] ${symbol}: Filtering out weak WAIT signal (${enhancedSignal.confidence}% confidence, ${enhancedSignal.profitLikelihood}% profit) - not actionable for simulation`);
        
        // Return signal for display but mark as not suitable for trade creation
        const signal: EnhancedTradeSignal = {
          symbol,
          signal: enhancedSignal.signal,
          confidence: enhancedSignal.confidence,
          profitLikelihood: enhancedSignal.profitLikelihood,
          entryScore,
          dynamicTP: marketCondition.optimalTPPercent,
          dynamicSL: marketCondition.optimalSLPercent,
          riskRewardRatio: marketCondition.riskRewardRatio,
          marketCondition,
          successScorePrediction,
          reasoning: `WEAK WAIT SIGNAL: ${enhancedSignal.confidence}% confidence, ${enhancedSignal.profitLikelihood}% profit likelihood - not actionable for simulation`,
          shouldCreateTrade: false // Explicitly prevent trade creation
        };
        
        console.log(`🔍 [WEAK SIGNAL FILTER] ${symbol}: Signal available for display but not for simulation learning`);
        return signal;
      }
      
      // Step 7: Determine if trade should be created (now includes success score prediction)
      const shouldCreateTrade = await this.shouldCreateTradeWithSuccessScore(
        enhancedSignal, 
        marketCondition, 
        entryScore, 
        successScorePrediction
      );
      
      const signal: EnhancedTradeSignal = {
        symbol,
        signal: enhancedSignal.signal,
        confidence: enhancedSignal.confidence,
        profitLikelihood: enhancedSignal.profitLikelihood,
        entryScore,
        dynamicTP: marketCondition.optimalTPPercent,
        dynamicSL: marketCondition.optimalSLPercent,
        riskRewardRatio: marketCondition.riskRewardRatio,
        marketCondition,
        successScorePrediction, // NEW: Include success score prediction
        reasoning: this.generateTradeReasoningWithSuccessScore(enhancedSignal, marketCondition, entryScore, successScorePrediction, shouldCreateTrade),
        shouldCreateTrade
      };

      console.log(`📊 [ENHANCED ENGINE] ${symbol}: ${signal.signal} (${signal.confidence.toFixed(1)}% conf, ${signal.profitLikelihood.toFixed(1)}% profit)`);
      console.log(`🎯 [ENHANCED ENGINE] ${symbol}: Entry Score: ${entryScore.toFixed(1)}%, Market Score: ${marketCondition.marketScore.toFixed(1)}%, Create Trade: ${shouldCreateTrade}`);
      console.log(`💰 [ENHANCED ENGINE] ${symbol}: Dynamic TP: ${signal.dynamicTP.toFixed(1)}%, SL: ${signal.dynamicSL.toFixed(1)}%, R/R: ${signal.riskRewardRatio.toFixed(2)}`);

      return signal;

    } catch (error) {
      console.error(`❌ [ENHANCED ENGINE] Error generating signal for ${symbol}:`, error);
      return this.getDefaultSignal(symbol);
    }
  }

  /**
   * Calculate optimal entry timing score based on multiple factors
   */
  private calculateEntryTimingScore(marketCondition: MarketCondition): number {
    let score = 50; // Base score
    
    // Trend alignment (30% of score)
    switch (marketCondition.trend) {
      case 'STRONG_BULLISH':
      case 'STRONG_BEARISH':
        score += 25; // Strong trends are good for entry
        break;
      case 'BULLISH':
      case 'BEARISH':
        score += 15; // Moderate trends are decent
        break;
      case 'NEUTRAL':
        score -= 15; // Avoid choppy markets
        break;
    }
    
    // RSI positioning (20% of score)
    const { rsi } = marketCondition.signals;
    if (rsi > 70 || rsi < 30) {
      score += 15; // Extreme RSI levels good for contrarian plays
    } else if (rsi > 45 && rsi < 55) {
      score -= 10; // Neutral RSI less favorable
    }
    
    // Volatility consideration (20% of score)
    switch (marketCondition.volatility) {
      case 'MEDIUM':
        score += 15; // Optimal volatility
        break;
      case 'HIGH':
        score += 5;  // Higher risk but bigger moves
        break;
      case 'LOW':
        score -= 5;  // Smaller moves
        break;
      case 'EXTREME':
        score -= 15; // Too risky
        break;
    }
    
    // Momentum alignment (20% of score)
    const absMomentum = Math.abs(marketCondition.momentum);
    if (absMomentum > 60) {
      score += 15; // Strong momentum
    } else if (absMomentum < 20) {
      score -= 10; // Weak momentum
    }
    
    // Volume spike bonus (10% of score)
    if (marketCondition.signals.volumeSpike) {
      score += 10; // Volume confirmation
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate base ML signal using historical performance
   */
  private async generateBaseMLSignal(symbol: string, marketCondition: MarketCondition): Promise<{
    signal: 'LONG' | 'SHORT' | 'WAIT';
    confidence: number;
    profitLikelihood: number;
  }> {
    try {
      // Get historical performance for this symbol and market condition
      const historicalPerformance = await this.getHistoricalPerformance(symbol, marketCondition);
      
      // Determine signal direction with balanced LONG/SHORT generation
      let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
      
      // Primary signal generation based on trend
      if (marketCondition.trend === 'STRONG_BULLISH' || marketCondition.trend === 'BULLISH') {
        if (marketCondition.momentum > 10) {
          signal = 'LONG';
        }
      } else if (marketCondition.trend === 'STRONG_BEARISH' || marketCondition.trend === 'BEARISH') {
        if (marketCondition.momentum < -10) {
          signal = 'SHORT';
        }
      }
      
      // Enhanced signal generation for more balanced LONG/SHORT distribution
      if (signal === 'WAIT' && marketCondition.marketScore >= 40) {
        // More aggressive SHORT signal generation to balance LONG bias
        if (marketCondition.momentum > 8) {
          signal = 'LONG';
        } else if (marketCondition.momentum < -3) { // More aggressive SHORT threshold
          signal = 'SHORT';
        }
        // Additional SHORT signals based on technical indicators
        else if (marketCondition.signals.rsi > 65 && marketCondition.momentum < 2) {
          signal = 'SHORT'; // Overbought SHORT opportunity
        }
        // Additional NEUTRAL trend SHORT signals
        else if (marketCondition.trend === 'NEUTRAL' && marketCondition.momentum < -1) {
          signal = 'SHORT'; // Neutral downward momentum
        }
      }
      
      // Calculate confidence based on historical success and current conditions
      let confidence = 45; // Base confidence
      
      // Add historical performance boost
      confidence += historicalPerformance.successRate * 0.3;
      
      // Add market condition boost
      confidence += (marketCondition.marketScore - 50) * 0.4;
      
      // Add trend strength boost
      confidence += marketCondition.signals.trendStrength * 0.2;
      
      // Calculate profit likelihood
      let profitLikelihood = 40; // Base profit likelihood
      
      // Add historical profit boost
      profitLikelihood += historicalPerformance.avgProfitMargin * 100;
      
      // Add volatility boost
      if (marketCondition.volatility === 'MEDIUM' || marketCondition.volatility === 'HIGH') {
        profitLikelihood += 10;
      }
      
      // Add risk/reward boost
      if (marketCondition.riskRewardRatio >= 2.0) {
        profitLikelihood += 15;
      }
      
      return {
        signal,
        confidence: Math.max(30, Math.min(95, confidence)),
        profitLikelihood: Math.max(25, Math.min(90, profitLikelihood))
      };
      
    } catch (error) {
      console.error(`❌ [ENHANCED ENGINE] Error generating base ML signal:`, error);
      return { signal: 'WAIT', confidence: 35, profitLikelihood: 30 };
    }
  }

  /**
   * Get historical performance for similar market conditions
   */
  private async getHistoricalPerformance(symbol: string, marketCondition: MarketCondition): Promise<{
    successRate: number;
    avgProfitMargin: number;
    sampleSize: number;
  }> {
    try {
      // Get recent completed trades for this symbol
      const recentTrades = await db.select()
        .from(tradeSimulations)
        .where(and(
          eq(tradeSimulations.symbol, symbol),
          ne(tradeSimulations.actualOutcome, 'IN_PROGRESS')
        ))
        .orderBy(desc(tradeSimulations.createdAt))
        .limit(20);

      if (recentTrades.length < 3) {
        return { successRate: 35, avgProfitMargin: 0.005, sampleSize: 0 };
      }

      // Calculate success rate using the same threshold as main system
      const successfulTrades = recentTrades.filter(trade => {
        const successScore = parseFloat(String(trade.successScore || '0'));
        return successScore > 0.005;
      });

      const successRate = (successfulTrades.length / recentTrades.length) * 100;
      
      // Calculate average profit margin
      const avgProfitMargin = recentTrades.reduce((sum, trade) => {
        return sum + (parseFloat(trade.profitLoss || '0') / 100);
      }, 0) / recentTrades.length;

      console.log(`📊 [ENHANCED ENGINE] ${symbol} historical: ${successRate.toFixed(1)}% success, ${(avgProfitMargin * 100).toFixed(2)}% avg profit (${recentTrades.length} trades)`);

      return {
        successRate,
        avgProfitMargin,
        sampleSize: recentTrades.length
      };

    } catch (error) {
      console.error(`❌ [ENHANCED ENGINE] Error getting historical performance:`, error);
      return { successRate: 35, avgProfitMargin: 0.005, sampleSize: 0 };
    }
  }

  /**
   * Apply market condition enhancements to base signal
   */
  private applyMarketEnhancements(
    baseSignal: { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number; profitLikelihood: number },
    marketCondition: MarketCondition,
    entryScore: number
  ): { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number; profitLikelihood: number } {
    
    let enhancedConfidence = baseSignal.confidence;
    let enhancedProfitLikelihood = baseSignal.profitLikelihood;
    
    // Apply entry timing enhancement
    const entryMultiplier = entryScore / 100;
    enhancedConfidence *= (0.7 + entryMultiplier * 0.6); // Scale by entry quality
    enhancedProfitLikelihood *= (0.8 + entryMultiplier * 0.4);
    
    // Apply market score enhancement
    const marketMultiplier = marketCondition.marketScore / 100;
    enhancedConfidence *= (0.8 + marketMultiplier * 0.4);
    enhancedProfitLikelihood *= (0.9 + marketMultiplier * 0.2);
    
    // Apply volatility adjustment
    switch (marketCondition.volatility) {
      case 'LOW':
        enhancedConfidence *= 0.9;
        enhancedProfitLikelihood *= 0.8;
        break;
      case 'HIGH':
        enhancedConfidence *= 1.1;
        enhancedProfitLikelihood *= 1.2;
        break;
      case 'EXTREME':
        enhancedConfidence *= 0.8;
        enhancedProfitLikelihood *= 0.9;
        break;
    }
    
    return {
      signal: baseSignal.signal,
      confidence: Math.max(20, Math.min(95, enhancedConfidence)),
      profitLikelihood: Math.max(15, Math.min(90, enhancedProfitLikelihood))
    };
  }

  /**
   * Check if sufficient chart data is available for reliable trading
   */
  private async hasMinimumChartData(symbol: string): Promise<boolean> {
    try {
      const chartDataCount = await db.select({ count: sql`count(*)`.as('count') })
        .from(rollingChartData)
        .where(eq(rollingChartData.symbol, symbol));
      
      const currentDataPoints = parseInt(chartDataCount[0]?.count as string || '0');
      
      if (currentDataPoints < this.MINIMUM_CHART_DATA_POINTS) {
        console.log(`❌ [CHART DATA CHECK] ${symbol}: Insufficient data ${currentDataPoints}/${this.MINIMUM_CHART_DATA_POINTS} minutes`);
        return false;
      }
      
      console.log(`✅ [CHART DATA CHECK] ${symbol}: Sufficient data ${currentDataPoints}/${this.MINIMUM_CHART_DATA_POINTS} minutes`);
      return true;
      
    } catch (error) {
      console.error(`❌ [CHART DATA CHECK] Error checking ${symbol}:`, error);
      return false;
    }
  }

  /**
   * NEW: Determine if trade should be created based on all criteria INCLUDING success score prediction
   */
  private async shouldCreateTradeWithSuccessScore(
    signal: any,
    marketCondition: MarketCondition,
    entryScore: number,
    successScorePrediction: SuccessScorePrediction
  ): Promise<boolean> {
    // Must have directional signal (not WAIT)
    if (signal.signal === 'WAIT') return false;
    
    // Must have sufficient chart data first
    const hasChartData = await this.hasMinimumChartData(marketCondition.symbol);
    if (!hasChartData) return false;
    
    // Must meet minimum confidence threshold
    if (signal.confidence < this.MINIMUM_CONFIDENCE) return false;
    
    // NEW: Must have favorable success score prediction
    if (successScorePrediction.predictedSuccessScore < this.MINIMUM_SUCCESS_SCORE_PREDICTION) {
      console.log(`❌ [SUCCESS PREDICTOR] Predicted success score ${successScorePrediction.predictedSuccessScore.toFixed(1)}% < ${this.MINIMUM_SUCCESS_SCORE_PREDICTION}% threshold`);
      return false;
    }
    
    // NEW: Must have decent success probability
    if (successScorePrediction.successProbability < this.MINIMUM_SUCCESS_PROBABILITY) {
      console.log(`❌ [SUCCESS PREDICTOR] Success probability ${successScorePrediction.successProbability.toFixed(1)}% < ${this.MINIMUM_SUCCESS_PROBABILITY}% threshold`);
      return false;
    }
    
    // Must have favorable market conditions (relaxed threshold for learning)
    if (marketCondition.marketScore < this.MINIMUM_MARKET_SCORE) return false;
    
    // Must have good entry timing (relaxed threshold for learning)
    if (entryScore < this.MINIMUM_ENTRY_SCORE) return false;
    
    // Must have acceptable risk/reward
    if (marketCondition.riskRewardRatio < this.MINIMUM_RR_RATIO) return false;
    
    console.log(`✅ [SUCCESS PREDICTOR] Trade approved: ${successScorePrediction.predictedSuccessScore.toFixed(1)}% predicted success score, ${successScorePrediction.successProbability.toFixed(1)}% probability`);
    
    return true;
  }

  /**
   * LEGACY: Determine if trade should be created based on strict quality criteria
   */
  private shouldCreateTrade(
    enhancedSignal: { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number; profitLikelihood: number },
    marketCondition: MarketCondition,
    entryScore: number
  ): boolean {
    
    // Never create WAIT signals
    if (enhancedSignal.signal === 'WAIT') {
      return false;
    }
    
    // Check minimum thresholds
    const meetsCriteria = 
      enhancedSignal.confidence >= this.MINIMUM_CONFIDENCE &&
      entryScore >= this.MINIMUM_ENTRY_SCORE &&
      marketCondition.marketScore >= this.MINIMUM_MARKET_SCORE &&
      marketCondition.riskRewardRatio >= this.MINIMUM_RR_RATIO;
    
    if (meetsCriteria) {
      console.log(`✅ [ENHANCED ENGINE] High-quality setup detected - creating trade`);
      console.log(`   Confidence: ${enhancedSignal.confidence.toFixed(1)}% (≥${this.MINIMUM_CONFIDENCE}%)`);
      console.log(`   Entry Score: ${entryScore.toFixed(1)}% (≥${this.MINIMUM_ENTRY_SCORE}%)`);
      console.log(`   Market Score: ${marketCondition.marketScore.toFixed(1)}% (≥${this.MINIMUM_MARKET_SCORE}%)`);
      console.log(`   Risk/Reward: ${marketCondition.riskRewardRatio.toFixed(2)} (≥${this.MINIMUM_RR_RATIO})`);
    } else {
      console.log(`❌ [ENHANCED ENGINE] Setup doesn't meet quality criteria - skipping trade`);
      console.log(`   Confidence: ${enhancedSignal.confidence.toFixed(1)}% (need ≥${this.MINIMUM_CONFIDENCE}%)`);
      console.log(`   Entry Score: ${entryScore.toFixed(1)}% (need ≥${this.MINIMUM_ENTRY_SCORE}%)`);
      console.log(`   Market Score: ${marketCondition.marketScore.toFixed(1)}% (need ≥${this.MINIMUM_MARKET_SCORE}%)`);
      console.log(`   Risk/Reward: ${marketCondition.riskRewardRatio.toFixed(2)} (need ≥${this.MINIMUM_RR_RATIO})`);
    }
    
    return meetsCriteria;
  }

  /**
   * NEW: Generate comprehensive reasoning for the trade decision WITH success score prediction
   */
  private generateTradeReasoningWithSuccessScore(
    enhancedSignal: { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number; profitLikelihood: number },
    marketCondition: MarketCondition,
    entryScore: number,
    successScorePrediction: SuccessScorePrediction,
    shouldCreateTrade: boolean
  ): string {
    
    const quality = shouldCreateTrade ? 'HIGH-QUALITY' : 'LOW-QUALITY';
    const decision = shouldCreateTrade ? 'TRADE CREATED' : 'TRADE SKIPPED';
    
    return `${quality} SETUP: ${enhancedSignal.signal} signal with ${enhancedSignal.confidence.toFixed(1)}% confidence. ` +
           `Success Prediction: ${successScorePrediction.predictedSuccessScore.toFixed(1)}% score, ${successScorePrediction.successProbability.toFixed(1)}% probability. ` +
           `Market conditions: ${marketCondition.trend} trend, ${marketCondition.volatility} volatility. ` +
           `Entry timing: ${entryScore.toFixed(1)}%. Risk/Reward: ${marketCondition.riskRewardRatio.toFixed(2)}. ` +
           `${decision}.`;
  }

  /**
   * LEGACY: Generate comprehensive reasoning for the trade decision
   */
  private generateTradeReasoning(
    enhancedSignal: { signal: 'LONG' | 'SHORT' | 'WAIT'; confidence: number; profitLikelihood: number },
    marketCondition: MarketCondition,
    entryScore: number,
    shouldCreateTrade: boolean
  ): string {
    
    const quality = shouldCreateTrade ? 'HIGH-QUALITY' : 'LOW-QUALITY';
    const decision = shouldCreateTrade ? 'TRADE CREATED' : 'TRADE SKIPPED';
    
    return `${quality} SETUP: ${enhancedSignal.signal} signal with ${enhancedSignal.confidence.toFixed(1)}% confidence. ` +
           `Market conditions: ${marketCondition.trend} trend, ${marketCondition.volatility} volatility. ` +
           `Entry timing: ${entryScore.toFixed(1)}%. Risk/Reward: ${marketCondition.riskRewardRatio.toFixed(2)}. ` +
           `${decision}.`;
  }

  /**
   * Get default signal when analysis fails
   */
  private getDefaultSignal(symbol: string): EnhancedTradeSignal {
    return {
      symbol,
      signal: 'WAIT',
      confidence: 30,
      profitLikelihood: 25,
      entryScore: 30,
      dynamicTP: 2.0,
      dynamicSL: 1.0,
      riskRewardRatio: 2.0,
      marketCondition: {
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
        reasoning: 'Default analysis due to error'
      },
      successScorePrediction: {
        predictedSuccessScore: 0,
        successProbability: 0,
        confidenceLevel: 0,
        keyFactors: {
          timeInProfitScore: 0,
          profitPotentialScore: 0,
          riskScore: 0,
          marketAlignmentScore: 0
        },
        reasoning: 'Default prediction due to error',
        shouldPrioritize: false
      },
      reasoning: 'Default signal due to analysis error - trade skipped for safety',
      shouldCreateTrade: false
    };
  }
}

export const enhancedTradingEngine = new EnhancedTradingEngine();

/**
 * Standalone function to create enhanced trade from signal data
 */
export async function createEnhancedTrade(marketData: any): Promise<{ success: boolean; tradeId?: number; error?: string }> {
  try {
    // CRITICAL FIX: Check for existing active trades for this symbol
    const existingActiveTrades = await db.select({ count: sql`count(*)`.as('count') })
      .from(tradeSimulations)
      .where(
        and(
          eq(tradeSimulations.symbol, marketData.symbol),
          sql`${tradeSimulations.completedAt} IS NULL` // Only active (non-completed) trades
        )
      );
    
    const activeTradeCount = parseInt(existingActiveTrades[0]?.count as string || '0');
    
    if (activeTradeCount > 0) {
      console.log(`🚫 [TRADE BLOCKED] ${marketData.symbol}: Already has ${activeTradeCount} active trades - skipping new trade creation`);
      return {
        success: false,
        error: `Symbol ${marketData.symbol} already has ${activeTradeCount} active trades. Only 1 active trade per symbol allowed.`
      };
    }

    // Calculate position size and trade parameters
    const entryPrice = marketData.price;
    const isLong = marketData.signal === 'LONG';
    
    // Use provided TP/SL levels
    const takeProfitPrice = marketData.takeProfit;
    const stopLossPrice = marketData.stopLoss;
    
    // Calculate position size based on risk
    const accountBalance = 10000; // Default account balance
    const riskPercentage = 1; // 1% risk per trade
    const riskAmount = accountBalance * (riskPercentage / 100);
    
    const slDistance = Math.abs(entryPrice - stopLossPrice);
    const positionSize = riskAmount / slDistance;
    
    // Create trade record
    const newTradeData = {
      symbol: marketData.symbol,
      signalType: marketData.signal as 'LONG' | 'SHORT', // Required signal_type field
      confidence: marketData.confidence,
      profitLikelihood: marketData.profitLikelihood,
      entryPrice: entryPrice.toString(),
      tpPrice: takeProfitPrice.toString(),
      slPrice: stopLossPrice.toString(),
      amount: positionSize.toString()
    };

    // Insert into database
    const [insertedTrade] = await db.insert(tradeSimulations).values(newTradeData).returning();

    console.log(`🎯 [ENHANCED TRADE] Created trade #${insertedTrade.id} for ${marketData.symbol} ${marketData.signal} at ${entryPrice}`);

    return {
      success: true,
      tradeId: insertedTrade.id
    };

  } catch (error) {
    console.error(`❌ [ENHANCED TRADE] Error creating trade:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Standalone function to check if trade should be created based on success score prediction
 */
export async function shouldCreateTradeWithSuccessScore(marketData: any): Promise<{ shouldCreate: boolean; reason: string }> {
  try {
    // Basic validation
    if (marketData.signal === 'WAIT') {
      return { shouldCreate: false, reason: 'WAIT signal - no trade needed' };
    }

    if (marketData.confidence < 60) {
      return { shouldCreate: false, reason: `Confidence ${marketData.confidence}% below 60% threshold` };
    }

    // Check if we have enough chart data
    const chartDataCount = await db.select({ count: sql`count(*)`.as('count') })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, marketData.symbol));
    
    const currentDataPoints = parseInt(chartDataCount[0]?.count as string || '0');
    
    if (currentDataPoints < 20) {
      return { shouldCreate: false, reason: `Insufficient chart data: ${currentDataPoints}/20 minutes` };
    }

    // All checks passed
    console.log(`✅ [TRADE APPROVAL] ${marketData.symbol} ${marketData.signal} approved for trade creation (${marketData.confidence}% confidence)`);
    return { shouldCreate: true, reason: 'All criteria met for high-quality trade' };

  } catch (error) {
    console.error(`❌ [TRADE APPROVAL] Error checking trade criteria:`, error);
    return { shouldCreate: false, reason: 'Error during validation' };
  }
}