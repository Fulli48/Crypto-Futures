import { pgTable, text, serial, integer, boolean, decimal, timestamp, real, json } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cryptocurrencies = pgTable("cryptocurrencies", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }).notNull(),
  volume24h: decimal("volume_24h", { precision: 20, scale: 2 }).notNull(),
  change24h: decimal("change_24h", { precision: 10, scale: 4 }).notNull(),
  logoUrl: text("logo_url"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  averagePrice: decimal("average_price", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'buy', 'sell', 'swap'
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  total: decimal("total", { precision: 20, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketAlerts = pgTable("market_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  type: text("type").notNull(), // 'price_above', 'price_below', 'volume_spike'
  targetValue: decimal("target_value", { precision: 20, scale: 8 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ENHANCED TRADE SIMULATIONS DATABASE - Stores TP/SL levels and timing data for historical analysis
export const tradeSimulations = pgTable("trade_simulations", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  signalType: text("signal_type").notNull(), // 'LONG' or 'SHORT'
  simulationType: text("simulation_type").notNull().default("SHORT"), // Duration types
  confidence: real("confidence").notNull(),
  profitLikelihood: real("profit_likelihood").notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  tpPrice: decimal("tp_price", { precision: 20, scale: 8 }).notNull(),
  slPrice: decimal("sl_price", { precision: 20, scale: 8 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull().default("1000"), // Position size in USD
  
  // CRITICAL TIMING DATA - Start and end times for historical price analysis
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"), // NULL when trade is active, set when completed
  
  // Trade status and outcome tracking
  actualOutcome: text("actual_outcome").default("IN_PROGRESS"), // IN_PROGRESS, TP_HIT, SL_HIT, PULLOUT_PROFIT, NO_PROFIT, EXPIRED
  profitLoss: decimal("profit_loss", { precision: 10, scale: 4 }).notNull().default("0"),
  profitablePercentage: real("profitable_percentage").notNull().default(0),
  highestProfit: decimal("highest_profit", { precision: 10, scale: 4 }).notNull().default("0"),
  lowestLoss: decimal("lowest_loss", { precision: 10, scale: 4 }).notNull().default("0"),
  
  // Enhanced success score system
  successScore: real("success_score").notNull().default(0),
  successScoreThreshold: real("success_score_threshold").notNull().default(0.1),
  isSuccessful: boolean("is_successful").notNull().default(false),
  timeInProfitRatio: real("time_in_profit_ratio").notNull().default(0),
  maxFavorableExcursion: decimal("max_favorable_excursion", { precision: 10, scale: 4 }).notNull().default("0"),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }).notNull().default("0"),
  durationMinutes: integer("duration_minutes").notNull().default(20),
  finalProfitableSeconds: integer("final_profitable_seconds").notNull().default(0),
  
  // Market conditions and ML metadata
  marketConditions: json("market_conditions"), // ML signal data
  indicatorValues: json("indicator_values"), // Technical indicator snapshot
  
  // Idempotency and processing control
  completionProcessed: boolean("completion_processed").notNull().default(false),
  lastProcessedAt: timestamp("last_processed_at"),
  processVersion: integer("process_version").notNull().default(1),
  
  // Per-second tracking columns for real-time monitoring
  currentProfitPercent: decimal("current_profit_percent", { precision: 10, scale: 4 }).notNull().default("0"),
  profitTime: integer("profit_time").notNull().default(0), // Seconds spent in profit
  lossTime: integer("loss_time").notNull().default(0), // Seconds spent in loss
  lastUpdateTimestamp: timestamp("last_update_timestamp").notNull().defaultNow(),
  
  // Movement analysis fields for filtering low-movement trades
  actualMovementPercent: decimal("actual_movement_percent", { precision: 10, scale: 4 }).notNull().default("0"), // (max_price - min_price) / entry_price * 100
  maxPriceDuringTrade: decimal("max_price_during_trade", { precision: 20, scale: 8 }).notNull().default("0"),
  minPriceDuringTrade: decimal("min_price_during_trade", { precision: 20, scale: 8 }).notNull().default("0"),
  excludedFromLearning: boolean("excluded_from_learning").notNull().default(false), // True if movement < threshold
  movementFilterThreshold: decimal("movement_filter_threshold", { precision: 10, scale: 4 }).notNull().default("0.1"), // 0.1% default threshold
  
  // NEW: Forecast accuracy tracking fields for Per-Minute Forecast Learning Loop
  avgForecastAccuracy: real("avg_forecast_accuracy"), // Average accuracy across all 20 forecast minutes
  earlyAccuracy3min: real("early_accuracy_3min"), // Accuracy for first 3 minutes (early predictor)
  volatilityAlignmentScore: real("volatility_alignment_score"), // How well predicted volatility matched actual
  driftCorrectionApplied: boolean("drift_correction_applied").notNull().default(false), // Whether bias correction was applied
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// HISTORICAL PRICE DATA TABLE - For post-trade analysis and data filling
export const tradeHistoricalPrices = pgTable("trade_historical_prices", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").references(() => tradeSimulations.id, { onDelete: "cascade" }).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 20, scale: 8 }).notNull(),
  high: decimal("high", { precision: 20, scale: 8 }).notNull(),
  low: decimal("low", { precision: 20, scale: 8 }).notNull(),
  close: decimal("close", { precision: 20, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 8 }).notNull(),
  
  // Trade analysis fields for each minute
  profitLossPercent: decimal("profit_loss_percent", { precision: 10, scale: 4 }).notNull(), // P&L percentage at this timestamp
  distanceToTakeProfit: decimal("distance_to_take_profit", { precision: 10, scale: 4 }).notNull(), // Distance to take profit
  distanceToStopLoss: decimal("distance_to_stop_loss", { precision: 10, scale: 4 }).notNull(), // Distance to stop loss
  wasProfitable: boolean("was_profitable").notNull(), // Was this minute profitable for the trade?
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ENHANCED 600-MINUTE ROLLING CHART DATA (New Comprehensive System)
export const rollingChartData = pgTable("rolling_chart_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(), // UTC aligned start of minute (e.g., 14:32:00)
  
  // Core OHLCV Data
  open: decimal("open", { precision: 20, scale: 8 }).notNull(),
  high: decimal("high", { precision: 20, scale: 8 }).notNull(),
  low: decimal("low", { precision: 20, scale: 8 }).notNull(),
  close: decimal("close", { precision: 20, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 8 }).notNull().default("0"),
  
  // Funding and Interest Data
  fundingRate: decimal("funding_rate", { precision: 10, scale: 8 }), // Current funding rate
  nextFundingTime: timestamp("next_funding_time"), // Next funding settlement
  openInterest: decimal("open_interest", { precision: 20, scale: 2 }), // Total open interest
  openInterestChange: decimal("oi_change", { precision: 10, scale: 4 }), // % change in OI
  
  // Raw Trade Data
  tradeCount: integer("trade_count").default(0), // Number of trades this minute
  buyVolume: decimal("buy_volume", { precision: 20, scale: 8 }).default("0"), // Taker buy volume
  sellVolume: decimal("sell_volume", { precision: 20, scale: 8 }).default("0"), // Taker sell volume
  avgTradeSize: decimal("avg_trade_size", { precision: 20, scale: 8 }).default("0"), // Average trade size
  largestTrade: decimal("largest_trade", { precision: 20, scale: 8 }).default("0"), // Largest single trade
  
  // Realized Volatility
  realizedVolatility: real("realized_volatility").default(0), // Minute-level realized volatility
  volatility5min: real("volatility_5min").default(0), // 5-minute rolling volatility
  volatility15min: real("volatility_15min").default(0), // 15-minute rolling volatility
  volatility60min: real("volatility_60min").default(0), // 60-minute rolling volatility
  
  // Technical Indicators
  rsi: real("rsi").default(50),
  macd: real("macd").default(0),
  macdSignal: real("macd_signal").default(0),
  macdHistogram: real("macd_histogram").default(0),
  bollingerUpper: decimal("bollinger_upper", { precision: 20, scale: 8 }).default("0"),
  bollingerMiddle: decimal("bollinger_middle", { precision: 20, scale: 8 }).default("0"),
  bollingerLower: decimal("bollinger_lower", { precision: 20, scale: 8 }).default("0"),
  stochasticK: real("stochastic_k").default(50),
  stochasticD: real("stochastic_d").default(50),
  emaAlignment: integer("ema_alignment").default(0), // -1=bearish, 0=neutral, 1=bullish
  supportLevel: decimal("support_level", { precision: 20, scale: 8 }).default("0"),
  resistanceLevel: decimal("resistance_level", { precision: 20, scale: 8 }).default("0"),
  marketStructure: text("market_structure").default("range"), // "range", "breakout", "trend", "reversal"
  detectedPatterns: json("detected_patterns").default("[]"), // Array of pattern names
  volumeProfile: json("volume_profile").default("{}"), // Volume profile data
  
  // Macro and News Flags
  macroEventFlag: boolean("macro_event_flag").default(false), // Major economic event this minute
  newsImpactScore: real("news_impact_score").default(0), // News sentiment impact (0-100)
  marketRegimeFlag: text("market_regime_flag").default("normal"), // bull/bear/normal/volatile
  
  // Data Quality and Completeness
  isComplete: boolean("is_complete").default(true), // Whether all data fields populated
  hasMissingData: boolean("has_missing_data").default(false), // Flag for partial data
  dataSourceCount: integer("data_source_count").default(1), // Number of sources used
  lastDataUpdate: timestamp("last_data_update").defaultNow(),
  
  // NEW: Data source tracking and quality flags
  source: text("source").notNull().default("BINANCE"), // 'BINANCE', 'FALLBACK', 'BINANCE_BACKFILL'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ENHANCED SIGNALS TABLE - Atomic signal storage with comprehensive metadata
export const enhancedSignals = pgTable("enhanced_signals", {
  id: serial("id").primaryKey(),
  signalId: text("signal_id").notNull().unique(), // SIG_BTCUSDT_1234567890_abc12345
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  
  // Core forecast data
  forecastVector: json("forecast_vector").notNull(), // [f1, f2, ..., f20] as JSON array
  currentPrice: decimal("current_price", { precision: 20, scale: 8 }).notNull(),
  forecastReturn: real("forecast_return").notNull(), // (f20 - current) / current
  forecastSlope: real("forecast_slope").notNull(), // linear regression slope
  modelConfidence: real("model_confidence").notNull(), // base model confidence 0-100
  
  // Technical indicators snapshot
  technicalIndicators: json("technical_indicators").notNull(), // Full snapshot as JSON
  
  // Ensemble and dispersion metrics
  ensembleDispersion: real("ensemble_dispersion").notNull(), // std dev of model forecasts
  modelAgreementScore: real("model_agreement_score").notNull(), // consensus level 0-100
  pathSmoothness: real("path_smoothness").notNull(), // monotonicity score 0-100
  
  // Risk and position data
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  takeProfitPrice: decimal("take_profit_price", { precision: 20, scale: 8 }).notNull(),
  stopLossPrice: decimal("stop_loss_price", { precision: 20, scale: 8 }).notNull(),
  riskRewardRatio: real("risk_reward_ratio").notNull(),
  positionSize: real("position_size").notNull(), // Fraction of account
  
  // Signal quality and meta-model
  qualityScore: real("quality_score").notNull(), // composite quality 0-100
  qualityMetrics: json("quality_metrics").notNull(), // Detailed breakdown as JSON
  metaModelPrediction: real("meta_model_prediction").notNull(), // win probability 0-100
  metaModelVersion: text("meta_model_version").notNull(), // version of meta-model used
  
  // Decision and filtering
  signal: text("signal").notNull(), // 'LONG', 'SHORT', 'WAIT'
  confidence: real("confidence").notNull(), // final confidence 0-100
  suppressionReasons: json("suppression_reasons").notNull(), // Array of suppression reasons
  warnings: json("warnings").notNull(), // Array of quality warnings
  
  // Feature vector for learning
  featureVector: json("feature_vector").notNull(), // Normalized features for meta-model
  featureChecksum: text("feature_checksum").notNull(), // SHA-256 hash for auditability
  
  // Execution tracking
  tradeId: text("trade_id"), // Links to tradeOutcomes if executed
  isExecuted: boolean("is_executed").notNull().default(false),
  executionDetails: json("execution_details"), // Fill details if executed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// TRADE OUTCOMES TABLE - Comprehensive trade result tracking
export const tradeOutcomes = pgTable("trade_outcomes", {
  id: serial("id").primaryKey(),
  tradeId: text("trade_id").notNull().unique(),
  signalId: text("signal_id").notNull().references(() => enhancedSignals.signalId),
  symbol: text("symbol").notNull(),
  
  // Entry/Exit data
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }).notNull(),
  entryTimestamp: timestamp("entry_timestamp").notNull(),
  exitTimestamp: timestamp("exit_timestamp").notNull(),
  exitReason: text("exit_reason").notNull(), // 'TAKE_PROFIT', 'STOP_LOSS', 'TIMEOUT'
  
  // Performance metrics
  realizedPnL: decimal("realized_pnl", { precision: 10, scale: 4 }).notNull(),
  realizedPnLPercent: real("realized_pnl_percent").notNull(),
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }).notNull(),
  maxDrawdownPercent: real("max_drawdown_percent").notNull(),
  timeToTarget: integer("time_to_target").notNull(), // minutes to exit
  realizedVolatility: real("realized_volatility").notNull(),
  
  // Forecast accuracy
  forecastAccuracy: real("forecast_accuracy").notNull(), // how close f20 was to actual
  pathAccuracy: real("path_accuracy").notNull(), // how well forecast path matched
  
  // Trading costs
  totalFees: decimal("total_fees", { precision: 10, scale: 6 }).notNull(),
  totalSlippage: decimal("total_slippage", { precision: 10, scale: 6 }).notNull(),
  netPnL: decimal("net_pnl", { precision: 10, scale: 4 }).notNull(), // after fees and slippage
  
  // Meta-model performance
  predictedWinProb: real("predicted_win_prob").notNull(), // what meta-model predicted
  actualWin: boolean("actual_win").notNull(), // actual outcome
  predictionError: real("prediction_error").notNull(), // calibration error
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// META-MODEL REGISTRY - Version control for learning models
export const metaModelRegistry = pgTable("meta_model_registry", {
  id: serial("id").primaryKey(),
  version: text("version").notNull().unique(), // v1.0.0, v1.1.0, etc.
  modelType: text("model_type").notNull(), // 'logistic_regression', 'xgboost', 'neural_net'
  trainingDataHash: text("training_data_hash").notNull(), // Hash of training dataset
  
  // Training metadata
  trainingStartTime: timestamp("training_start_time").notNull(),
  trainingEndTime: timestamp("training_end_time").notNull(),
  trainingDuration: integer("training_duration").notNull(), // seconds
  trainingDataSize: integer("training_data_size").notNull(), // number of samples
  featureCount: integer("feature_count").notNull(),
  
  // Performance metrics
  validationAccuracy: real("validation_accuracy").notNull(),
  validationPrecision: real("validation_precision").notNull(),
  validationRecall: real("validation_recall").notNull(),
  validationF1Score: real("validation_f1_score").notNull(),
  calibrationScore: real("calibration_score").notNull(), // Brier score
  
  // Model configuration
  hyperparameters: json("hyperparameters").notNull(),
  featureImportance: json("feature_importance").notNull(),
  
  // Production status
  isProduction: boolean("is_production").notNull().default(false),
  promotedAt: timestamp("promoted_at"),
  retiredAt: timestamp("retired_at"),
  
  // Storage and deployment
  modelArtifactPath: text("model_artifact_path").notNull(),
  modelSize: integer("model_size").notNull(), // bytes
  inferenceLatency: real("inference_latency").default(0), // ms average
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// LEARNING DATASET - ETL pipeline output for model training
export const learningDataset = pgTable("learning_dataset", {
  id: serial("id").primaryKey(),
  datasetVersion: text("dataset_version").notNull(), // v2025-08-02T17:41:00
  signalId: text("signal_id").notNull().references(() => enhancedSignals.signalId),
  
  // Features (normalized)
  inputFeatures: json("input_features").notNull(), // Normalized feature vector
  technicalFeatures: json("technical_features").notNull(), // Technical indicator features
  ensembleFeatures: json("ensemble_features").notNull(), // Model output features
  marketContextFeatures: json("market_context_features").notNull(), // Volatility, volume, etc.
  
  // Labels and outcomes
  profitLabel: boolean("profit_label").notNull(), // True if profitable
  pnlLabel: real("pnl_label").notNull(), // Actual P&L percent
  drawdownLabel: real("drawdown_label").notNull(), // Max drawdown percent
  timeToTargetLabel: integer("time_to_target_label"), // Minutes to exit (null if timeout)
  
  // Meta-model predictions (at time of signal)
  metaModelPrediction: real("meta_model_prediction").notNull(),
  metaModelVersion: text("meta_model_version").notNull(),
  
  // Quality flags
  isValidSample: boolean("is_valid_sample").notNull().default(true),
  hasOutcome: boolean("has_outcome").notNull().default(false),
  outlierFlag: boolean("outlier_flag").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ORDERBOOK DATA TABLE - Top 10 levels for each minute
export const orderbookData = pgTable("orderbook_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(), // UTC aligned minute timestamp
  
  // Bid side (top 10 levels)
  bidPrices: json("bid_prices").notNull().default("[]"), // Array of bid prices [p1, p2, ..., p10]
  bidSizes: json("bid_sizes").notNull().default("[]"), // Array of bid sizes [s1, s2, ..., s10]
  
  // Ask side (top 10 levels)
  askPrices: json("ask_prices").notNull().default("[]"), // Array of ask prices [p1, p2, ..., p10]
  askSizes: json("ask_sizes").notNull().default("[]"), // Array of ask sizes [s1, s2, ..., s10]
  
  // Calculated metrics
  spreadPercent: real("spread_percent").notNull(), // Bid-ask spread percentage
  bidDepth: decimal("bid_depth", { precision: 20, scale: 2 }).notNull(), // Total bid depth (top 10)
  askDepth: decimal("ask_depth", { precision: 20, scale: 2 }).notNull(), // Total ask depth (top 10)
  midPrice: decimal("mid_price", { precision: 20, scale: 8 }).notNull(), // (best_bid + best_ask) / 2
  imbalanceRatio: real("imbalance_ratio").notNull(), // Bid depth / (bid depth + ask depth)
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RAW TRADE TICKS TABLE - Individual trade records for minute aggregation
export const tradeTicks = pgTable("trade_ticks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(), // Exact trade timestamp
  minuteTimestamp: timestamp("minute_timestamp").notNull(), // UTC minute bucket this trade belongs to
  
  // Trade details
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  size: decimal("size", { precision: 20, scale: 8 }).notNull(),
  side: text("side").notNull(), // "buy" or "sell" (taker side)
  tradeId: text("trade_id"), // Exchange trade ID if available
  
  // Calculated fields
  notionalValue: decimal("notional_value", { precision: 20, scale: 2 }).notNull(), // price * size
  isLargeTrade: boolean("is_large_trade").default(false), // Above certain threshold
  priceImpact: real("price_impact").default(0), // Price change from previous trade
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// FORECAST PERFORMANCE TABLE - Tracks ML prediction accuracy against actual outcomes
export const forecastPerformance = pgTable("forecast_performance", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  forecast_timestamp: timestamp("forecast_timestamp").notNull().defaultNow(),
  
  // Forecast data (when prediction was made)
  initial_price: decimal("initial_price", { precision: 20, scale: 8 }).notNull(),
  forecast_price: decimal("forecast_price", { precision: 20, scale: 8 }).notNull(),
  forecast_change: real("forecast_change").notNull(), // Predicted percentage change
  confidence: real("confidence").notNull(), // Model confidence 0-100
  market_conditions: json("market_conditions"), // Context at prediction time
  signal_strength: real("signal_strength").default(0),
  
  // Actual outcome data (populated after 20 minutes)
  actual_timestamp: timestamp("actual_timestamp"),
  actual_price: decimal("actual_price", { precision: 20, scale: 8 }),
  actual_change: real("actual_change"), // Actual percentage change
  accuracy: real("accuracy"), // How close forecast was to actual (0-100)
  is_successful: boolean("is_successful"), // Did direction match
  profit_potential: real("profit_potential"), // Theoretical profit if traded
  
  // Completion tracking
  is_completed: boolean("is_completed").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Legacy chart data table (keeping for compatibility with existing system)
export const liveChartData = pgTable("live_chart_data", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  open: decimal("open", { precision: 20, scale: 8 }).notNull(),
  high: decimal("high", { precision: 20, scale: 8 }).notNull(),
  low: decimal("low", { precision: 20, scale: 8 }).notNull(),
  close: decimal("close", { precision: 20, scale: 8 }).notNull(),
  volume: decimal("volume", { precision: 20, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Live ML Trade Signals for Real-time Updates
export const liveMLSignals = pgTable("live_ml_signals", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  signal: text("signal").notNull(), // 'LONG', 'SHORT', 'WAIT'
  confidence: real("confidence").notNull(),
  profitLikelihood: real("profit_likelihood").notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  takeProfit: decimal("take_profit", { precision: 20, scale: 8 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 20, scale: 8 }).notNull(),
  riskRewardRatio: real("risk_reward_ratio").notNull(),
  modelExplanation: text("model_explanation").notNull(),
  featureImportance: json("feature_importance").notNull().default('{}'),
  isFiltered: boolean("is_filtered").notNull().default(false),
  filterReason: text("filter_reason"),
  qualityTier: text("quality_tier").notNull(), // 'QUALITY', 'MODERATE', 'WEAK', 'LEARNING'
  currentPrice: decimal("current_price", { precision: 20, scale: 8 }).notNull(),
  unrealizedPnl: real("unrealized_pnl").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Learning Analytics Counter - tracks trades analyzed for learning
export const learningAnalytics = pgTable("learning_analytics", {
  id: serial("id").primaryKey(),
  totalAnalyzedTrades: integer("total_analyzed_trades").notNull().default(0),
  shortTypeAnalyzed: integer("short_type_analyzed").notNull().default(0),
  mediumTypeAnalyzed: integer("medium_type_analyzed").notNull().default(0),
  longTypeAnalyzed: integer("long_type_analyzed").notNull().default(0),
  lastAnalyzedAt: timestamp("last_analyzed_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Algorithm Success Snapshots Table - tracks success rate at each trade completion
export const algorithmSuccessSnapshots = pgTable("algorithm_success_snapshots", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().references(() => tradeSimulations.id),
  successRateAtCompletion: real("success_rate_at_completion").notNull(),
  totalTradesAtTime: integer("total_trades_at_time").notNull(),
  successfulTradesAtTime: integer("successful_trades_at_time").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const learningWeights = pgTable("learning_weights", {
  id: serial("id").primaryKey(),
  indicatorName: text("indicator_name").notNull().unique(),
  weightValue: real("weight_value").notNull().default(1.0),
  performanceScore: real("performance_score").notNull().default(0.5),
  sampleSize: integer("sample_size").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const patternPerformance = pgTable("pattern_performance", {
  id: serial("id").primaryKey(),
  patternName: text("pattern_name").notNull(),
  marketCondition: text("market_condition").notNull(), // 'UPTREND', 'DOWNTREND', 'SIDEWAYS'
  successRate: real("success_rate").notNull().default(0.5),
  avgProfit: decimal("avg_profit", { precision: 10, scale: 4 }).notNull().default("0"),
  sampleSize: integer("sample_size").notNull().default(0),
  confidenceThreshold: integer("confidence_threshold").notNull().default(50),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey(),
  metric_name: text("metric_name").notNull().unique(),
  metric_value: real("metric_value").notNull(),
  description: text("description"),
  last_updated: timestamp("last_updated").notNull().defaultNow(),
});

// MULTI-HORIZON FORECAST ACCURACY TRACKING SYSTEM
// Tracks minute-by-minute forecast accuracy for different time horizons (1-20 minutes)
export const forecastAccuracyHistory = pgTable("forecast_accuracy_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  forecastTimestamp: timestamp("forecast_timestamp").notNull(),
  horizonMinute: integer("horizon_minute").notNull(), // 1 to 20
  predictedPrice: decimal("predicted_price", { precision: 20, scale: 8 }).notNull(),
  actualPrice: decimal("actual_price", { precision: 20, scale: 8 }),
  directionCorrect: boolean("direction_correct"),
  absoluteErrorPct: real("absolute_error_pct"),
  regime: text("regime"), // TREND_UP, TREND_DOWN, SIDEWAYS
  baseModel: text("base_model").notNull(), // LSTM, ARIMA, GBoost, Ridge, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Horizon-specific feature weights for different time ranges
export const horizonFeatureWeights = pgTable("horizon_feature_weights", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  horizonRange: text("horizon_range").notNull(), // '1-5', '6-12', '13-20'
  featureName: text("feature_name").notNull(),
  weightValue: real("weight_value").notNull().default(1.0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Model performance scores per regime and horizon
export const regimeModelScores = pgTable("regime_model_scores", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  regime: text("regime").notNull(), // TREND_UP, TREND_DOWN, SIDEWAYS
  baseModel: text("base_model").notNull(),
  horizonMinute: integer("horizon_minute").notNull(),
  accuracy: real("accuracy").notNull().default(0.0),
  sampleSize: integer("sample_size").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});



// Persistent Forecast Database - stores minute-by-minute predictions with proper price precision
export const persistentForecasts = pgTable("persistent_forecasts", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  forecastKey: text("forecast_key").notNull().unique(), // Format: SYMBOL_timestamp_sequence (e.g., BTCUSDT_1753468800000_001)
  baseTimestamp: timestamp("base_timestamp").notNull(), // When forecast was generated
  
  // Price precision matching - dynamically determined by current price
  basePricePrecision: integer("base_price_precision").notNull(), // Number of decimal places to match current price
  basePrice: decimal("base_price", { precision: 20, scale: 8 }).notNull(), // Current price when forecast was generated
  
  // Forecast validity and update tracking
  isActive: boolean("is_active").notNull().default(true), // Whether this forecast is currently being used
  lastAdjustedAt: timestamp("last_adjusted_at").notNull().defaultNow(), // When forecast was last dynamically adjusted
  adjustmentCount: integer("adjustment_count").notNull().default(0), // Number of adjustments made
  
  // Forecast metadata
  forecastType: text("forecast_type").notNull().default("ML_ENGINE"), // Type of forecast engine used
  confidenceScore: real("confidence_score").notNull().default(0), // Overall forecast confidence
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Individual forecast points - minute-by-minute predictions
export const persistentForecastPoints = pgTable("persistent_forecast_points", {
  id: serial("id").primaryKey(),
  forecastId: integer("forecast_id").notNull().references(() => persistentForecasts.id, { onDelete: 'cascade' }),
  
  // Time progression
  futureTimestamp: timestamp("future_timestamp").notNull(), // Exact minute being predicted
  minutesAhead: integer("minutes_ahead").notNull(), // 1-20 minutes from base time
  
  // OHLC predictions with dynamic precision
  predictedOpen: decimal("predicted_open", { precision: 20, scale: 8 }).notNull(),
  predictedHigh: decimal("predicted_high", { precision: 20, scale: 8 }).notNull(),
  predictedLow: decimal("predicted_low", { precision: 20, scale: 8 }).notNull(),
  predictedClose: decimal("predicted_close", { precision: 20, scale: 8 }).notNull(),
  predictedVolume: decimal("predicted_volume", { precision: 20, scale: 8 }).notNull().default("1000"),
  
  // Prediction quality and confidence
  confidence: real("confidence").notNull(), // Confidence for this specific minute
  volatility: real("volatility").notNull().default(0.02), // Expected volatility for this minute
  
  // Dynamic adjustment tracking
  originalPrediction: decimal("original_prediction", { precision: 20, scale: 8 }).notNull(), // Original close prediction
  adjustmentFactor: real("adjustment_factor").notNull().default(1.0), // Multiplier applied for current price alignment
  
  // Pattern and trend indicators
  trendDirection: text("trend_direction").notNull().default("neutral"), // bullish, bearish, neutral
  supportLevel: decimal("support_level", { precision: 20, scale: 8 }), // Nearest support level
  resistanceLevel: decimal("resistance_level", { precision: 20, scale: 8 }), // Nearest resistance level
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ML TRAINING DATA SAMPLES - Continuous sampling from rolling chart data for ML model training
export const mlTrainingSamples = pgTable("ml_training_samples", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  sampleKey: text("sample_key").notNull().unique(), // Format: SYMBOL_timestamp_sequence (e.g., BTCUSDT_1753468800000_001)
  
  // Sample metadata
  baseTimestamp: timestamp("base_timestamp").notNull(), // Timestamp of the first row in the 120-row input sequence
  targetTimestamp: timestamp("target_timestamp").notNull(), // Timestamp of the first target price (120 rows after base)
  windowStart: timestamp("window_start").notNull(), // Start of the 10-hour (600 row) scanning window
  windowEnd: timestamp("window_end").notNull(), // End of the 10-hour scanning window
  
  // Input sequence data (120 rows of all features)
  inputSequence: json("input_sequence").notNull(), // Array of 120 normalized feature vectors
  inputMetadata: json("input_metadata").notNull(), // Normalization parameters (mean/std) for each feature
  
  // Target sequence data (20 future close prices)
  targetPricesRaw: json("target_prices_raw").notNull(), // Array of 20 unnormalized close prices
  targetPricesNormalized: json("target_prices_normalized").notNull(), // Array of 20 normalized close prices
  targetVolumes: json("target_volumes").notNull(), // Array of 20 corresponding volumes for context
  
  // Data quality indicators
  hasCompleteInput: boolean("has_complete_input").notNull().default(true), // All 120 input rows have complete data
  hasCompleteTarget: boolean("has_complete_target").notNull().default(true), // All 20 target rows have complete data
  missingInputFields: json("missing_input_fields").default("[]"), // Array of field names missing in input
  missingTargetFields: json("missing_target_fields").default("[]"), // Array of field names missing in target
  
  // Sample statistics for quality assessment
  inputDataCompleteness: real("input_data_completeness").notNull().default(100.0), // Percentage of complete input data points
  targetDataCompleteness: real("target_data_completeness").notNull().default(100.0), // Percentage of complete target data points
  priceVolatility: real("price_volatility").notNull().default(0), // Volatility during the entire sample period
  
  // Training status
  isTrainingReady: boolean("is_training_ready").notNull().default(false), // Ready for ML training (no missing data)
  usedInTraining: boolean("used_in_training").notNull().default(false), // Has been used in a training batch
  trainingBatchId: text("training_batch_id"), // ID of training batch this sample was included in
  
  // Performance tracking
  validationAccuracy: real("validation_accuracy"), // If used in validation, what was the prediction accuracy
  predictionError: real("prediction_error"), // Mean absolute error when this sample was used for prediction
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ML TRAINING BATCHES - Groups of training samples used together for model training
export const mlTrainingBatches = pgTable("ml_training_batches", {
  id: serial("id").primaryKey(),
  batchKey: text("batch_key").notNull().unique(), // Format: BATCH_timestamp_symbolcount (e.g., BATCH_1753468800000_6symbols)
  
  // Batch composition
  symbolsIncluded: json("symbols_included").notNull(), // Array of symbols included in this batch
  totalSamples: integer("total_samples").notNull(), // Total number of training samples in this batch
  samplesPerSymbol: json("samples_per_symbol").notNull(), // Object with count per symbol
  
  // Training data window
  dataWindowStart: timestamp("data_window_start").notNull(), // Earliest data timestamp used
  dataWindowEnd: timestamp("data_window_end").notNull(), // Latest data timestamp used
  
  // Model configuration
  modelArchitecture: text("model_architecture").notNull().default("LSTM"), // Type of ML model used
  inputFeatures: json("input_features").notNull(), // Array of feature names used as inputs
  normalizationParams: json("normalization_params").notNull(), // Global normalization parameters for this batch
  
  // Training results
  trainingAccuracy: real("training_accuracy"), // Accuracy on training set
  validationAccuracy: real("validation_accuracy"), // Accuracy on validation set
  trainingLoss: real("training_loss"), // Final training loss
  validationLoss: real("validation_loss"), // Final validation loss
  epochs: integer("epochs"), // Number of training epochs completed
  
  // Status tracking
  status: text("status").notNull().default("PENDING"), // PENDING, TRAINING, COMPLETED, FAILED
  trainingStartedAt: timestamp("training_started_at"),
  trainingCompletedAt: timestamp("training_completed_at"),
  errorMessage: text("error_message"), // Error details if training failed
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Store second-by-second real chart data collected during trade simulations
export const tradeChartData = pgTable("trade_chart_data", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().references(() => tradeSimulations.id, { onDelete: 'cascade' }), // Foreign key with cascade delete
  timestamp: timestamp("timestamp").notNull(),
  secondsSinceEntry: integer("seconds_since_entry").notNull(), // Seconds elapsed since trade entry
  
  // Current tick data
  currentPrice: decimal("current_price", { precision: 20, scale: 8 }).notNull(),
  currentProfitPercent: decimal("current_profit_percent", { precision: 10, scale: 4 }).notNull(), // Current P&L vs entry
  
  // Cumulative time tracking (accurately calculated per-second)
  profitTime: integer("profit_time").notNull(), // Cumulative seconds in profit
  lossTime: integer("loss_time").notNull(), // Cumulative seconds in loss
  
  // Static trade data (for reference in each tick)
  takeProfit: decimal("take_profit", { precision: 20, scale: 8 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 20, scale: 8 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  profitChance: decimal("profit_chance", { precision: 5, scale: 2 }).notNull(), // Algorithm's prediction %
  tradeDurationType: text("trade_duration_type").notNull(), // "SHORT", "MEDIUM", "LONG"
  suggestedDirection: text("suggested_direction").notNull(), // "LONG" or "SHORT"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Adaptive Boldness System - tracks forecast accuracy and adjusts prediction boldness
export const forecastAccuracyTracking = pgTable("forecast_accuracy_tracking", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  forecastWindowId: text("forecast_window_id").notNull().unique(),
  
  // Forecast parameters at creation time
  boldnessMultiplier: real("boldness_multiplier").notNull().default(2.5), // Starting multiplier for price movements
  baseConfidence: real("base_confidence").notNull(), // Algorithm confidence when forecast was made
  learningWeightsSnapshot: json("learning_weights_snapshot"), // RSI, MACD weights when forecast was created
  
  // Accuracy tracking (filled after forecast window completes)
  meanAbsoluteError: real("mean_absolute_error"), // Average prediction error across 20 minutes
  accuracyPercentage: real("accuracy_percentage"), // Overall accuracy % vs actual prices
  maxDeviationPercent: real("max_deviation_percent"), // Worst single prediction error
  consecutiveAccurateMinutes: integer("consecutive_accurate_minutes"), // Longest streak of accurate predictions
  
  // Adaptive adjustment results
  newBoldnessMultiplier: real("new_boldness_multiplier"), // Updated multiplier based on accuracy
  shouldIncreaseBoldness: boolean("should_increase_boldness"), // Decision to be more/less bold
  targetAccuracyReached: boolean("target_accuracy_reached"), // True if 75%+ accuracy achieved
  
  // Timestamps
  forecastCreatedAt: timestamp("forecast_created_at").notNull(),
  forecastCompletedAt: timestamp("forecast_completed_at"),
  accuracyCalculatedAt: timestamp("accuracy_calculated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// System-wide adaptive boldness metrics
export const adaptiveBoldnessMetrics = pgTable("adaptive_boldness_metrics", {
  id: serial("id").primaryKey(),
  
  // Current system state
  globalBoldnessMultiplier: real("global_boldness_multiplier").notNull().default(2.5),
  recentAccuracyPercentage: real("recent_accuracy_percentage").notNull().default(60.0),
  consecutiveAccurateForecasts: integer("consecutive_accurate_forecasts").notNull().default(0),
  consecutiveInaccurateForecasts: integer("consecutive_inaccurate_forecasts").notNull().default(0),
  
  // Target achievement tracking
  targetAccuracyGoal: real("target_accuracy_goal").notNull().default(75.0), // 75% accuracy goal
  achievedTargetStreak: integer("achieved_target_streak").notNull().default(0), // How many times in a row hit 75%+
  timeInTargetZone: integer("time_in_target_zone").notNull().default(0), // Minutes spent at 75%+ accuracy
  convergenceState: text("convergence_state").notNull().default("LEARNING"), // LEARNING, CONVERGING, CONVERGED
  
  // Performance tracking
  totalForecastWindows: integer("total_forecast_windows").notNull().default(0),
  accurateWindows: integer("accurate_windows").notNull().default(0), // Windows with 75%+ accuracy
  overallSuccessRate: real("overall_success_rate").notNull().default(0.0), // % of windows achieving 75%+ accuracy
  
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Hourly Success Rate Snapshots Table
export const hourlySuccessSnapshots = pgTable("hourly_success_snapshots", {
  id: serial("id").primaryKey(),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull(),
  totalTrades: integer("total_trades").notNull(),
  successfulTrades: integer("successful_trades").notNull(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// ML Prediction History for Adaptive Threshold Calculation
export const mlPredictionHistory = pgTable("ml_prediction_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  confidence: integer("confidence").notNull(), // 45-85% range
  profitLikelihood: integer("profit_likelihood").notNull(), // 40-80% range
  signal: text("signal").notNull(), // 'LONG', 'SHORT', 'WAIT'
  wasFiltered: boolean("was_filtered").notNull().default(false),
  filterReason: text("filter_reason"), // Reason for filtering (if applicable)
  
  // Threshold values at time of prediction
  minConfidenceThreshold: integer("min_confidence_threshold"),
  minProfitLikelihoodThreshold: integer("min_profit_likelihood_threshold"),
  avgConfidence: real("avg_confidence"),
  stdConfidence: real("std_confidence"),
  avgProfitLikelihood: real("avg_profit_likelihood"),
  stdProfitLikelihood: real("std_profit_likelihood"),
  
  // Model info
  modelExplanation: text("model_explanation"),
  featureImportance: json("feature_importance"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ML Engine State Persistence - Stores ML learning state across server restarts
export const mlEngineState = pgTable("ml_engine_state", {
  id: serial("id").primaryKey(),
  stateKey: text("state_key").notNull().unique(), // 'feature_weights', 'adaptive_thresholds', 'performance_metrics', etc.
  
  // Feature weights storage
  featureWeights: json("feature_weights"), // Map of feature names to weight values
  previousWeights: json("previous_weights"), // Previous weight values for comparison
  startingWeights: json("starting_weights"), // Original starting weights for tracking
  
  // Adaptive threshold state
  predictionBuffer: json("prediction_buffer"), // Buffer of recent predictions for threshold calculation
  currentThresholds: json("current_thresholds"), // Current threshold values
  
  // Performance metrics
  performanceMetrics: json("performance_metrics"), // Success rates and performance data
  
  // Training state
  weightAdjustmentCount: integer("weight_adjustment_count").default(0),
  lastTrainingTime: timestamp("last_training_time"),
  lastWeightRefresh: timestamp("last_weight_refresh"),
  trainingCycle: integer("training_cycle").default(0),
  
  // Experiment logs
  experimentLogs: json("experiment_logs"), // Array of experiment results
  
  // Initialization status
  isInitialized: boolean("is_initialized").default(false),
  
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCryptocurrencySchema = createInsertSchema(cryptocurrencies).omit({
  id: true,
  lastUpdated: true,
});

export const insertTradeChartDataSchema = createInsertSchema(tradeChartData).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertMarketAlertSchema = createInsertSchema(marketAlerts).omit({
  id: true,
  createdAt: true,
});

// Enhanced Trade Simulations with timing data
export const insertTradeSimulationSchema = createInsertSchema(tradeSimulations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Historical Price Data for post-trade analysis  
export const insertTradeHistoricalPriceSchema = createInsertSchema(tradeHistoricalPrices).omit({
  id: true,
  createdAt: true,
});

export const insertLearningWeightSchema = createInsertSchema(learningWeights).omit({
  id: true,
  lastUpdated: true,
});

export const insertPatternPerformanceSchema = createInsertSchema(patternPerformance).omit({
  id: true,
  lastUpdated: true,
});

export const insertSystemMetricSchema = createInsertSchema(systemMetrics).omit({
  id: true,
  last_updated: true,
});

export const insertMLPredictionHistorySchema = createInsertSchema(mlPredictionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertLearningAnalyticsSchema = createInsertSchema(learningAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlgorithmSuccessSnapshotSchema = createInsertSchema(algorithmSuccessSnapshots).omit({
  id: true,
  completedAt: true,
});

export const insertForecastAccuracyTrackingSchema = createInsertSchema(forecastAccuracyTracking).omit({
  id: true,
  createdAt: true,
});

export const insertAdaptiveBoldnessMetricsSchema = createInsertSchema(adaptiveBoldnessMetrics).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

// Enhanced Trade Simulations and Historical Price Data TypeScript Types
export type InsertTradeSimulation = z.infer<typeof insertTradeSimulationSchema>;
export type TradeSimulation = typeof tradeSimulations.$inferSelect;


export type InsertTradeHistoricalPrice = z.infer<typeof insertTradeHistoricalPriceSchema>;
export type TradeHistoricalPrice = typeof tradeHistoricalPrices.$inferSelect;

export type Cryptocurrency = typeof cryptocurrencies.$inferSelect;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type MarketAlert = typeof marketAlerts.$inferSelect;
export type LearningWeight = typeof learningWeights.$inferSelect;
export type LearningAnalytics = typeof learningAnalytics.$inferSelect;
export type PatternPerformance = typeof patternPerformance.$inferSelect;
export type SystemMetric = typeof systemMetrics.$inferSelect;
export type AlgorithmSuccessSnapshot = typeof algorithmSuccessSnapshots.$inferSelect;
export type ForecastAccuracyTracking = typeof forecastAccuracyTracking.$inferSelect;
export type AdaptiveBoldnessMetrics = typeof adaptiveBoldnessMetrics.$inferSelect;

export type InsertCryptocurrency = z.infer<typeof insertCryptocurrencySchema>;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertMarketAlert = z.infer<typeof insertMarketAlertSchema>;
export type InsertLearningWeight = z.infer<typeof insertLearningWeightSchema>;
export type InsertPatternPerformance = z.infer<typeof insertPatternPerformanceSchema>;
export type InsertSystemMetric = z.infer<typeof insertSystemMetricSchema>;

export interface PortfolioOverview {
  totalValue: number;
  dailyPL: number;
  dailyPLPercentage: number;
  activePositions: number;
  bestPerformer: {
    symbol: string;
    change: number;
  };
}

export interface CryptoWithValue extends Cryptocurrency {
  value?: number;
  holdingAmount?: number;
}

// Forecast accuracy tracking tables for adaptive learning loop
export const forecastWindows = pgTable("forecast_windows", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  forecastGeneratedAt: timestamp("forecast_generated_at").notNull(),
  forecastStartTime: timestamp("forecast_start_time").notNull(),
  forecastEndTime: timestamp("forecast_end_time").notNull(),
  algorithmVersion: text("algorithm_version").notNull().default("1.0"),
  algorithmSuccessRate: real("algorithm_success_rate").notNull(),
  meanAbsoluteError: real("mean_absolute_error"), // Set after actual data is available
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const forecastPoints = pgTable("forecast_points", {
  id: serial("id").primaryKey(),
  forecastWindowId: integer("forecast_window_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  predictedPrice: decimal("predicted_price", { precision: 20, scale: 8 }).notNull(),
  actualPrice: decimal("actual_price", { precision: 20, scale: 8 }), // Set later when actual data is available
  absoluteError: decimal("absolute_error", { precision: 20, scale: 8 }), // |predicted - actual|
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adaptiveParameters = pgTable("adaptive_parameters", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  parameterName: text("parameter_name").notNull(), // e.g., 'rsi_weight', 'trend_strength', 'volatility_multiplier'
  parameterValue: real("parameter_value").notNull(),
  lastMAE: real("last_mae"), // Mean Absolute Error from last forecast
  adjustmentDirection: text("adjustment_direction"), // 'increase', 'decrease', 'stable'
  adjustmentCount: integer("adjustment_count").notNull().default(0),
  lastAdjustedAt: timestamp("last_adjusted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema exports for adaptive learning
export const insertForecastWindowSchema = createInsertSchema(forecastWindows).omit({
  id: true,
  createdAt: true,
});

export const insertForecastPointSchema = createInsertSchema(forecastPoints).omit({
  id: true,
  createdAt: true,
});

export const insertAdaptiveParameterSchema = createInsertSchema(adaptiveParameters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types for persistent forecasts
export type PersistentForecast = typeof persistentForecasts.$inferSelect;
export type InsertPersistentForecast = z.infer<typeof insertPersistentForecastSchema>;
export type PersistentForecastPoint = typeof persistentForecastPoints.$inferSelect;
export type InsertPersistentForecastPoint = z.infer<typeof insertPersistentForecastPointSchema>;

export const insertPersistentForecastSchema = createInsertSchema(persistentForecasts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersistentForecastPointSchema = createInsertSchema(persistentForecastPoints).omit({
  id: true,
  createdAt: true,
});

export type ForecastWindow = typeof forecastWindows.$inferSelect;
export type InsertForecastWindow = z.infer<typeof insertForecastWindowSchema>;

export type ForecastPoint = typeof forecastPoints.$inferSelect;
export type InsertForecastPoint = z.infer<typeof insertForecastPointSchema>;

export type AdaptiveParameter = typeof adaptiveParameters.$inferSelect;
export type InsertAdaptiveParameter = z.infer<typeof insertAdaptiveParameterSchema>;

export const insertHourlySuccessSnapshotSchema = createInsertSchema(hourlySuccessSnapshots).omit({
  id: true,
  capturedAt: true,
});

export type InsertHourlySuccessSnapshot = z.infer<typeof insertHourlySuccessSnapshotSchema>;
export type HourlySuccessSnapshot = typeof hourlySuccessSnapshots.$inferSelect;

// Rolling Chart Data Types
export const insertRollingChartDataSchema = createInsertSchema(rollingChartData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RollingChartData = typeof rollingChartData.$inferSelect;
export type InsertRollingChartData = z.infer<typeof insertRollingChartDataSchema>;

// Legacy Live Chart Data Types
export type LiveChartData = typeof liveChartData.$inferSelect;
export type InsertLiveChartData = typeof liveChartData.$inferInsert;

// Enhanced Data Ingestion Schema Exports
export const insertOrderbookDataSchema = createInsertSchema(orderbookData).omit({
  id: true,
  createdAt: true,
});

export const insertTradeTicksSchema = createInsertSchema(tradeTicks).omit({
  id: true,
  createdAt: true,
});

// Enhanced Data Ingestion Types
export type OrderbookData = typeof orderbookData.$inferSelect;
export type InsertOrderbookData = z.infer<typeof insertOrderbookDataSchema>;

export type TradeTicks = typeof tradeTicks.$inferSelect;
export type InsertTradeTicks = z.infer<typeof insertTradeTicksSchema>;

// ML Training Data Schema Exports
export const insertMLTrainingSampleSchema = createInsertSchema(mlTrainingSamples).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMLTrainingBatchSchema = createInsertSchema(mlTrainingBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ML Training Data Types
export type MLTrainingSample = typeof mlTrainingSamples.$inferSelect;
export type InsertMLTrainingSample = z.infer<typeof insertMLTrainingSampleSchema>;

export type MLTrainingBatch = typeof mlTrainingBatches.$inferSelect;
export type InsertMLTrainingBatch = z.infer<typeof insertMLTrainingBatchSchema>;

// TRADE SUGGESTIONS - 20-minute forecast-based trade recommendations
export const tradeSuggestions = pgTable("trade_suggestions", {
  id: serial("id").primaryKey(),
  tradeId: text("trade_id").notNull().unique(),
  symbol: text("symbol").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  direction: text("direction").notNull(), // 'LONG', 'SHORT', 'WAIT'
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
  takeProfitPrice: decimal("take_profit_price", { precision: 20, scale: 8 }),
  stopLossPrice: decimal("stop_loss_price", { precision: 20, scale: 8 }),
  positionSize: integer("position_size"),
  forecastReturn: real("forecast_return").notNull(),
  pathSlope: real("path_slope").notNull(),
  confidence: real("confidence").notNull(),
  technicalSnapshot: json("technical_snapshot").notNull(),
  reason: text("reason").notNull(),
  warnings: json("warnings").notNull(),
  riskRewardRatio: real("risk_reward_ratio"),
  status: text("status").notNull().default("PENDING"), // 'PENDING', 'EXECUTED', 'CANCELLED', 'EXPIRED'
  
  // Execution tracking
  executedAt: timestamp("executed_at"),
  executedPrice: decimal("executed_price", { precision: 20, scale: 8 }),
  
  // Outcome tracking
  outcomeStatus: text("outcome_status"), // 'TP_HIT', 'SL_HIT', 'EXPIRED', 'MANUAL_CLOSE'
  closedAt: timestamp("closed_at"),
  closedPrice: decimal("closed_price", { precision: 20, scale: 8 }),
  actualReturn: real("actual_return"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTradeSuggestionSchema = createInsertSchema(tradeSuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTradeSuggestion = z.infer<typeof insertTradeSuggestionSchema>;
export type SelectTradeSuggestion = typeof tradeSuggestions.$inferSelect;

// NEW: COMPREHENSIVE ML DIAGNOSTICS TABLE - Advanced monitoring and regime detection
export const mlDiagnostics = pgTable("ml_diagnostics", {
  id: serial("id").primaryKey(),
  component: text("component").notNull(), // 'MLTradeSignalEngine', 'SelfImprovingMLEngine', 'TradeCompletionMonitor'
  diagnosticType: text("diagnostic_type").notNull(), // 'training_cycle', 'regime_change', 'error_alert', 'performance_update'
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Feature weight tracking
  featureWeights: json("feature_weights"), // Current feature weights snapshot
  topFeatures: json("top_features"), // Top 5 most important indicators
  bottomFeatures: json("bottom_features"), // Bottom 5 least important indicators
  weightChanges: json("weight_changes"), // Changes from previous cycle
  
  // Model performance metrics
  modelAccuracy: real("model_accuracy"), // Overall model accuracy percentage
  inSampleAccuracy: real("in_sample_accuracy"), // In-sample prediction accuracy
  outOfSampleAccuracy: real("out_of_sample_accuracy"), // Out-of-sample accuracy
  confidenceThreshold: real("confidence_threshold"), // Current confidence threshold
  profitThreshold: real("profit_threshold"), // Current profit likelihood threshold
  
  // Rolling performance metrics
  rollingWinRate: real("rolling_win_rate"), // Win rate over last N trades
  rollingMeanPnL: decimal("rolling_mean_pnl", { precision: 10, scale: 4 }), // Average P&L
  rollingMaxDrawdown: decimal("rolling_max_drawdown", { precision: 10, scale: 4 }), // Maximum drawdown
  sampleSize: integer("sample_size"), // Number of trades in rolling window
  
  // Regime detection flags
  regimeChangeDetected: boolean("regime_change_detected").default(false),
  regimeType: text("regime_type"), // 'win_rate_drop', 'pnl_decline', 'drawdown_spike', 'recovery'
  regimeThreshold: real("regime_threshold"), // Threshold that was breached
  regimeValue: real("regime_value"), // Actual value that triggered regime change
  consecutiveRegimePeriods: integer("consecutive_regime_periods").default(0),
  
  // Error and anomaly tracking
  errorType: text("error_type"), // 'weight_bound_hit', 'data_anomaly', 'calculation_error', 'api_failure'
  errorMessage: text("error_message"), // Full error context
  errorSeverity: text("error_severity"), // 'low', 'medium', 'high', 'critical'
  stackTrace: text("stack_trace"), // Full stack trace for debugging
  
  // Additional context
  symbol: text("symbol"), // Specific symbol if applicable
  tradesAnalyzed: integer("trades_analyzed"), // Number of trades in analysis
  contextData: json("context_data"), // Additional diagnostic context
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMlDiagnosticsSchema = createInsertSchema(mlDiagnostics).omit({
  id: true,
  createdAt: true,
});

export type InsertMlDiagnostics = z.infer<typeof insertMlDiagnosticsSchema>;
export type SelectMlDiagnostics = typeof mlDiagnostics.$inferSelect;

// NEW: Per-minute forecast performance tracking table
export const forecastPerformanceData = pgTable("forecast_performance_data", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").references(() => tradeSimulations.id, { onDelete: "cascade" }).notNull(),
  symbol: text("symbol").notNull(),
  
  // Forecast timing
  forecastMinute: integer("forecast_minute").notNull(), // 1-20
  timestamp: timestamp("timestamp").notNull(),
  
  // Price predictions vs reality
  predictedPrice: decimal("predicted_price", { precision: 20, scale: 8 }).notNull(),
  actualPrice: decimal("actual_price", { precision: 20, scale: 8 }).notNull(),
  
  // Direction predictions
  predictedDirection: text("predicted_direction").notNull(), // 'UP', 'DOWN'
  actualDirection: text("actual_direction").notNull(), // 'UP', 'DOWN'
  correctDirectionFlag: boolean("correct_direction_flag").notNull(),
  
  // Error metrics
  absError: decimal("abs_error", { precision: 20, scale: 8 }).notNull(), // |predicted - actual|
  percentError: decimal("percent_error", { precision: 10, scale: 4 }).notNull(), // (predicted - actual) / actual * 100
  
  // Market regime context
  marketRegimeAtForecast: text("market_regime_at_forecast"), // TREND_UP, TREND_DOWN, SIDEWAYS
  marketRegimeActual: text("market_regime_actual"),
  
  // Volatility predictions
  volatilityPredicted: decimal("volatility_predicted", { precision: 10, scale: 6 }),
  volatilityActual: decimal("volatility_actual", { precision: 10, scale: 6 }),
  
  // Learning weights (for this forecast minute)
  learningWeight: real("learning_weight").notNull().default(1.0), // 2x for min 1-5, 1.5x for 6-10, 1x for 11-20
  
  // Quality flags
  isAnomalous: boolean("is_anomalous").notNull().default(false),
  anomalyReason: text("anomaly_reason"), // 'volume_spike', 'extreme_slippage', 'data_gap'
  
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Enhanced regime-based learning weights table
export const regimeLearningWeights = pgTable("regime_learning_weights", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  marketRegime: text("market_regime").notNull(), // TREND_UP, TREND_DOWN, SIDEWAYS
  
  // Technical indicator weights for this regime
  rsiWeight: real("rsi_weight").notNull().default(1.0),
  macdWeight: real("macd_weight").notNull().default(1.0),
  bollingerWeight: real("bollinger_weight").notNull().default(1.0),
  stochasticWeight: real("stochastic_weight").notNull().default(1.0),
  volumeWeight: real("volume_weight").notNull().default(1.0),
  volatilityWeight: real("volatility_weight").notNull().default(1.0),
  
  // Performance tracking for this regime
  totalTrades: integer("total_trades").notNull().default(0),
  successfulTrades: integer("successful_trades").notNull().default(0),
  successRate: real("success_rate").notNull().default(0),
  
  // Last update tracking
  lastTradeDate: timestamp("last_trade_date"),
  lastUpdateDate: timestamp("last_update_date").notNull().defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

// Export schemas for new tables
export const insertForecastPerformanceDataSchema = createInsertSchema(forecastPerformanceData).omit({
  id: true,
  createdAt: true,
});

export const insertRegimeLearningWeightsSchema = createInsertSchema(regimeLearningWeights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types for new tables
export type ForecastPerformanceData = typeof forecastPerformanceData.$inferSelect;
export type InsertForecastPerformanceData = z.infer<typeof insertForecastPerformanceDataSchema>;

export type RegimeLearningWeights = typeof regimeLearningWeights.$inferSelect;
export type InsertRegimeLearningWeights = z.infer<typeof insertRegimeLearningWeightsSchema>;
