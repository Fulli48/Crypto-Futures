/**
 * Enhanced Forecast Generator
 * Integrates forecast learning engine with actual price prediction algorithms
 * to create truly learning-based forecasts that improve over time
 */

import { forecastLearningEngine } from './forecast-learning-engine';

interface TechnicalIndicators {
  rsi: number;
  macd: number;
  volatility: number;
  stochasticK: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  volume: number;
}

interface MarketData {
  currentPrice: number;
  timestamp: Date;
  technicalIndicators: TechnicalIndicators;
  priceHistory: Array<{ price: number; timestamp: Date }>;
}

interface LearningBasedForecast {
  predictedPrice: number;
  forecastReturn: number;
  confidence: number;
  learningBias: {
    trendAdjustment: number;
    volatilityAdjustment: number;
    momentumWeight: number;
  };
  rawForecast: number;
  adjustedForecast: number;
}

export class EnhancedForecastGenerator {
  
  /**
   * Generate learning-enhanced 20-minute forecast
   * Uses both traditional technical analysis and learned parameters
   */
  async generateLearningBasedForecast(
    symbol: string,
    marketData: MarketData
  ): Promise<LearningBasedForecast> {
    
    console.log(`🧠 [ENHANCED FORECAST] Generating learning-based forecast for ${symbol}...`);
    
    // Step 1: Get learned parameters from forecast learning engine
    const learnedParams = await forecastLearningEngine.getLearnedParameters(symbol);
    
    // Step 2: Calculate base technical forecast
    const baseForecast = this.calculateBaseTechnicalForecast(marketData);
    
    // Step 3: Apply learned adjustments
    const learningAdjustedForecast = this.applyLearningAdjustments(
      baseForecast,
      learnedParams,
      marketData
    );
    
    // Step 4: Calculate confidence with learning factors
    const confidence = this.calculateLearningBasedConfidence(
      learningAdjustedForecast,
      learnedParams,
      marketData
    );
    
    // Step 5: Apply realistic constraints
    const finalForecast = this.applyRealisticConstraints(
      learningAdjustedForecast,
      marketData.currentPrice
    );
    
    const forecastReturn = (finalForecast - marketData.currentPrice) / marketData.currentPrice;
    
    console.log(`📈 [ENHANCED FORECAST] ${symbol}: ${marketData.currentPrice} → ${finalForecast.toFixed(2)} (${(forecastReturn * 100).toFixed(2)}%) confidence: ${confidence.toFixed(1)}%`);
    console.log(`🎯 [LEARNING APPLIED] Trend×${learnedParams.trendMultiplier.toFixed(3)}, Vol×${learnedParams.volatilityAdjustment.toFixed(3)}, Mom×${learnedParams.momentumWeight.toFixed(3)}`);
    
    return {
      predictedPrice: finalForecast,
      forecastReturn,
      confidence,
      learningBias: {
        trendAdjustment: learnedParams.trendMultiplier,
        volatilityAdjustment: learnedParams.volatilityAdjustment,
        momentumWeight: learnedParams.momentumWeight
      },
      rawForecast: baseForecast,
      adjustedForecast: learningAdjustedForecast
    };
  }
  
  /**
   * Calculate base technical forecast using traditional indicators
   */
  private calculateBaseTechnicalForecast(marketData: MarketData): number {
    const { currentPrice, technicalIndicators, priceHistory } = marketData;
    
    // 1. Trend Component (using price momentum)
    let trendComponent = 0;
    if (priceHistory.length >= 5) {
      const recent5 = priceHistory.slice(-5);
      const priceChanges = recent5.map((p, i) => 
        i > 0 ? (p.price - recent5[i-1].price) / recent5[i-1].price : 0
      ).slice(1);
      
      const avgMomentum = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
      trendComponent = avgMomentum * currentPrice * 0.3; // 30% weight for trend
    }
    
    // 2. RSI Mean Reversion Component
    let rsiComponent = 0;
    if (technicalIndicators.rsi > 70) {
      // Overbought - predict pullback
      rsiComponent = -currentPrice * 0.01 * ((technicalIndicators.rsi - 70) / 30);
    } else if (technicalIndicators.rsi < 30) {
      // Oversold - predict bounce
      rsiComponent = currentPrice * 0.01 * ((30 - technicalIndicators.rsi) / 30);
    }
    
    // 3. MACD Momentum Component
    const macdComponent = technicalIndicators.macd > 0 ? 
      currentPrice * 0.005 : // Positive momentum
      currentPrice * -0.005;   // Negative momentum
    
    // 4. Bollinger Bands Mean Reversion
    let bollingerComponent = 0;
    const bollingerPosition = (currentPrice - technicalIndicators.bollingerMiddle) / 
                             (technicalIndicators.bollingerUpper - technicalIndicators.bollingerLower);
    
    if (bollingerPosition > 0.8) {
      // Near upper band - expect pullback
      bollingerComponent = -currentPrice * 0.008;
    } else if (bollingerPosition < -0.8) {
      // Near lower band - expect bounce
      bollingerComponent = currentPrice * 0.008;
    }
    
    // 5. Volatility Component
    const volatilityComponent = technicalIndicators.volatility * currentPrice * 0.5;
    
    // Combine all components
    const totalChange = trendComponent + rsiComponent + macdComponent + bollingerComponent + volatilityComponent;
    
    return currentPrice + totalChange;
  }
  
  /**
   * Apply learned adjustments to base forecast
   */
  private applyLearningAdjustments(
    baseForecast: number,
    learnedParams: any,
    marketData: MarketData
  ): number {
    const currentPrice = marketData.currentPrice;
    const rawChange = baseForecast - currentPrice;
    
    // Apply learned multipliers
    const trendAdjustedChange = rawChange * learnedParams.trendMultiplier;
    const volatilityAdjustedChange = trendAdjustedChange * learnedParams.volatilityAdjustment;
    const momentumWeightedChange = volatilityAdjustedChange * learnedParams.momentumWeight;
    
    // Apply directional bias
    const biasAdjustedChange = momentumWeightedChange + (currentPrice * learnedParams.directionBias);
    
    // Apply conservatism factor
    const finalChange = biasAdjustedChange * learnedParams.conservatismFactor;
    
    return currentPrice + finalChange;
  }
  
  /**
   * Calculate confidence based on learning performance - OPTIMIZED FOR STRONGER SIGNALS
   */
  private calculateLearningBasedConfidence(
    forecastPrice: number,
    learnedParams: any,
    marketData: MarketData
  ): number {
    let baseConfidence = 65; // INCREASED from 50 - start with higher baseline confidence
    
    // Increase confidence if learning parameters are well-established
    const paramStability = (
      Math.abs(learnedParams.trendMultiplier - 1.0) +
      Math.abs(learnedParams.volatilityAdjustment - 1.0) +
      Math.abs(learnedParams.momentumWeight - 1.0)
    ) / 3;
    
    // Higher confidence if parameters are more refined (deviate from defaults)
    baseConfidence += Math.min(25, paramStability * 120); // INCREASED multiplier from 100 to 120
    
    // Adjust based on technical indicator confluence - ENHANCED LOGIC
    let technicalConfluence = 0;
    const { rsi, macd, stochasticK } = marketData.technicalIndicators;
    
    // More sophisticated confluence detection
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (rsi > 50) bullishSignals++; else bearishSignals++;
    if (macd > 0) bullishSignals++; else bearishSignals++;
    if (stochasticK > 50) bullishSignals++; else bearishSignals++;
    
    // Strong confluence bonus
    if (bullishSignals >= 2 || bearishSignals >= 2) {
      technicalConfluence += 20; // INCREASED from 15 - strong directional agreement
    }
    
    // Additional bonus for extreme agreement (all 3 indicators)
    if (bullishSignals === 3 || bearishSignals === 3) {
      technicalConfluence += 10; // Extra bonus for full confluence
    }
    
    // RELAXED realistic constraints - allow larger forecasts for crypto volatility
    const forecastChange = Math.abs(forecastPrice - marketData.currentPrice) / marketData.currentPrice;
    if (forecastChange > 0.035) { // INCREASED threshold from 2% to 3.5% for crypto markets
      baseConfidence -= Math.min(20, (forecastChange - 0.035) * 800); // REDUCED penalty multiplier from 1000 to 800
    }
    
    const finalConfidence = Math.max(25, Math.min(95, baseConfidence + technicalConfluence)); // INCREASED min from 15 to 25
    
    return finalConfidence;
  }
  
  /**
   * Apply realistic constraints to prevent unrealistic forecasts - OPTIMIZED FOR CRYPTO VOLATILITY
   */
  private applyRealisticConstraints(forecastPrice: number, currentPrice: number): number {
    const maxChangePercent = 0.025; // INCREASED from 1.5% to 2.5% maximum change in 20 minutes for crypto markets
    const maxChange = currentPrice * maxChangePercent;
    
    const rawChange = forecastPrice - currentPrice;
    
    if (Math.abs(rawChange) > maxChange) {
      const constrainedChange = Math.sign(rawChange) * maxChange;
      const constrainedPrice = currentPrice + constrainedChange;
      
      console.log(`⚠️ [FORECAST CONSTRAINT] Capped ${((rawChange/currentPrice)*100).toFixed(2)}% → ${((constrainedChange/currentPrice)*100).toFixed(2)}%`);
      
      return constrainedPrice;
    }
    
    return forecastPrice;
  }
}

// Export singleton instance
export const enhancedForecastGenerator = new EnhancedForecastGenerator();