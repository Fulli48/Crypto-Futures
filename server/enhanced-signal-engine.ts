/**
 * Enhanced Signal Engine
 * Advanced signal generation with meta-model integration and comprehensive feature engineering
 */

import { metaModelWorker } from './meta-model-worker';
import crypto from 'crypto';

interface TechnicalSnapshot {
  rsi: number;
  macd: number;
  stochasticK: number;
  stochasticD: number;
  volatility: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  volume: number;
  price: number;
}

interface ForecastData {
  symbol: string;
  forecastVector: number[];
  forecastReturn: number;
  forecastSlope: number;
  modelConfidence: number;
  currentPrice: number;
}

interface EnhancedSignalResult {
  signalId: string;
  symbol: string;
  timestamp: Date;
  signal: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  riskRewardRatio: number;
  qualityScore: number;
  metaModelPrediction: number;
  suppressionReasons: string[];
  warnings: string[];
  featureVector: number[];
  featureChecksum: string;
}

export class EnhancedSignalEngine {
  private qualityThresholds = {
    minModelConfidence: 45,
    minTechnicalConfluence: 30,
    minVolatilityConsistency: 0.7,
    minEnsembleAgreement: 60,
    maxSuppressionsAllowed: 2
  };

  /**
   * Generate enhanced signal with comprehensive analysis
   */
  async generateEnhancedSignal(
    forecastData: ForecastData,
    technicalSnapshot: TechnicalSnapshot
  ): Promise<EnhancedSignalResult> {
    
    const timestamp = new Date();
    const signalId = this.generateSignalId(forecastData.symbol, timestamp);
    
    console.log(`🧠 Generating enhanced signal for ${forecastData.symbol}`);

    // Step 1: Feature Engineering
    const featureVector = await this.engineerFeatures(forecastData, technicalSnapshot);
    const featureChecksum = this.calculateFeatureChecksum(featureVector);

    // Step 2: Ensemble and Quality Analysis
    const ensembleMetrics = this.calculateEnsembleMetrics(forecastData);
    const qualityMetrics = this.assessSignalQuality(forecastData, technicalSnapshot, ensembleMetrics);

    // Step 3: Meta-Model Prediction
    const metaModelResult = await metaModelWorker.getPrediction(featureVector);

    // Step 4: Signal Decision with Suppression Logic
    const signalDecision = this.makeSignalDecision(
      forecastData,
      technicalSnapshot,
      qualityMetrics,
      metaModelResult
    );

    // Step 5: Risk Management and Position Sizing
    const riskParams = this.calculateRiskParameters(
      forecastData,
      technicalSnapshot,
      signalDecision.signal
    );

    // Step 6: Final Confidence Adjustment
    const finalConfidence = this.adjustFinalConfidence(
      signalDecision.baseConfidence,
      qualityMetrics,
      metaModelResult
    );

    const result: EnhancedSignalResult = {
      signalId,
      symbol: forecastData.symbol,
      timestamp,
      signal: signalDecision.signal,
      confidence: finalConfidence,
      entryPrice: forecastData.currentPrice,
      takeProfitPrice: riskParams.takeProfitPrice,
      stopLossPrice: riskParams.stopLossPrice,
      riskRewardRatio: riskParams.riskRewardRatio,
      qualityScore: qualityMetrics.compositeScore,
      metaModelPrediction: metaModelResult.winProbability,
      suppressionReasons: signalDecision.suppressionReasons,
      warnings: qualityMetrics.warnings,
      featureVector,
      featureChecksum
    };

    console.log(`✅ Enhanced signal generated: ${result.signal} (${result.confidence.toFixed(1)}% confidence)`);
    
    return result;
  }

  /**
   * Comprehensive feature engineering
   */
  private async engineerFeatures(
    forecastData: ForecastData,
    technicalSnapshot: TechnicalSnapshot
  ): Promise<number[]> {
    
    const features = [];

    // Core forecast features
    features.push(
      Math.tanh(forecastData.forecastReturn * 100), // Normalized return
      Math.tanh(forecastData.forecastSlope * 1000), // Normalized slope
      forecastData.modelConfidence / 100 // Base model confidence
    );

    // Technical indicator features (normalized)
    features.push(
      technicalSnapshot.rsi / 100,
      Math.tanh(technicalSnapshot.macd * 1000),
      technicalSnapshot.stochasticK / 100,
      technicalSnapshot.stochasticD / 100,
      Math.min(1, technicalSnapshot.volatility * 100)
    );

    // Price position features
    const bbRange = technicalSnapshot.bollingerUpper - technicalSnapshot.bollingerLower;
    if (bbRange > 0) {
      const bbPosition = (technicalSnapshot.price - technicalSnapshot.bollingerLower) / bbRange;
      features.push(Math.max(0, Math.min(1, bbPosition)));
    } else {
      features.push(0.5); // Neutral position
    }

    // Volume and volatility regime
    features.push(
      Math.log(technicalSnapshot.volume + 1) / 20, // Log-normalized volume
      Math.min(1, technicalSnapshot.volatility / 0.01) // Volatility regime
    );

    // Market timing features
    const hour = new Date().getHours();
    features.push(
      Math.sin(2 * Math.PI * hour / 24), // Hour cyclical encoding
      Math.cos(2 * Math.PI * hour / 24)
    );

    return features;
  }

  /**
   * Calculate ensemble metrics for model agreement
   */
  private calculateEnsembleMetrics(forecastData: ForecastData): {
    dispersion: number;
    agreementScore: number;
    pathSmoothness: number;
  } {
    
    // Mock ensemble calculation - in reality would use multiple model outputs
    const forecast = forecastData.forecastVector;
    
    // Calculate path smoothness (how monotonic the forecast is)
    let smoothnessScore = 0;
    if (forecast.length > 1) {
      const differences = [];
      for (let i = 1; i < forecast.length; i++) {
        differences.push(forecast[i] - forecast[i - 1]);
      }
      
      // Check for sign consistency (smoother paths have consistent direction)
      const positiveChanges = differences.filter(d => d > 0).length;
      const negativeChanges = differences.filter(d => d < 0).length;
      const totalChanges = differences.length;
      
      smoothnessScore = Math.max(positiveChanges, negativeChanges) / totalChanges * 100;
    }

    // Mock dispersion and agreement
    const dispersion = Math.random() * 0.1; // Standard deviation of ensemble
    const agreementScore = 70 + Math.random() * 25; // Consensus level

    return {
      dispersion,
      agreementScore,
      pathSmoothness: smoothnessScore
    };
  }

  /**
   * Assess comprehensive signal quality
   */
  private assessSignalQuality(
    forecastData: ForecastData,
    technicalSnapshot: TechnicalSnapshot,
    ensembleMetrics: any
  ): {
    compositeScore: number;
    warnings: string[];
    technicalConfluence: number;
    volatilityConsistency: number;
  } {
    
    const warnings: string[] = [];
    let compositeScore = 0;

    // Technical confluence (how aligned indicators are)
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (technicalSnapshot.rsi < 30) bearishSignals++;
    if (technicalSnapshot.rsi > 70) bullishSignals++;
    if (technicalSnapshot.macd > 0) bullishSignals++;
    if (technicalSnapshot.macd < 0) bearishSignals++;
    if (technicalSnapshot.stochasticK < 20) bearishSignals++;
    if (technicalSnapshot.stochasticK > 80) bullishSignals++;

    const totalSignals = bullishSignals + bearishSignals;
    const technicalConfluence = totalSignals > 0 ? 
      Math.max(bullishSignals, bearishSignals) / totalSignals * 100 : 50;

    // Volatility consistency check
    const volatilityConsistency = technicalSnapshot.volatility > 0.0001 && 
                                technicalSnapshot.volatility < 0.02 ? 100 : 50;

    if (volatilityConsistency < 70) {
      warnings.push('Unusual volatility regime detected');
    }

    // Model confidence assessment
    const modelConfidenceScore = forecastData.modelConfidence;
    if (modelConfidenceScore < this.qualityThresholds.minModelConfidence) {
      warnings.push('Low base model confidence');
    }

    // Ensemble agreement assessment
    const ensembleScore = ensembleMetrics.agreementScore;
    if (ensembleScore < this.qualityThresholds.minEnsembleAgreement) {
      warnings.push('Low ensemble model agreement');
    }

    // Composite score calculation
    compositeScore = (
      modelConfidenceScore * 0.3 +
      technicalConfluence * 0.25 +
      volatilityConsistency * 0.15 +
      ensembleScore * 0.2 +
      ensembleMetrics.pathSmoothness * 0.1
    );

    return {
      compositeScore,
      warnings,
      technicalConfluence,
      volatilityConsistency
    };
  }

  /**
   * Make signal decision with suppression logic
   */
  private makeSignalDecision(
    forecastData: ForecastData,
    technicalSnapshot: TechnicalSnapshot,
    qualityMetrics: any,
    metaModelResult: any
  ): {
    signal: 'LONG' | 'SHORT' | 'WAIT';
    baseConfidence: number;
    suppressionReasons: string[];
  } {
    
    const suppressionReasons: string[] = [];
    let signal: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
    
    // Base signal from forecast
    if (forecastData.forecastReturn > 0.002) {
      signal = 'LONG';
    } else if (forecastData.forecastReturn < -0.002) {
      signal = 'SHORT';
    }

    // Suppression checks
    if (qualityMetrics.compositeScore < 40) {
      suppressionReasons.push('Low composite quality score');
      signal = 'WAIT';
    }

    if (metaModelResult.winProbability < 45) {
      suppressionReasons.push('Meta-model low win probability');
      signal = 'WAIT';
    }

    if (technicalSnapshot.volatility > 0.015) {
      suppressionReasons.push('Excessive market volatility');
      signal = 'WAIT';
    }

    // Technical conflict check
    const forecastBullish = forecastData.forecastReturn > 0;
    const rsiOversold = technicalSnapshot.rsi < 30;
    const rsiOverbought = technicalSnapshot.rsi > 70;
    
    if (forecastBullish && rsiOverbought) {
      suppressionReasons.push('Forecast bullish but RSI overbought');
    }
    if (!forecastBullish && rsiOversold) {
      suppressionReasons.push('Forecast bearish but RSI oversold');
    }

    // Max suppressions check
    if (suppressionReasons.length > this.qualityThresholds.maxSuppressionsAllowed) {
      signal = 'WAIT';
    }

    const baseConfidence = Math.min(95, Math.max(30, 
      forecastData.modelConfidence + qualityMetrics.compositeScore * 0.3
    ));

    return {
      signal,
      baseConfidence,
      suppressionReasons
    };
  }

  /**
   * Calculate risk management parameters
   */
  private calculateRiskParameters(
    forecastData: ForecastData,
    technicalSnapshot: TechnicalSnapshot,
    signal: 'LONG' | 'SHORT' | 'WAIT'
  ): {
    takeProfitPrice: number;
    stopLossPrice: number;
    riskRewardRatio: number;
  } {
    
    const currentPrice = forecastData.currentPrice;
    const volatility = technicalSnapshot.volatility;
    
    if (signal === 'WAIT') {
      return {
        takeProfitPrice: currentPrice,
        stopLossPrice: currentPrice,
        riskRewardRatio: 1.0
      };
    }

    // Dynamic risk sizing based on volatility and forecast confidence
    const baseRiskPercent = 0.015; // 1.5% base risk
    const volatilityAdjustment = Math.min(2, Math.max(0.5, volatility / 0.005));
    const adjustedRisk = baseRiskPercent * volatilityAdjustment;

    let takeProfitPrice: number;
    let stopLossPrice: number;

    if (signal === 'LONG') {
      // Target 2x risk reward minimum
      const stopLossDistance = currentPrice * adjustedRisk;
      const takeProfitDistance = stopLossDistance * 2.5; // 2.5:1 R/R target
      
      takeProfitPrice = currentPrice + takeProfitDistance;
      stopLossPrice = currentPrice - stopLossDistance;
    } else { // SHORT
      const stopLossDistance = currentPrice * adjustedRisk;
      const takeProfitDistance = stopLossDistance * 2.5;
      
      takeProfitPrice = currentPrice - takeProfitDistance;
      stopLossPrice = currentPrice + stopLossDistance;
    }

    // Calculate actual risk/reward ratio
    const riskAmount = Math.abs(currentPrice - stopLossPrice);
    const rewardAmount = Math.abs(takeProfitPrice - currentPrice);
    const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : 1.0;

    return {
      takeProfitPrice,
      stopLossPrice,
      riskRewardRatio
    };
  }

  /**
   * Adjust final confidence based on all factors
   */
  private adjustFinalConfidence(
    baseConfidence: number,
    qualityMetrics: any,
    metaModelResult: any
  ): number {
    
    let adjustedConfidence = baseConfidence;

    // Quality score adjustment
    const qualityAdjustment = (qualityMetrics.compositeScore - 50) * 0.2;
    adjustedConfidence += qualityAdjustment;

    // Meta-model calibration
    const metaModelAdjustment = (metaModelResult.winProbability - 50) * 0.15;
    adjustedConfidence += metaModelAdjustment;

    // Warning penalties
    const warningPenalty = qualityMetrics.warnings.length * 3;
    adjustedConfidence -= warningPenalty;

    // Bounds checking
    adjustedConfidence = Math.max(20, Math.min(95, adjustedConfidence));

    return adjustedConfidence;
  }

  /**
   * Generate unique signal ID
   */
  private generateSignalId(symbol: string, timestamp: Date): string {
    const timeStr = timestamp.getTime().toString();
    const hash = crypto.createHash('md5').update(symbol + timeStr).digest('hex').substring(0, 8);
    return `SIG_${symbol}_${timeStr}_${hash}`;
  }

  /**
   * Calculate feature vector checksum for auditability
   */
  private calculateFeatureChecksum(featureVector: number[]): string {
    const featureString = featureVector.map(f => f.toFixed(6)).join(',');
    return crypto.createHash('sha256').update(featureString).digest('hex');
  }

  /**
   * Get current quality thresholds
   */
  getQualityThresholds() {
    return { ...this.qualityThresholds };
  }

  /**
   * Update quality thresholds dynamically
   */
  updateQualityThresholds(newThresholds: Partial<typeof this.qualityThresholds>) {
    this.qualityThresholds = { ...this.qualityThresholds, ...newThresholds };
    console.log('🔧 Updated signal quality thresholds:', this.qualityThresholds);
  }
}

// Singleton instance
export const enhancedSignalEngine = new EnhancedSignalEngine();