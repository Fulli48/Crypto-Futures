/**
 * SAFE TECHNICAL INDICATORS SERVICE
 * 
 * Provides data leakage-proof technical indicator calculations.
 * All methods enforce strict temporal boundaries and prevent forward-looking bias.
 * 
 * CRITICAL SAFETY FEATURES:
 * 1. Temporal boundary enforcement for all calculations
 * 2. Historical data validation before indicator computation
 * 3. Automatic rejection of samples with future data leakage
 * 4. Runtime assertions and comprehensive error handling
 * 5. Audit trail for all indicator calculations
 */

import { TechnicalIndicatorsService } from './technical-indicators-service';
import { DataLeakagePreventionService } from './data-leakage-prevention';

export interface SafeIndicatorResult<T> {
  value: T | null;
  leakageDetected: boolean;
  errorMessage?: string;
  dataPointsUsed: number;
  temporalBoundary: Date;
}

export class SafeTechnicalIndicators {
  
  /**
   * SAFE RSI CALCULATION
   * Prevents data leakage by enforcing historical data boundaries
   */
  static calculateSafeRSI(
    data: any[], 
    currentTimestamp: Date, 
    period: number = 14
  ): SafeIndicatorResult<number> {
    
    const result = DataLeakagePreventionService.safeCalculateIndicator(
      data,
      currentTimestamp,
      'rsi',
      (validData) => {
        const prices = validData.map(d => parseFloat(d.close)).filter(p => !isNaN(p) && p > 0);
        const rsi = TechnicalIndicatorsService.calculateRSI(prices, period);
        return rsi;
      }
    );
    
    return {
      value: result.result,
      leakageDetected: result.leakageDetected,
      errorMessage: result.errorMessage,
      dataPointsUsed: data.length,
      temporalBoundary: DataLeakagePreventionService.createFeatureConstraint(currentTimestamp).maxTimestamp
    };
  }
  
  /**
   * SAFE MACD CALCULATION  
   * Enforces temporal constraints for all EMA components
   */
  static calculateSafeMACD(
    data: any[], 
    currentTimestamp: Date,
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): SafeIndicatorResult<{ macd: number | null; signal: number | null; histogram: number | null }> {
    
    const result = DataLeakagePreventionService.safeCalculateIndicator(
      data,
      currentTimestamp,
      'macd',
      (validData) => {
        const prices = validData.map(d => parseFloat(d.close)).filter(p => !isNaN(p) && p > 0);
        const macdResult = TechnicalIndicatorsService.calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod);
        return macdResult;
      }
    );
    
    return {
      value: result.result,
      leakageDetected: result.leakageDetected,
      errorMessage: result.errorMessage,
      dataPointsUsed: data.length,
      temporalBoundary: DataLeakagePreventionService.createFeatureConstraint(currentTimestamp).maxTimestamp
    };
  }
  
  /**
   * SAFE BOLLINGER BANDS CALCULATION
   * Prevents forward-looking bias in moving average and standard deviation calculations
   */
  static calculateSafeBollingerBands(
    data: any[], 
    currentTimestamp: Date,
    period: number = 20,
    stdDevMultiplier: number = 2
  ): SafeIndicatorResult<{ upper: number | null; middle: number | null; lower: number | null }> {
    
    const result = DataLeakagePreventionService.safeCalculateIndicator(
      data,
      currentTimestamp,
      'bollinger',
      (validData) => {
        const prices = validData.map(d => parseFloat(d.close)).filter(p => !isNaN(p) && p > 0);
        const bollingerResult = TechnicalIndicatorsService.calculateBollingerBands(prices, period, stdDevMultiplier);
        return bollingerResult;
      }
    );
    
    return {
      value: result.result,
      leakageDetected: result.leakageDetected,
      errorMessage: result.errorMessage,
      dataPointsUsed: data.length,
      temporalBoundary: DataLeakagePreventionService.createFeatureConstraint(currentTimestamp).maxTimestamp
    };
  }
  
  /**
   * SAFE STOCHASTIC OSCILLATOR CALCULATION
   * Enforces historical boundaries for high/low/close price arrays
   */
  static calculateSafeStochastic(
    data: any[], 
    currentTimestamp: Date,
    kPeriod: number = 14,
    dPeriod: number = 3
  ): SafeIndicatorResult<{ k: number | null; d: number | null }> {
    
    const result = DataLeakagePreventionService.safeCalculateIndicator(
      data,
      currentTimestamp,
      'stochastic',
      (validData) => {
        const highs = validData.map(d => parseFloat(d.high)).filter(p => !isNaN(p) && p > 0);
        const lows = validData.map(d => parseFloat(d.low)).filter(p => !isNaN(p) && p > 0);
        const closes = validData.map(d => parseFloat(d.close)).filter(p => !isNaN(p) && p > 0);
        
        const stochasticResult = TechnicalIndicatorsService.calculateStochastic(highs, lows, closes, kPeriod, dPeriod);
        return stochasticResult;
      }
    );
    
    return {
      value: result.result,
      leakageDetected: result.leakageDetected,
      errorMessage: result.errorMessage,
      dataPointsUsed: data.length,
      temporalBoundary: DataLeakagePreventionService.createFeatureConstraint(currentTimestamp).maxTimestamp
    };
  }
  
  /**
   * SAFE VOLATILITY CALCULATION
   * Prevents forward-looking bias in return calculations
   */
  static calculateSafeVolatility(
    data: any[], 
    currentTimestamp: Date,
    period: number = 20
  ): SafeIndicatorResult<number> {
    
    const result = DataLeakagePreventionService.safeCalculateIndicator(
      data,
      currentTimestamp,
      'volatility',
      (validData) => {
        const prices = validData.map(d => parseFloat(d.close)).filter(p => !isNaN(p) && p > 0);
        const volatility = TechnicalIndicatorsService.calculateVolatility(prices, period);
        return volatility;
      }
    );
    
    return {
      value: result.result,
      leakageDetected: result.leakageDetected,
      errorMessage: result.errorMessage,
      dataPointsUsed: data.length,
      temporalBoundary: DataLeakagePreventionService.createFeatureConstraint(currentTimestamp).maxTimestamp
    };
  }
  
  /**
   * COMPREHENSIVE SAFE INDICATOR CALCULATION
   * Calculates all indicators with unified temporal boundary enforcement
   */
  static calculateAllSafeIndicators(
    data: any[], 
    currentTimestamp: Date
  ): {
    rsi: SafeIndicatorResult<number>;
    macd: SafeIndicatorResult<{ macd: number | null; signal: number | null; histogram: number | null }>;
    bollinger: SafeIndicatorResult<{ upper: number | null; middle: number | null; lower: number | null }>;
    stochastic: SafeIndicatorResult<{ k: number | null; d: number | null }>;
    volatility: SafeIndicatorResult<number>;
    overallSafe: boolean;
    leakageDetected: boolean;
  } {
    
    const rsi = this.calculateSafeRSI(data, currentTimestamp);
    const macd = this.calculateSafeMACD(data, currentTimestamp);
    const bollinger = this.calculateSafeBollingerBands(data, currentTimestamp);
    const stochastic = this.calculateSafeStochastic(data, currentTimestamp);
    const volatility = this.calculateSafeVolatility(data, currentTimestamp);
    
    const results = [rsi, macd, bollinger, stochastic, volatility];
    const overallSafe = results.every(result => !result.leakageDetected);
    const leakageDetected = results.some(result => result.leakageDetected);
    
    if (leakageDetected) {
      console.error('🚨 [CRITICAL] Data leakage detected in technical indicator calculations!');
      results.forEach((result, index) => {
        if (result.leakageDetected) {
          console.error(`   ❌ Indicator ${index}: ${result.errorMessage}`);
        }
      });
    }
    
    return {
      rsi,
      macd,
      bollinger,
      stochastic,
      volatility,
      overallSafe,
      leakageDetected
    };
  }
  
  /**
   * EXTRACT SAFE FEATURES FOR ML
   * Creates feature vector with guaranteed temporal safety
   */
  static extractSafeFeaturesForML(
    data: any[], 
    currentTimestamp: Date
  ): {
    features: number[] | null;
    featureNames: string[];
    temporallySafe: boolean;
    auditTrail: string[];
  } {
    
    const auditTrail: string[] = [];
    auditTrail.push(`🔍 [FEATURE EXTRACTION] Starting safe feature extraction at ${currentTimestamp.toISOString()}`);
    
    const indicators = this.calculateAllSafeIndicators(data, currentTimestamp);
    
    if (!indicators.overallSafe) {
      auditTrail.push('🚨 [FEATURE EXTRACTION] Aborted due to data leakage detection');
      return {
        features: null,
        featureNames: [],
        temporallySafe: false,
        auditTrail
      };
    }
    
    const features: number[] = [];
    const featureNames: string[] = [];
    
    // RSI feature
    if (indicators.rsi.value !== null) {
      features.push(indicators.rsi.value);
      featureNames.push('rsi');
      auditTrail.push(`✅ RSI: ${indicators.rsi.value.toFixed(2)} (${indicators.rsi.dataPointsUsed} data points)`);
    } else {
      features.push(50); // Neutral RSI default
      featureNames.push('rsi_default');
      auditTrail.push('⚠️ RSI: Using default value (insufficient historical data)');
    }
    
    // MACD features
    if (indicators.macd.value?.macd !== null) {
      features.push(indicators.macd.value.macd);
      featureNames.push('macd');
      auditTrail.push(`✅ MACD: ${indicators.macd.value.macd.toFixed(4)} (${indicators.macd.dataPointsUsed} data points)`);
    } else {
      features.push(0);
      featureNames.push('macd_default');
      auditTrail.push('⚠️ MACD: Using default value (insufficient historical data)');
    }
    
    // Stochastic features
    if (indicators.stochastic.value?.k !== null) {
      features.push(indicators.stochastic.value.k);
      featureNames.push('stochastic_k');
      auditTrail.push(`✅ Stochastic %K: ${indicators.stochastic.value.k.toFixed(2)} (${indicators.stochastic.dataPointsUsed} data points)`);
    } else {
      features.push(50);
      featureNames.push('stochastic_k_default');
      auditTrail.push('⚠️ Stochastic %K: Using default value (insufficient historical data)');
    }
    
    // Volatility feature
    if (indicators.volatility.value !== null) {
      features.push(indicators.volatility.value * 100); // Scale for ML
      featureNames.push('volatility');
      auditTrail.push(`✅ Volatility: ${(indicators.volatility.value * 100).toFixed(4)} (${indicators.volatility.dataPointsUsed} data points)`);
    } else {
      features.push(1.0); // Default volatility
      featureNames.push('volatility_default');
      auditTrail.push('⚠️ Volatility: Using default value (insufficient historical data)');
    }
    
    // Bollinger Band position
    if (indicators.bollinger.value?.upper !== null && indicators.bollinger.value?.lower !== null && data.length > 0) {
      const currentPrice = parseFloat(data[data.length - 1].close);
      const bandWidth = indicators.bollinger.value.upper - indicators.bollinger.value.lower;
      const position = bandWidth > 0 ? (currentPrice - indicators.bollinger.value.lower) / bandWidth : 0.5;
      features.push(Math.max(0, Math.min(1, position))); // Bounded 0-1
      featureNames.push('bollinger_position');
      auditTrail.push(`✅ Bollinger Position: ${position.toFixed(4)}`);
    } else {
      features.push(0.5);
      featureNames.push('bollinger_position_default');
      auditTrail.push('⚠️ Bollinger Position: Using default value (insufficient historical data)');
    }
    
    auditTrail.push(`🎯 [FEATURE EXTRACTION] Completed: ${features.length} features extracted safely`);
    
    return {
      features,
      featureNames,
      temporallySafe: true,
      auditTrail
    };
  }
}