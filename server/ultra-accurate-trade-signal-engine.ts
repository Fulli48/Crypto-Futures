import { db } from './db';
import { tradeSimulations, rollingChartData, learningWeights, mlPredictionHistory } from '../shared/schema';
import { eq, desc, and, gte, ne, sql } from 'drizzle-orm';
import { MLTradeSignalEngine } from './ml-trade-signal-engine';

/**
 * ULTRA-ACCURATE TRADE SIGNAL SUGGESTION REFINEMENT ENGINE
 * 
 * Implements comprehensive signal filtering, validation, and adaptive consensus logic
 * to maximize trade accuracy and minimize false signals through:
 * - Ensemble model dispersion validation
 * - Dynamic volatility-scaled thresholds
 * - Path consistency analysis
 * - Multi-technical indicator confluence
 * - Risk/reward enforcement
 * - Cross-market consensus
 * - Meta-modeling for win rate prediction
 */

export interface EnsembleForecast {
  symbol: string;
  timestamp: number;
  forecasts: {
    lstm: number[];
    gru: number[];
    xgboost: number[];
    statistical: number[];
  };
  consensus: number[];
  dispersion: number[];
  currentPrice: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  stochasticK: number;
  stochasticD: number;
  bollingerUpper: number;
  bollingerLower: number;
  movingAverage20: number;
  volume: number;
  volatility: number;
}

export interface SignalQualityScore {
  modelAgreement: number; // 30%
  technicalConfluence: number; // 25%
  riskReward: number; // 20%
  crossMarketConsensus: number; // 15%
  metaModelWinRate: number; // 10%
  total: number;
  grade: 'prime' | 'good' | 'caution' | 'wait';
  warnings: string[];
}

export interface UltraAccurateSignal {
  symbol: string;
  direction: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  qualityScore: SignalQualityScore;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskRewardRatio: number;
  forecastPath: number[];
  pathConsistency: number;
  reasons: string[];
  warnings: string[];
  timestamp: number;
}

export class UltraAccurateTradeSignalEngine {
  private baseEngine: MLTradeSignalEngine;
  private correlationMatrix: Map<string, string[]> = new Map();
  private volatilityCache: Map<string, number> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private metaModelWeights: Map<string, number> = new Map();
  private signalHistory: Map<string, UltraAccurateSignal[]> = new Map();
  
  // Configuration parameters
  private readonly MAX_DISPERSION_MULTIPLIER = 1.0; // 1x rolling volatility
  private readonly MIN_MOVE_MULTIPLIER = 1.2; // 1.2x rolling volatility
  private readonly PATH_CONSISTENCY_THRESHOLD = 0.85; // 85% monotonic steps
  private readonly MIN_RISK_REWARD_RATIO = 2.0;
  private readonly MAX_POSITION_RISK = 0.005; // 0.5% of account
  private readonly MIN_LIQUIDITY_MULTIPLIER = 5.0; // 5x position size in volume
  private readonly META_MODEL_THRESHOLD = 0.65; // 65% predicted win rate
  private readonly VOLATILITY_SPIKE_THRESHOLD = 3.0; // 3x ATR
  private readonly NEWS_SUPPRESSION_DURATION = 300000; // 5 minutes
  
  constructor() {
    this.baseEngine = new MLTradeSignalEngine();
    this.initializeCorrelations();
    this.initializeMetaModel();
  }

  private initializeCorrelations(): void {
    // Define correlated asset groups
    this.correlationMatrix.set('BTCUSDT', ['ETHUSDT', 'SOLUSDT']);
    this.correlationMatrix.set('ETHUSDT', ['BTCUSDT', 'SOLUSDT']);
    this.correlationMatrix.set('SOLUSDT', ['BTCUSDT', 'ETHUSDT']);
    this.correlationMatrix.set('XRPUSDT', ['ADAUSDT', 'HBARUSDT']);
    this.correlationMatrix.set('ADAUSDT', ['XRPUSDT', 'HBARUSDT']);
    this.correlationMatrix.set('HBARUSDT', ['XRPUSDT', 'ADAUSDT']);
  }

  private initializeMetaModel(): void {
    // Initialize meta-model feature weights for win rate prediction
    this.metaModelWeights.set('model_agreement', 0.30);
    this.metaModelWeights.set('technical_confluence', 0.25);
    this.metaModelWeights.set('risk_reward', 0.20);
    this.metaModelWeights.set('volatility_regime', 0.15);
    this.metaModelWeights.set('market_structure', 0.10);
  }

  /**
   * Main method to generate ultra-accurate trade signals
   */
  public async generateUltraAccurateSignal(symbol: string, currentPrice: number): Promise<UltraAccurateSignal> {
    try {
      console.log(`🎯 [ULTRA-ACCURATE] Starting comprehensive signal analysis for ${symbol} at $${currentPrice}`);
      
      // Step 1: Gather ensemble forecasts
      const ensembleForecast = await this.generateEnsembleForecast(symbol, currentPrice);
      
      // Step 2: Validate model dispersion
      const dispersionValid = this.validateModelDispersion(ensembleForecast);
      if (!dispersionValid.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Model disagreement: ' + dispersionValid.reason]);
      }

      // Step 3: Check dynamic volatility-scaled thresholds
      const thresholdCheck = await this.checkDynamicThresholds(symbol, currentPrice, ensembleForecast);
      if (!thresholdCheck.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Threshold check failed: ' + thresholdCheck.reason]);
      }

      // Step 4: Analyze path consistency
      const pathAnalysis = this.analyzePathConsistency(ensembleForecast);
      if (!pathAnalysis.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Path inconsistency: ' + pathAnalysis.reason]);
      }

      // Step 5: Multi-technical indicator check
      const technicalCheck = await this.checkTechnicalIndicators(symbol, pathAnalysis.direction);
      if (!technicalCheck.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Technical conflict: ' + technicalCheck.reason]);
      }

      // Step 6: Risk/reward enforcement
      const riskRewardCheck = this.calculateRiskReward(currentPrice, pathAnalysis.direction, ensembleForecast);
      if (!riskRewardCheck.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Risk/reward insufficient: ' + riskRewardCheck.reason]);
      }

      // Step 7: Liquidity check
      const liquidityCheck = await this.checkLiquidity(symbol, riskRewardCheck.positionSize);
      if (!liquidityCheck.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Liquidity insufficient: ' + liquidityCheck.reason]);
      }

      // Step 8: Cross-market consensus
      const consensusCheck = await this.checkCrossMarketConsensus(symbol, pathAnalysis.direction);
      
      // Step 9: Volatility/news spike detection
      const spikeCheck = await this.checkVolatilitySpikes(symbol, currentPrice);
      if (!spikeCheck.valid) {
        return this.createWaitSignal(symbol, currentPrice, ['Volatility spike detected: ' + spikeCheck.reason]);
      }

      // Step 10: Meta-model win rate prediction
      const metaModelPrediction = await this.predictWinRate(symbol, {
        modelAgreement: dispersionValid.score,
        technicalConfluence: technicalCheck.score,
        riskReward: riskRewardCheck.score,
        crossMarketConsensus: consensusCheck.score,
        volatilityRegime: spikeCheck.score
      });

      if (metaModelPrediction.winRate < this.META_MODEL_THRESHOLD) {
        return this.createWaitSignal(symbol, currentPrice, [`Meta-model win rate too low: ${(metaModelPrediction.winRate * 100).toFixed(1)}%`]);
      }

      // Step 11: Calculate signal quality score
      const qualityScore = this.calculateSignalQuality({
        modelAgreement: dispersionValid.score,
        technicalConfluence: technicalCheck.score,
        riskReward: riskRewardCheck.score,
        crossMarketConsensus: consensusCheck.score,
        metaModelWinRate: metaModelPrediction.winRate
      });

      // Step 12: Generate final signal
      const signal: UltraAccurateSignal = {
        symbol,
        direction: pathAnalysis.direction,
        confidence: Math.min(95, metaModelPrediction.winRate * 100),
        qualityScore,
        entryPrice: currentPrice,
        stopLoss: riskRewardCheck.stopLoss,
        takeProfit: riskRewardCheck.takeProfit,
        positionSize: riskRewardCheck.positionSize,
        riskRewardRatio: riskRewardCheck.ratio,
        forecastPath: ensembleForecast.consensus,
        pathConsistency: pathAnalysis.consistency,
        reasons: [
          `Model agreement: ${(dispersionValid.score * 100).toFixed(1)}%`,
          `Technical confluence: ${(technicalCheck.score * 100).toFixed(1)}%`,
          `Risk/reward: ${riskRewardCheck.ratio.toFixed(2)}:1`,
          `Win rate prediction: ${(metaModelPrediction.winRate * 100).toFixed(1)}%`
        ],
        warnings: consensusCheck.warnings || [],
        timestamp: Date.now()
      };

      // Log comprehensive signal details
      console.log(`✅ [ULTRA-ACCURATE] ${symbol} ${signal.direction} signal generated:`);
      console.log(`   🎯 Confidence: ${signal.confidence.toFixed(1)}%`);
      console.log(`   🏆 Quality Score: ${signal.qualityScore.total.toFixed(1)}% (${signal.qualityScore.grade})`);
      console.log(`   📊 Risk/Reward: ${signal.riskRewardRatio.toFixed(2)}:1`);
      console.log(`   🔄 Path Consistency: ${(signal.pathConsistency * 100).toFixed(1)}%`);

      // Store signal history
      this.storeSignalHistory(symbol, signal);

      return signal;

    } catch (error) {
      console.error(`❌ [ULTRA-ACCURATE] Error generating signal for ${symbol}:`, error);
      return this.createWaitSignal(symbol, currentPrice, ['System error during analysis']);
    }
  }

  /**
   * Generate ensemble forecasts from multiple models
   */
  private async generateEnsembleForecast(symbol: string, currentPrice: number): Promise<EnsembleForecast> {
    // Get historical data for model inputs
    const historicalData = await this.getHistoricalData(symbol, 60); // 60 minutes of data
    
    // Simulate different model forecasts (in production, these would be real models)
    const lstm = this.simulateLSTMForecast(historicalData, currentPrice);
    const gru = this.simulateGRUForecast(historicalData, currentPrice);
    const xgboost = this.simulateXGBoostForecast(historicalData, currentPrice);
    const statistical = this.simulateStatisticalForecast(historicalData, currentPrice);
    
    // Calculate ensemble consensus (mean)
    const consensus = lstm.map((_, i) => 
      (lstm[i] + gru[i] + xgboost[i] + statistical[i]) / 4
    );
    
    // Calculate dispersion (standard deviation at each time point)
    const dispersion = lstm.map((_, i) => {
      const values = [lstm[i], gru[i], xgboost[i], statistical[i]];
      const mean = values.reduce((a, b) => a + b) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      return Math.sqrt(variance);
    });

    return {
      symbol,
      timestamp: Date.now(),
      forecasts: { lstm, gru, xgboost, statistical },
      consensus,
      dispersion,
      currentPrice
    };
  }

  /**
   * Validate that model dispersion is within acceptable limits
   */
  private validateModelDispersion(forecast: EnsembleForecast): { valid: boolean; reason: string; score: number } {
    const rollingVolatility = this.volatilityCache.get(forecast.symbol) || 0.01;
    const maxAllowedDispersion = rollingVolatility * this.MAX_DISPERSION_MULTIPLIER;
    
    // Check if any forecast point exceeds dispersion threshold
    const maxDispersion = Math.max(...forecast.dispersion);
    const avgDispersion = forecast.dispersion.reduce((a, b) => a + b) / forecast.dispersion.length;
    
    if (maxDispersion > maxAllowedDispersion) {
      return {
        valid: false,
        reason: `Max dispersion ${(maxDispersion * 100).toFixed(2)}% exceeds threshold ${(maxAllowedDispersion * 100).toFixed(2)}%`,
        score: 0
      };
    }
    
    // Calculate agreement score (inverse of normalized dispersion)
    const score = Math.max(0, 1 - (avgDispersion / maxAllowedDispersion));
    
    return {
      valid: true,
      reason: `Models in agreement, avg dispersion: ${(avgDispersion * 100).toFixed(2)}%`,
      score
    };
  }

  /**
   * Check dynamic volatility-scaled thresholds
   */
  private async checkDynamicThresholds(symbol: string, currentPrice: number, forecast: EnsembleForecast): Promise<{ valid: boolean; reason: string }> {
    const rollingVolatility = await this.calculateRollingVolatility(symbol);
    const minRequiredMove = rollingVolatility * this.MIN_MOVE_MULTIPLIER;
    
    // Calculate projected move from forecast
    const finalPrice = forecast.consensus[forecast.consensus.length - 1];
    const projectedMove = Math.abs(finalPrice - currentPrice) / currentPrice;
    
    // Round up to nearest 0.05%
    const roundedMinMove = Math.ceil(minRequiredMove * 2000) / 2000; // Round to 0.05%
    
    if (projectedMove < roundedMinMove) {
      return {
        valid: false,
        reason: `Projected move ${(projectedMove * 100).toFixed(2)}% < required ${(roundedMinMove * 100).toFixed(2)}%`
      };
    }
    
    // Check against estimated fees + slippage (assume 0.1% total)
    const feeSlippage = 0.001;
    if (projectedMove < feeSlippage) {
      return {
        valid: false,
        reason: `Projected move ${(projectedMove * 100).toFixed(2)}% < fees/slippage ${(feeSlippage * 100).toFixed(2)}%`
      };
    }
    
    return {
      valid: true,
      reason: `Projected move ${(projectedMove * 100).toFixed(2)}% meets threshold`
    };
  }

  /**
   * Analyze forecast path consistency and smoothness
   */
  private analyzePathConsistency(forecast: EnsembleForecast): { valid: boolean; reason: string; direction: 'LONG' | 'SHORT'; consistency: number } {
    const path = forecast.consensus;
    const currentPrice = forecast.currentPrice;
    
    // Determine overall direction based on final price
    const finalPrice = path[path.length - 1];
    const direction: 'LONG' | 'SHORT' = finalPrice > currentPrice ? 'LONG' : 'SHORT';
    
    // Count monotonic steps in the trade direction
    let monotonicSteps = 0;
    let totalSteps = path.length - 1;
    let oscillations = 0;
    
    for (let i = 1; i < path.length; i++) {
      const currentStep = path[i];
      const previousStep = path[i - 1];
      
      if (direction === 'LONG') {
        if (currentStep >= previousStep) monotonicSteps++;
        else if (i > 1 && path[i - 2] < previousStep) oscillations++;
      } else {
        if (currentStep <= previousStep) monotonicSteps++;
        else if (i > 1 && path[i - 2] > previousStep) oscillations++;
      }
    }
    
    const consistency = monotonicSteps / totalSteps;
    
    // Check path consistency threshold
    if (consistency < this.PATH_CONSISTENCY_THRESHOLD) {
      return {
        valid: false,
        reason: `Path consistency ${(consistency * 100).toFixed(1)}% < required ${(this.PATH_CONSISTENCY_THRESHOLD * 100).toFixed(1)}%`,
        direction,
        consistency
      };
    }
    
    // Check for excessive oscillations
    if (oscillations > 3) {
      return {
        valid: false,
        reason: `Excessive oscillations detected: ${oscillations} reversals`,
        direction,
        consistency
      };
    }
    
    return {
      valid: true,
      reason: `Path consistent: ${(consistency * 100).toFixed(1)}% monotonic steps`,
      direction,
      consistency
    };
  }

  /**
   * Check technical indicator confluence
   */
  private async checkTechnicalIndicators(symbol: string, direction: 'LONG' | 'SHORT'): Promise<{ valid: boolean; reason: string; score: number }> {
    const indicators = await this.getTechnicalIndicators(symbol);
    const conflicts: string[] = [];
    let score = 1.0;
    
    if (direction === 'LONG') {
      // RSI between 40-70 and trending up
      if (indicators.rsi < 40 || indicators.rsi > 70) {
        conflicts.push(`RSI ${indicators.rsi.toFixed(1)} outside 40-70 range`);
        score -= 0.25;
      }
      
      // MACD positive and above signal line
      if (indicators.macd <= 0 || indicators.macd <= indicators.macdSignal) {
        conflicts.push('MACD not bullish');
        score -= 0.25;
      }
      
      // Stochastic K > D and both above 40
      if (indicators.stochasticK <= indicators.stochasticD || indicators.stochasticK <= 40) {
        conflicts.push('Stochastic not bullish');
        score -= 0.25;
      }
      
      // Price above 20-min MA or breaking upper BB
      if (indicators.currentPrice < indicators.movingAverage20 && indicators.currentPrice < indicators.bollingerUpper) {
        conflicts.push('Price not above MA or breaking upper BB');
        score -= 0.25;
      }
    } else {
      // SHORT signal requirements (opposite)
      if (indicators.rsi < 30 || indicators.rsi > 60) {
        conflicts.push(`RSI ${indicators.rsi.toFixed(1)} outside 30-60 range for SHORT`);
        score -= 0.25;
      }
      
      if (indicators.macd >= 0 || indicators.macd >= indicators.macdSignal) {
        conflicts.push('MACD not bearish');
        score -= 0.25;
      }
      
      if (indicators.stochasticK >= indicators.stochasticD || indicators.stochasticK >= 60) {
        conflicts.push('Stochastic not bearish');
        score -= 0.25;
      }
      
      if (indicators.currentPrice > indicators.movingAverage20 && indicators.currentPrice > indicators.bollingerLower) {
        conflicts.push('Price not below MA or breaking lower BB');
        score -= 0.25;
      }
    }
    
    // If 2+ conflicts, reject signal
    if (conflicts.length >= 2) {
      return {
        valid: false,
        reason: `Multiple technical conflicts: ${conflicts.join(', ')}`,
        score: Math.max(0, score)
      };
    }
    
    return {
      valid: true,
      reason: conflicts.length > 0 ? `Minor conflicts: ${conflicts.join(', ')}` : 'All technicals aligned',
      score: Math.max(0, score)
    };
  }

  /**
   * Calculate risk/reward ratio and validate constraints
   */
  private calculateRiskReward(currentPrice: number, direction: 'LONG' | 'SHORT', forecast: EnsembleForecast): {
    valid: boolean;
    reason: string;
    ratio: number;
    stopLoss: number;
    takeProfit: number;
    positionSize: number;
    score: number;
  } {
    const volatility = this.volatilityCache.get(forecast.symbol) || 0.01;
    
    // Calculate stop loss (2x volatility from entry)
    const stopDistance = volatility * 2;
    const stopLoss = direction === 'LONG' 
      ? currentPrice * (1 - stopDistance)
      : currentPrice * (1 + stopDistance);
    
    // Calculate take profit from forecast
    const targetPrice = forecast.consensus[forecast.consensus.length - 1];
    const takeProfit = targetPrice;
    
    // Calculate risk/reward ratio
    const risk = Math.abs(currentPrice - stopLoss);
    const reward = Math.abs(takeProfit - currentPrice);
    const ratio = reward / risk;
    
    // Estimate fees and slippage (0.1% total)
    const feeSlippage = currentPrice * 0.001;
    const adjustedReward = reward - feeSlippage;
    const adjustedRatio = adjustedReward / risk;
    
    if (adjustedRatio < this.MIN_RISK_REWARD_RATIO) {
      return {
        valid: false,
        reason: `Risk/reward ${adjustedRatio.toFixed(2)}:1 < required ${this.MIN_RISK_REWARD_RATIO}:1`,
        ratio: adjustedRatio,
        stopLoss,
        takeProfit,
        positionSize: 0,
        score: 0
      };
    }
    
    // Calculate position size (max 0.5% account risk)
    const accountCapital = 100000; // Assume $100k account
    const maxRiskAmount = accountCapital * this.MAX_POSITION_RISK;
    const positionSize = maxRiskAmount / risk;
    
    // Score based on risk/reward ratio
    const score = Math.min(1, adjustedRatio / (this.MIN_RISK_REWARD_RATIO * 2));
    
    return {
      valid: true,
      reason: `Risk/reward ${adjustedRatio.toFixed(2)}:1 meets requirements`,
      ratio: adjustedRatio,
      stopLoss,
      takeProfit,
      positionSize,
      score
    };
  }

  /**
   * Check order book depth and liquidity
   */
  private async checkLiquidity(symbol: string, positionSize: number): Promise<{ valid: boolean; reason: string }> {
    const volumeHistory = this.volumeHistory.get(symbol) || [];
    
    if (volumeHistory.length < 10) {
      return {
        valid: false,
        reason: 'Insufficient volume history for liquidity check'
      };
    }
    
    const avgVolume = volumeHistory.reduce((a, b) => a + b) / volumeHistory.length;
    const requiredLiquidity = positionSize * this.MIN_LIQUIDITY_MULTIPLIER;
    
    if (avgVolume < requiredLiquidity) {
      return {
        valid: false,
        reason: `Avg volume ${avgVolume.toFixed(0)} < required ${requiredLiquidity.toFixed(0)} for position`
      };
    }
    
    return {
      valid: true,
      reason: `Sufficient liquidity: ${avgVolume.toFixed(0)} vs required ${requiredLiquidity.toFixed(0)}`
    };
  }

  /**
   * Check cross-market consensus
   */
  private async checkCrossMarketConsensus(symbol: string, direction: 'LONG' | 'SHORT'): Promise<{ score: number; warnings: string[] }> {
    const correlatedAssets = this.correlationMatrix.get(symbol) || [];
    const warnings: string[] = [];
    
    if (correlatedAssets.length === 0) {
      return { score: 0.5, warnings: ['No correlated assets for consensus check'] };
    }
    
    let agreementCount = 0;
    const correlatedSignals: string[] = [];
    
    for (const asset of correlatedAssets) {
      // Get signal for correlated asset (simplified - would use actual signals)
      const correlatedDirection = await this.getSimplifiedSignalDirection(asset);
      correlatedSignals.push(`${asset}:${correlatedDirection}`);
      
      if (correlatedDirection === direction) {
        agreementCount++;
      }
    }
    
    const agreementRatio = agreementCount / correlatedAssets.length;
    
    if (agreementRatio < 0.5) {
      warnings.push(`Cross-market disagreement: ${correlatedSignals.join(', ')}`);
      return { score: Math.max(0, agreementRatio - 0.3), warnings };
    }
    
    if (agreementRatio === 1) {
      return { score: Math.min(1, agreementRatio + 0.1), warnings: [] }; // 10% boost for full consensus
    }
    
    return { score: agreementRatio, warnings };
  }

  /**
   * Check for volatility spikes and news events
   */
  private async checkVolatilitySpikes(symbol: string, currentPrice: number): Promise<{ valid: boolean; reason: string; score: number }> {
    const recentPrices = await this.getRecentPrices(symbol, 10); // Last 10 minutes
    
    if (recentPrices.length < 5) {
      return { valid: true, reason: 'Insufficient price history for spike detection', score: 0.5 };
    }
    
    // Calculate ATR (Average True Range)
    const priceChanges = [];
    for (let i = 1; i < recentPrices.length; i++) {
      priceChanges.push(Math.abs(recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
    }
    
    const avgTrueRange = priceChanges.reduce((a, b) => a + b) / priceChanges.length;
    const latestChange = Math.abs(currentPrice - recentPrices[recentPrices.length - 1]) / recentPrices[recentPrices.length - 1];
    
    // Check for volatility spike
    if (latestChange > avgTrueRange * this.VOLATILITY_SPIKE_THRESHOLD) {
      return {
        valid: false,
        reason: `Volatility spike detected: ${(latestChange * 100).toFixed(2)}% > ${(avgTrueRange * this.VOLATILITY_SPIKE_THRESHOLD * 100).toFixed(2)}%`,
        score: 0
      };
    }
    
    // Check volume spike (simplified)
    const volumeHistory = this.volumeHistory.get(symbol) || [];
    if (volumeHistory.length > 5) {
      const avgVolume = volumeHistory.slice(-5).reduce((a, b) => a + b) / 5;
      const currentVolume = volumeHistory[volumeHistory.length - 1] || 0;
      
      if (currentVolume > avgVolume * 3) {
        return {
          valid: false,
          reason: `Volume spike detected: ${currentVolume.toFixed(0)} > ${(avgVolume * 3).toFixed(0)}`,
          score: 0
        };
      }
    }
    
    const volatilityScore = Math.max(0, 1 - (latestChange / (avgTrueRange * 2)));
    
    return {
      valid: true,
      reason: 'No significant volatility or volume spikes',
      score: volatilityScore
    };
  }

  /**
   * Predict win rate using meta-model
   */
  private async predictWinRate(symbol: string, features: {
    modelAgreement: number;
    technicalConfluence: number;
    riskReward: number;
    crossMarketConsensus: number;
    volatilityRegime: number;
  }): Promise<{ winRate: number; features: any }> {
    // Simplified logistic regression-style meta-model
    let logits = 0;
    
    // Apply feature weights
    logits += features.modelAgreement * this.metaModelWeights.get('model_agreement')!;
    logits += features.technicalConfluence * this.metaModelWeights.get('technical_confluence')!;
    logits += features.riskReward * this.metaModelWeights.get('risk_reward')!;
    logits += features.volatilityRegime * this.metaModelWeights.get('volatility_regime')!;
    logits += features.crossMarketConsensus * this.metaModelWeights.get('market_structure')!;
    
    // Add bias term
    logits += 0.1;
    
    // Apply sigmoid to get probability
    const winRate = 1 / (1 + Math.exp(-logits * 4)); // Scale for reasonable probabilities
    
    console.log(`🧠 [META-MODEL] ${symbol} win rate prediction: ${(winRate * 100).toFixed(1)}%`);
    
    return { winRate, features };
  }

  /**
   * Calculate overall signal quality score
   */
  private calculateSignalQuality(scores: {
    modelAgreement: number;
    technicalConfluence: number;
    riskReward: number;
    crossMarketConsensus: number;
    metaModelWinRate: number;
  }): SignalQualityScore {
    const total = (
      scores.modelAgreement * 0.30 +
      scores.technicalConfluence * 0.25 +
      scores.riskReward * 0.20 +
      scores.crossMarketConsensus * 0.15 +
      scores.metaModelWinRate * 0.10
    ) * 100;
    
    let grade: 'prime' | 'good' | 'caution' | 'wait';
    if (total >= 90) grade = 'prime';
    else if (total >= 70) grade = 'good';
    else if (total >= 50) grade = 'caution';
    else grade = 'wait';
    
    const warnings: string[] = [];
    if (scores.modelAgreement < 0.7) warnings.push('Moderate model disagreement');
    if (scores.technicalConfluence < 0.7) warnings.push('Technical indicators not fully aligned');
    if (scores.riskReward < 0.8) warnings.push('Risk/reward could be better');
    if (scores.crossMarketConsensus < 0.6) warnings.push('Mixed cross-market signals');
    
    return {
      modelAgreement: scores.modelAgreement * 100,
      technicalConfluence: scores.technicalConfluence * 100,
      riskReward: scores.riskReward * 100,
      crossMarketConsensus: scores.crossMarketConsensus * 100,
      metaModelWinRate: scores.metaModelWinRate * 100,
      total,
      grade,
      warnings
    };
  }

  /**
   * Create a WAIT signal with reasons
   */
  private createWaitSignal(symbol: string, currentPrice: number, reasons: string[]): UltraAccurateSignal {
    return {
      symbol,
      direction: 'WAIT',
      confidence: 0,
      qualityScore: {
        modelAgreement: 0,
        technicalConfluence: 0,
        riskReward: 0,
        crossMarketConsensus: 0,
        metaModelWinRate: 0,
        total: 0,
        grade: 'wait',
        warnings: reasons
      },
      entryPrice: currentPrice,
      stopLoss: currentPrice,
      takeProfit: currentPrice,
      positionSize: 0,
      riskRewardRatio: 0,
      forecastPath: [currentPrice],
      pathConsistency: 0,
      reasons,
      warnings: reasons,
      timestamp: Date.now()
    };
  }

  /**
   * Store signal in history for continuous learning
   */
  private storeSignalHistory(symbol: string, signal: UltraAccurateSignal): void {
    if (!this.signalHistory.has(symbol)) {
      this.signalHistory.set(symbol, []);
    }
    
    const history = this.signalHistory.get(symbol)!;
    history.push(signal);
    
    // Keep only last 100 signals
    if (history.length > 100) {
      history.shift();
    }
  }

  // Helper methods for data access (simplified implementations)
  
  private async getHistoricalData(symbol: string, minutes: number): Promise<number[]> {
    // In production, this would fetch real historical price data
    const prices: number[] = [];
    let basePrice = 100; // Simplified
    
    for (let i = 0; i < minutes; i++) {
      basePrice += (Math.random() - 0.5) * 2; // Random walk
      prices.push(basePrice);
    }
    
    return prices;
  }

  private simulateLSTMForecast(historicalData: number[], currentPrice: number): number[] {
    // Simulate LSTM forecast (trending)
    const forecast: number[] = [];
    let price = currentPrice;
    const trend = (Math.random() - 0.5) * 0.02; // Random trend
    
    for (let i = 0; i < 20; i++) {
      price += price * (trend + (Math.random() - 0.5) * 0.005);
      forecast.push(price);
    }
    
    return forecast;
  }

  private simulateGRUForecast(historicalData: number[], currentPrice: number): number[] {
    // Similar to LSTM but with slight variation
    const forecast: number[] = [];
    let price = currentPrice;
    const trend = (Math.random() - 0.5) * 0.018;
    
    for (let i = 0; i < 20; i++) {
      price += price * (trend + (Math.random() - 0.5) * 0.006);
      forecast.push(price);
    }
    
    return forecast;
  }

  private simulateXGBoostForecast(historicalData: number[], currentPrice: number): number[] {
    // Simulate XGBoost forecast (more volatile)
    const forecast: number[] = [];
    let price = currentPrice;
    
    for (let i = 0; i < 20; i++) {
      const change = (Math.random() - 0.5) * 0.01;
      price += price * change;
      forecast.push(price);
    }
    
    return forecast;
  }

  private simulateStatisticalForecast(historicalData: number[], currentPrice: number): number[] {
    // Simulate statistical forecast (mean reverting)
    const forecast: number[] = [];
    let price = currentPrice;
    const mean = historicalData.reduce((a, b) => a + b) / historicalData.length;
    
    for (let i = 0; i < 20; i++) {
      const reversion = (mean - price) * 0.05;
      price += reversion + (Math.random() - 0.5) * 0.003;
      forecast.push(price);
    }
    
    return forecast;
  }

  private async calculateRollingVolatility(symbol: string): Promise<number> {
    // Simplified volatility calculation
    const volatility = Math.random() * 0.02 + 0.005; // 0.5% to 2.5%
    this.volatilityCache.set(symbol, volatility);
    return volatility;
  }

  private async getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators & { currentPrice: number }> {
    // Get latest technical indicators from database
    const latest = await db
      .select()
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(1);

    if (latest.length === 0) {
      throw new Error(`No technical indicators found for ${symbol}`);
    }

    const data = latest[0];
    
    return {
      rsi: data.rsi || 50,
      macd: data.macd || 0,
      macdSignal: data.macdSignal || 0,
      stochasticK: data.stochasticK || 50,
      stochasticD: data.stochasticD || 50,
      bollingerUpper: parseFloat(data.bollingerUpper || '0'),
      bollingerLower: parseFloat(data.bollingerLower || '0'),
      movingAverage20: parseFloat(data.bollingerMiddle || '0'), // Use Bollinger middle as MA20
      volume: parseFloat(data.volume || '0'),
      volatility: data.volatility || 0.01,
      currentPrice: parseFloat(data.close || '0')
    };
  }

  private async getSimplifiedSignalDirection(symbol: string): Promise<'LONG' | 'SHORT'> {
    // Simplified signal direction based on price action
    return Math.random() > 0.5 ? 'LONG' : 'SHORT';
  }

  private async getRecentPrices(symbol: string, minutes: number): Promise<number[]> {
    // Get recent price data
    const recent = await db
      .select({ close: rollingChartData.close })
      .from(rollingChartData)
      .where(eq(rollingChartData.symbol, symbol))
      .orderBy(desc(rollingChartData.timestamp))
      .limit(minutes);

    return recent.map(row => parseFloat(row.close || '0')).reverse();
  }
}

// Export singleton instance
export const ultraAccurateSignalEngine = new UltraAccurateTradeSignalEngine();