/**
 * ML System Configuration
 * 
 * Centralized configuration for all ML infrastructure components including
 * feature calculation, model training, inference, and monitoring parameters.
 */

export interface FeatureConfig {
  // RSI Configuration
  rsiPeriod: number;                // Default: 14 periods
  rsiOverbought: number;            // Default: 70
  rsiOversold: number;              // Default: 30
  
  // MACD Configuration
  macdFast: number;                 // Default: 12 periods
  macdSlow: number;                 // Default: 26 periods
  macdSignal: number;               // Default: 9 periods
  
  // Bollinger Bands Configuration
  bollingerPeriod: number;          // Default: 20 periods
  bollingerStdDev: number;          // Default: 2 standard deviations
  
  // Stochastic Configuration
  stochasticK: number;              // Default: 14 periods for %K
  stochasticD: number;              // Default: 3 periods for %D smoothing
  stochasticOverbought: number;     // Default: 80
  stochasticOversold: number;       // Default: 20
  
  // Volatility Configuration
  volatilityWindow: number;         // Default: 5 periods for rolling volatility
  volatilityAnnualized: boolean;    // Default: true (annualize volatility)
  
  // Moving Average Configuration
  emaPeriods: number[];             // Default: [9, 21, 50, 200]
  smaPeriods: number[];             // Default: [10, 20, 50]
  
  // Volume Analysis
  volumeMA: number;                 // Default: 20 periods for volume moving average
  volumeSpikeFactor: number;        // Default: 2.0 (spike detection threshold)
}

export interface TrainingConfig {
  // Data Windows
  windowSize: number;               // Default: 600 minutes (10 hours)
  forecastHorizons: number[];       // Default: [5, 15, 30, 60] minutes
  lookbackPeriods: number[];        // Default: [50, 100, 200] for feature history
  
  // Training Parameters
  validationSplit: number;          // Default: 0.2 (20% for validation)
  testSplit: number;                // Default: 0.1 (10% for testing)
  batchSize: number;                // Default: 1000 samples
  maxEpochs: number;                // Default: 100
  earlyStoppingPatience: number;    // Default: 10 epochs
  learningRate: number;             // Default: 0.001
  
  // Model Types
  modelTypes: string[];             // Default: ['xgboost', 'lstm', 'ensemble']
  ensembleWeights: Record<string, number>; // Model voting weights
  
  // Feature Engineering
  featureSelection: boolean;        // Default: true (automatic feature selection)
  featureScaling: 'standard' | 'minmax' | 'robust'; // Default: 'standard'
  targetTransform: 'log' | 'sqrt' | 'none'; // Default: 'none'
  
  // Retraining Schedule
  retrainingFrequency: number;      // Default: 24 hours
  minSamplesForRetraining: number;  // Default: 1000
  performanceThreshold: number;     // Default: 0.05 (5% performance drop triggers retrain)
}

export interface InferenceConfig {
  // Confidence Thresholds
  confidenceThreshold: number;      // Default: 60% minimum confidence
  profitLikelihoodThreshold: number; // Default: 40% minimum profit likelihood
  
  // Ensemble Configuration
  ensembleMethod: 'voting' | 'stacking' | 'blending'; // Default: 'voting'
  ensembleWeights: Record<string, number>; // Model weights for ensemble
  
  // Prediction Caching
  predictionCache: boolean;         // Default: true
  maxPredictionAge: number;         // Default: 300 seconds (5 minutes)
  cacheSize: number;                // Default: 1000 predictions
  
  // Performance Optimization
  batchInference: boolean;          // Default: true (batch multiple predictions)
  maxBatchSize: number;             // Default: 100 symbols
  parallelProcessing: boolean;      // Default: true
  
  // Risk Management
  maxPositionSize: number;          // Default: 0.1 (10% of portfolio)
  riskRewardRatio: number;          // Default: 2.0 (minimum R:R ratio)
  maxDailyTrades: number;           // Default: 10 per symbol
}

export interface ForecastConfig {
  // Forecast Horizons
  horizons: number[];               // Default: [5, 15, 30, 60, 240, 1440] minutes
  updateFrequency: number;          // Default: 60 seconds between updates
  
  // Confidence Management
  confidenceDecay: number;          // Default: 0.95 per minute (confidence decay)
  minConfidenceForAction: number;   // Default: 50% minimum for trading signals
  
  // Market Regime Detection
  marketRegimes: string[];          // Default: ['trending', 'ranging', 'volatile']
  regimeDetectionWindow: number;    // Default: 100 periods
  
  // Multi-timeframe Analysis
  timeframes: string[];             // Default: ['1m', '5m', '15m', '1h', '4h', '1d']
  timeframeWeights: Record<string, number>; // Importance weights per timeframe
  
  // Forecast Validation
  trackAccuracy: boolean;           // Default: true
  accuracyWindow: number;           // Default: 100 forecasts for accuracy calculation
  minSampleSize: number;            // Default: 50 forecasts before accuracy tracking
}

export interface MonitorConfig {
  // Data Quality Thresholds
  completenessThreshold: number;    // Default: 0.95 (95% data completeness required)
  freshnessThreshold: number;       // Default: 300 seconds (5 minutes max age)
  
  // Alert Thresholds
  alertThresholds: {
    missingData: number;            // Default: 0.1 (10% missing data triggers alert)
    staleData: number;              // Default: 300 seconds
    invalidValues: number;          // Default: 0.05 (5% invalid values)
    performanceDrop: number;        // Default: 0.15 (15% performance drop)
    latencySpike: number;           // Default: 5000ms (5 second latency)
  };
  
  // Monitoring Intervals
  checkInterval: number;            // Default: 60 seconds between checks
  reportingInterval: number;        // Default: 300 seconds (5 minutes)
  
  // Health Metrics
  enableDetailedMetrics: boolean;   // Default: true
  metricRetention: number;          // Default: 7 days
  aggregationLevels: string[];      // Default: ['minute', 'hour', 'day']
}

export interface SystemConfig {
  environment: 'development' | 'production' | 'testing';
  logLevel: 'debug' | 'info' | 'warning' | 'error';
  enableRecovery: boolean;          // Default: true
  maxConcurrentWorkers: number;     // Default: 4
  
  // Database Configuration
  dataRetentionDays: number;        // Default: 30 days
  compressionThreshold: number;     // Default: 7 days (compress older data)
  backfillBatchSize: number;        // Default: 1000 records
  
  // API Configuration
  rateLimits: {
    binance: number;                // Default: 1200 per minute
    coinbase: number;               // Default: 10000 per hour
    fallbackDelay: number;          // Default: 5000ms between fallback attempts
  };
  
  // Memory Management
  maxMemoryUsage: number;           // Default: 4GB
  garbageCollectionInterval: number; // Default: 300 seconds
  modelCacheSize: number;           // Default: 10 models in memory
}

// Default Configuration
export const defaultMLConfig: MLSystemConfig = {
  system: {
    environment: 'development',
    logLevel: 'info',
    enableRecovery: true,
    maxConcurrentWorkers: 4,
    dataRetentionDays: 30,
    compressionThreshold: 7,
    backfillBatchSize: 1000,
    rateLimits: {
      binance: 1200,
      coinbase: 10000,
      fallbackDelay: 5000
    },
    maxMemoryUsage: 4096,
    garbageCollectionInterval: 300,
    modelCacheSize: 10
  },
  
  features: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    bollingerPeriod: 20,
    bollingerStdDev: 2,
    stochasticK: 14,
    stochasticD: 3,
    stochasticOverbought: 80,
    stochasticOversold: 20,
    volatilityWindow: 5,
    volatilityAnnualized: true,
    emaPeriods: [9, 21, 50, 200],
    smaPeriods: [10, 20, 50],
    volumeMA: 20,
    volumeSpikeFactor: 2.0
  },
  
  training: {
    windowSize: 600,
    forecastHorizons: [5, 15, 30, 60],
    lookbackPeriods: [50, 100, 200],
    validationSplit: 0.2,
    testSplit: 0.1,
    batchSize: 1000,
    maxEpochs: 100,
    earlyStoppingPatience: 10,
    learningRate: 0.001,
    modelTypes: ['xgboost', 'lstm', 'ensemble'],
    ensembleWeights: { xgboost: 0.4, lstm: 0.4, ensemble: 0.2 },
    featureSelection: true,
    featureScaling: 'standard',
    targetTransform: 'none',
    retrainingFrequency: 24 * 60 * 60, // 24 hours in seconds
    minSamplesForRetraining: 1000,
    performanceThreshold: 0.05
  },
  
  inference: {
    confidenceThreshold: 60,
    profitLikelihoodThreshold: 40,
    ensembleMethod: 'voting',
    ensembleWeights: { xgboost: 0.4, lstm: 0.4, ensemble: 0.2 },
    predictionCache: true,
    maxPredictionAge: 300,
    cacheSize: 1000,
    batchInference: true,
    maxBatchSize: 100,
    parallelProcessing: true,
    maxPositionSize: 0.1,
    riskRewardRatio: 2.0,
    maxDailyTrades: 10
  },
  
  forecasting: {
    horizons: [5, 15, 30, 60, 240, 1440],
    updateFrequency: 60,
    confidenceDecay: 0.95,
    minConfidenceForAction: 50,
    marketRegimes: ['trending', 'ranging', 'volatile'],
    regimeDetectionWindow: 100,
    timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
    timeframeWeights: { '1m': 0.1, '5m': 0.2, '15m': 0.3, '1h': 0.25, '4h': 0.1, '1d': 0.05 },
    trackAccuracy: true,
    accuracyWindow: 100,
    minSampleSize: 50
  },
  
  monitoring: {
    completenessThreshold: 0.95,
    freshnessThreshold: 300,
    alertThresholds: {
      missingData: 0.1,
      staleData: 300,
      invalidValues: 0.05,
      performanceDrop: 0.15,
      latencySpike: 5000
    },
    checkInterval: 60,
    reportingInterval: 300,
    enableDetailedMetrics: true,
    metricRetention: 7,
    aggregationLevels: ['minute', 'hour', 'day']
  },
  
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'],
  exchanges: ['binance-us', 'coinbase', 'bybit']
};

// Type exports for use throughout the system
export interface MLSystemConfig {
  system: SystemConfig;
  features: FeatureConfig;
  training: TrainingConfig;
  inference: InferenceConfig;
  forecasting: ForecastConfig;
  monitoring: MonitorConfig;
  symbols: string[];
  exchanges: string[];
}

// Configuration validation
export function validateConfig(config: MLSystemConfig): string[] {
  const errors: string[] = [];
  
  // Validate training configuration
  if (config.training.validationSplit + config.training.testSplit >= 1.0) {
    errors.push('Training splits (validation + test) must be less than 1.0');
  }
  
  if (config.training.windowSize < Math.max(...config.training.forecastHorizons)) {
    errors.push('Window size must be larger than maximum forecast horizon');
  }
  
  // Validate inference configuration
  if (config.inference.confidenceThreshold < 0 || config.inference.confidenceThreshold > 100) {
    errors.push('Confidence threshold must be between 0 and 100');
  }
  
  // Validate monitoring configuration
  if (config.monitoring.completenessThreshold < 0 || config.monitoring.completenessThreshold > 1) {
    errors.push('Completeness threshold must be between 0 and 1');
  }
  
  return errors;
}

// Configuration loader with environment overrides
export function loadConfig(): MLSystemConfig {
  const config = { ...defaultMLConfig };
  
  // Override with environment variables if present
  if (process.env.ML_LOG_LEVEL) {
    config.system.logLevel = process.env.ML_LOG_LEVEL as any;
  }
  
  if (process.env.ML_CONFIDENCE_THRESHOLD) {
    config.inference.confidenceThreshold = parseInt(process.env.ML_CONFIDENCE_THRESHOLD);
  }
  
  if (process.env.ML_WINDOW_SIZE) {
    config.training.windowSize = parseInt(process.env.ML_WINDOW_SIZE);
  }
  
  if (process.env.ML_FORECAST_HORIZONS) {
    config.training.forecastHorizons = process.env.ML_FORECAST_HORIZONS.split(',').map(Number);
  }
  
  // Validate configuration
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  return config;
}