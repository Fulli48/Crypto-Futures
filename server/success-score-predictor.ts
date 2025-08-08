/**
 * SUCCESS SCORE PREDICTION ENGINE
 * 
 * Predicts the likelihood of a trade achieving a positive success score before creation.
 * Uses market conditions, technical indicators, and historical patterns to estimate
 * the potential for:
 * 1. High time-in-profit ratio (40% weight)
 * 2. Positive profit achievement (30% weight) 
 * 3. High max favorable excursion (15% weight)
 * 4. Low max drawdown penalty (15% weight)
 */

import { db } from './db';
import { tradeSimulations } from '../shared/schema';
import { eq, desc, and, gte, ne, sql } from 'drizzle-orm';
import { MarketCondition } from './market-condition-analyzer';

export interface SuccessScorePrediction {
  predictedSuccessScore: number;   // Estimated success score (0-100)
  successProbability: number;      // Probability of positive success score (0-100)
  confidenceLevel: number;         // Prediction confidence (0-100)
  keyFactors: {
    timeInProfitScore: number;     // Predicted time-in-profit contribution
    profitPotentialScore: number;  // Predicted profit contribution
    riskScore: number;             // Risk assessment score
    marketAlignmentScore: number;  // Market condition alignment
  };
  reasoning: string;
  shouldPrioritize: boolean;       // True if this trade should be prioritized
}

export class SuccessScorePredictor {
  private readonly SUCCESS_THRESHOLD = 0.5;  // 0.5% success score threshold
  private readonly HIGH_PRIORITY_THRESHOLD = 15.0; // 15% predicted success score for prioritization
  
  /**
   * Predict success score likelihood for a potential trade
   */
  async predictTradeSuccessScore(
    symbol: string,
    signal: 'LONG' | 'SHORT',
    marketCondition: MarketCondition,
    confidence: number,
    profitLikelihood: number
  ): Promise<SuccessScorePrediction> {
    try {
      console.log(`🎯 [SUCCESS PREDICTOR] Analyzing ${symbol} ${signal} for success score potential...`);

      // Get historical performance patterns for this symbol and signal type
      const historicalPerformance = await this.getHistoricalPerformance(symbol, signal);
      
      // Calculate individual success score components
      const timeInProfitScore = this.predictTimeInProfitScore(marketCondition, signal, historicalPerformance);
      const profitPotentialScore = this.predictProfitPotentialScore(marketCondition, profitLikelihood, historicalPerformance);
      const riskScore = this.calculateRiskScore(marketCondition, confidence);
      const marketAlignmentScore = this.calculateMarketAlignmentScore(marketCondition, signal);
      
      // Weighted prediction based on success score formula
      const predictedSuccessScore = this.calculateWeightedSuccessScore({
        timeInProfitScore,
        profitPotentialScore,
        riskScore,
        marketAlignmentScore
      });
      
      // Calculate probability of achieving positive success score
      const successProbability = this.calculateSuccessProbability(predictedSuccessScore, historicalPerformance);
      
      // Determine prediction confidence
      const confidenceLevel = this.calculatePredictionConfidence(
        historicalPerformance,
        marketCondition,
        confidence
      );
      
      const shouldPrioritize = predictedSuccessScore >= this.HIGH_PRIORITY_THRESHOLD && 
                              successProbability >= 60;
      
      const prediction: SuccessScorePrediction = {
        predictedSuccessScore,
        successProbability,
        confidenceLevel,
        keyFactors: {
          timeInProfitScore,
          profitPotentialScore,
          riskScore,
          marketAlignmentScore
        },
        reasoning: this.generatePredictionReasoning(predictedSuccessScore, successProbability, shouldPrioritize),
        shouldPrioritize
      };

      console.log(`📊 [SUCCESS PREDICTOR] ${symbol} ${signal}: Predicted Score ${predictedSuccessScore.toFixed(1)}%, Success Probability ${successProbability.toFixed(1)}%, Prioritize: ${shouldPrioritize}`);
      
      return prediction;

    } catch (error) {
      console.error(`❌ [SUCCESS PREDICTOR] Error predicting success for ${symbol}:`, error);
      return this.getDefaultPrediction();
    }
  }

  /**
   * Predict time-in-profit ratio contribution (40% weight in success score)
   */
  private predictTimeInProfitScore(
    marketCondition: MarketCondition,
    signal: 'LONG' | 'SHORT',
    historicalPerformance: any
  ): number {
    let score = 40; // Base 40% component weight
    
    // Trend alignment bonus (strong trends tend to have better time-in-profit)
    const trendAlignment = this.getTrendAlignment(marketCondition.trend, signal);
    if (trendAlignment === 'ALIGNED') {
      score += 25; // Strong trend alignment improves time-in-profit
    } else if (trendAlignment === 'OPPOSITE') {
      score -= 20; // Against trend reduces time-in-profit
    }
    
    // Volatility impact on time sustainability
    switch (marketCondition.volatility) {
      case 'LOW':
        score += 10; // Low volatility better for sustained profits
        break;
      case 'HIGH':
      case 'EXTREME':
        score -= 15; // High volatility reduces time-in-profit sustainability
        break;
    }
    
    // Market score impact
    if (marketCondition.marketScore > 70) {
      score += 15; // Strong market conditions improve time-in-profit
    } else if (marketCondition.marketScore < 40) {
      score -= 10; // Weak market conditions reduce time-in-profit
    }
    
    // Historical performance adjustment
    if (historicalPerformance.avgTimeInProfit > 0.5) {
      score += 10; // Good historical time-in-profit performance
    } else if (historicalPerformance.avgTimeInProfit < 0.3) {
      score -= 10; // Poor historical time-in-profit performance
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Predict profit potential contribution (30% weight in success score)
   */
  private predictProfitPotentialScore(
    marketCondition: MarketCondition,
    profitLikelihood: number,
    historicalPerformance: any
  ): number {
    let score = 30; // Base 30% component weight
    
    // Profit likelihood impact
    score += (profitLikelihood - 50) * 0.4; // Scale from ML profit likelihood
    
    // Risk/reward ratio impact
    if (marketCondition.riskRewardRatio > 2.0) {
      score += 15; // High R/R improves profit potential
    } else if (marketCondition.riskRewardRatio < 1.5) {
      score -= 10; // Low R/R reduces profit potential
    }
    
    // Dynamic TP percentage impact
    if (marketCondition.optimalTPPercent > 2.0) {
      score += 10; // Higher TP targets increase profit potential
    }
    
    // Historical profit performance
    if (historicalPerformance.avgProfit > 0) {
      score += 12; // Positive historical profits boost score
    } else if (historicalPerformance.avgProfit < -1.0) {
      score -= 15; // Negative historical profits reduce score
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate risk assessment score (affects drawdown penalty - 15% weight)
   */
  private calculateRiskScore(marketCondition: MarketCondition, confidence: number): number {
    let score = 70; // Base risk score (higher = lower risk)
    
    // Confidence impact on risk
    score += (confidence - 50) * 0.3; // Higher confidence reduces risk
    
    // Volatility risk assessment
    switch (marketCondition.volatility) {
      case 'LOW':
        score += 15; // Low volatility = lower risk
        break;
      case 'HIGH':
        score -= 10; // High volatility = higher risk
        break;
      case 'EXTREME':
        score -= 25; // Extreme volatility = very high risk
        break;
    }
    
    // Market score impact on risk
    if (marketCondition.marketScore > 70) {
      score += 10; // Strong market = lower risk
    } else if (marketCondition.marketScore < 40) {
      score -= 15; // Weak market = higher risk
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate market alignment score for optimal entry
   */
  private calculateMarketAlignmentScore(marketCondition: MarketCondition, signal: 'LONG' | 'SHORT'): number {
    let score = 50; // Base alignment score
    
    // Trend alignment
    const trendAlignment = this.getTrendAlignment(marketCondition.trend, signal);
    if (trendAlignment === 'ALIGNED') {
      score += 30;
    } else if (trendAlignment === 'OPPOSITE') {
      score -= 25;
    }
    
    // RSI alignment for entry timing
    const { rsi } = marketCondition.signals;
    if (signal === 'LONG' && rsi < 40) {
      score += 15; // Oversold good for LONG entries
    } else if (signal === 'SHORT' && rsi > 60) {
      score += 15; // Overbought good for SHORT entries
    }
    
    // Market score alignment
    score += (marketCondition.marketScore - 50) * 0.4;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate weighted success score prediction using component scores
   */
  private calculateWeightedSuccessScore(factors: {
    timeInProfitScore: number;
    profitPotentialScore: number;
    riskScore: number;
    marketAlignmentScore: number;
  }): number {
    // Weight the components similar to actual success score calculation
    const weightedScore = (
      factors.timeInProfitScore * 0.40 +     // Time-in-profit (40% weight)
      factors.profitPotentialScore * 0.30 +  // Profit potential (30% weight)
      factors.marketAlignmentScore * 0.20 +  // Market alignment (20% weight)
      factors.riskScore * 0.10               // Risk score (10% weight)
    );
    
    // Convert to percentage and apply sigmoid curve for realism
    const normalizedScore = weightedScore * 0.4; // Scale down to realistic range
    
    return Math.max(0, Math.min(100, normalizedScore));
  }

  /**
   * Calculate probability of achieving positive success score
   */
  private calculateSuccessProbability(predictedScore: number, historicalPerformance: any): number {
    let probability = predictedScore * 1.2; // Base probability from predicted score
    
    // Historical success rate adjustment
    if (historicalPerformance.successRate > 0.3) {
      probability += 15; // Good historical success rate
    } else if (historicalPerformance.successRate < 0.1) {
      probability -= 20; // Poor historical success rate
    }
    
    // Apply sigmoid curve for realistic probability distribution
    const sigmoid = 1 / (1 + Math.exp(-(predictedScore - 10) / 5));
    probability = sigmoid * 100;
    
    return Math.max(5, Math.min(95, probability));
  }

  /**
   * Calculate prediction confidence level
   */
  private calculatePredictionConfidence(
    historicalPerformance: any,
    marketCondition: MarketCondition,
    mlConfidence: number
  ): number {
    let confidence = 60; // Base confidence
    
    // Historical data availability impact
    if (historicalPerformance.tradeCount > 10) {
      confidence += 20; // More historical data = higher confidence
    } else if (historicalPerformance.tradeCount < 3) {
      confidence -= 15; // Limited historical data reduces confidence
    }
    
    // Market clarity impact
    if (marketCondition.marketScore > 70 || marketCondition.marketScore < 30) {
      confidence += 10; // Clear market conditions increase confidence
    }
    
    // ML confidence impact
    confidence += (mlConfidence - 50) * 0.2;
    
    return Math.max(10, Math.min(95, confidence));
  }

  /**
   * Get historical performance data for symbol and signal type
   */
  private async getHistoricalPerformance(symbol: string, signal: 'LONG' | 'SHORT'): Promise<any> {
    try {
      const trades = await db
        .select({
          successScore: tradeSimulations.successScore,
          timeInProfitRatio: tradeSimulations.timeInProfitRatio,
          highestProfit: tradeSimulations.highestProfit,
          lowestLoss: tradeSimulations.lowestLoss,
          isSuccessful: tradeSimulations.isSuccessful
        })
        .from(tradeSimulations)
        .where(
          and(
            eq(tradeSimulations.symbol, symbol),
            eq(tradeSimulations.signalType, signal),
            ne(tradeSimulations.actualOutcome, 'IN_PROGRESS')
          )
        )
        .limit(50)
        .orderBy(desc(tradeSimulations.createdAt));

      if (trades.length === 0) {
        return {
          tradeCount: 0,
          successRate: 0.2,
          avgTimeInProfit: 0.4,
          avgProfit: -0.5,
          avgSuccessScore: 0
        };
      }

      const successRate = trades.filter(t => t.isSuccessful).length / trades.length;
      const avgTimeInProfit = trades.reduce((sum, t) => sum + (t.timeInProfitRatio || 0), 0) / trades.length;
      const avgProfit = trades.reduce((sum, t) => sum + parseFloat(t.highestProfit || '0'), 0) / trades.length;
      const avgSuccessScore = trades.reduce((sum, t) => sum + (t.successScore || 0), 0) / trades.length;

      return {
        tradeCount: trades.length,
        successRate,
        avgTimeInProfit,
        avgProfit,
        avgSuccessScore
      };

    } catch (error) {
      console.error('Error getting historical performance:', error);
      return {
        tradeCount: 0,
        successRate: 0.2,
        avgTimeInProfit: 0.4,
        avgProfit: -0.5,
        avgSuccessScore: 0
      };
    }
  }

  /**
   * Determine trend alignment with signal direction
   */
  private getTrendAlignment(trend: string, signal: 'LONG' | 'SHORT'): 'ALIGNED' | 'OPPOSITE' | 'NEUTRAL' {
    if (signal === 'LONG') {
      if (trend === 'STRONG_BULLISH' || trend === 'BULLISH') return 'ALIGNED';
      if (trend === 'STRONG_BEARISH' || trend === 'BEARISH') return 'OPPOSITE';
    } else {
      if (trend === 'STRONG_BEARISH' || trend === 'BEARISH') return 'ALIGNED';
      if (trend === 'STRONG_BULLISH' || trend === 'BULLISH') return 'OPPOSITE';
    }
    return 'NEUTRAL';
  }

  /**
   * Generate reasoning text for the prediction
   */
  private generatePredictionReasoning(
    predictedScore: number,
    successProbability: number,
    shouldPrioritize: boolean
  ): string {
    if (shouldPrioritize) {
      return `HIGH PRIORITY: Predicted success score ${predictedScore.toFixed(1)}% with ${successProbability.toFixed(1)}% success probability. Strong potential for positive success score with favorable market conditions and risk/reward alignment.`;
    } else if (predictedScore > 8) {
      return `MODERATE POTENTIAL: Predicted success score ${predictedScore.toFixed(1)}% with ${successProbability.toFixed(1)}% success probability. Decent setup with some positive success score potential.`;
    } else {
      return `LOW PRIORITY: Predicted success score ${predictedScore.toFixed(1)}% with ${successProbability.toFixed(1)}% success probability. Limited potential for positive success score due to market conditions or risk factors.`;
    }
  }

  /**
   * Default prediction for error cases
   */
  private getDefaultPrediction(): SuccessScorePrediction {
    return {
      predictedSuccessScore: 5,
      successProbability: 25,
      confidenceLevel: 30,
      keyFactors: {
        timeInProfitScore: 30,
        profitPotentialScore: 20,
        riskScore: 50,
        marketAlignmentScore: 40
      },
      reasoning: 'Unable to calculate success prediction - using conservative estimates',
      shouldPrioritize: false
    };
  }
}

export const successScorePredictor = new SuccessScorePredictor();