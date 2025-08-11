-- Generated schema (best-effort)

CREATE TABLE IF NOT EXISTS cryptocurrencies (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  name TEXT,
  price NUMERIC,
  market_cap NUMERIC,
  volume_24h NUMERIC,
  change_24h NUMERIC,
  logo_url TEXT,
  last_updated TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  symbol TEXT,
  amount NUMERIC,
  average_price NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  symbol TEXT,
  type TEXT,
  amount NUMERIC,
  price NUMERIC,
  total NUMERIC,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS market_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  symbol TEXT,
  type TEXT,
  target_value NUMERIC,
  is_active BOOLEAN,
  message TEXT,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_simulations (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  signal_type TEXT,
  simulation_type TEXT,
  confidence REAL,
  profit_likelihood REAL,
  entry_price NUMERIC,
  tp_price NUMERIC,
  sl_price NUMERIC,
  amount NUMERIC,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  actual_outcome TEXT,
  profit_loss NUMERIC,
  profitable_percentage REAL,
  highest_profit NUMERIC,
  lowest_loss NUMERIC,
  success_score REAL,
  success_score_threshold REAL,
  is_successful BOOLEAN,
  time_in_profit_ratio REAL,
  max_favorable_excursion NUMERIC,
  max_drawdown NUMERIC,
  duration_minutes INTEGER,
  final_profitable_seconds INTEGER,
  market_conditions JSONB,
  indicator_values JSONB,
  completion_processed BOOLEAN,
  last_processed_at TIMESTAMPTZ,
  process_version INTEGER,
  current_profit_percent NUMERIC,
  profit_time INTEGER,
  loss_time INTEGER,
  last_update_timestamp TIMESTAMPTZ,
  actual_movement_percent NUMERIC,
  max_price_during_trade NUMERIC,
  min_price_during_trade NUMERIC,
  excluded_from_learning BOOLEAN,
  movement_filter_threshold NUMERIC,
  avg_forecast_accuracy REAL,
  early_accuracy_3min REAL,
  volatility_alignment_score REAL,
  drift_correction_applied BOOLEAN,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_historical_prices (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER,
  timestamp TIMESTAMPTZ,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  profit_loss_percent NUMERIC,
  distance_to_take_profit NUMERIC,
  distance_to_stop_loss NUMERIC,
  was_profitable BOOLEAN,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS rolling_chart_data (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  funding_rate NUMERIC,
  next_funding_time TIMESTAMPTZ,
  open_interest NUMERIC,
  oi_change NUMERIC,
  trade_count INTEGER,
  buy_volume NUMERIC,
  sell_volume NUMERIC,
  avg_trade_size NUMERIC,
  largest_trade NUMERIC,
  realized_volatility REAL,
  volatility_5min REAL,
  volatility_15min REAL,
  volatility_60min REAL,
  rsi REAL,
  macd REAL,
  macd_signal REAL,
  macd_histogram REAL,
  bollinger_upper NUMERIC,
  bollinger_middle NUMERIC,
  bollinger_lower NUMERIC,
  stochastic_k REAL,
  stochastic_d REAL,
  ema_alignment INTEGER,
  support_level NUMERIC,
  resistance_level NUMERIC,
  market_structure TEXT,
  detected_patterns JSONB,
  volume_profile JSONB,
  macro_event_flag BOOLEAN,
  news_impact_score REAL,
  market_regime_flag TEXT,
  is_complete BOOLEAN,
  has_missing_data BOOLEAN,
  data_source_count INTEGER,
  last_data_update TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS enhanced_signals (
  id SERIAL PRIMARY KEY,
  signal_id TEXT,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  forecast_vector JSONB,
  current_price NUMERIC,
  forecast_return REAL,
  forecast_slope REAL,
  model_confidence REAL,
  technical_indicators JSONB,
  ensemble_dispersion REAL,
  model_agreement_score REAL,
  path_smoothness REAL,
  entry_price NUMERIC,
  take_profit_price NUMERIC,
  stop_loss_price NUMERIC,
  risk_reward_ratio REAL,
  position_size REAL,
  quality_score REAL,
  quality_metrics JSONB,
  meta_model_prediction REAL,
  meta_model_version TEXT,
  signal TEXT,
  confidence REAL,
  suppression_reasons JSONB,
  warnings JSONB,
  feature_vector JSONB,
  feature_checksum TEXT,
  trade_id TEXT,
  is_executed BOOLEAN,
  execution_details JSONB,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_outcomes (
  id SERIAL PRIMARY KEY,
  trade_id TEXT,
  signal_id TEXT,
  symbol TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  entry_timestamp TIMESTAMPTZ,
  exit_timestamp TIMESTAMPTZ,
  exit_reason TEXT,
  realized_pnl NUMERIC,
  realized_pnl_percent REAL,
  max_drawdown NUMERIC,
  max_drawdown_percent REAL,
  time_to_target INTEGER,
  realized_volatility REAL,
  forecast_accuracy REAL,
  path_accuracy REAL,
  total_fees NUMERIC,
  total_slippage NUMERIC,
  net_pnl NUMERIC,
  predicted_win_prob REAL,
  actual_win BOOLEAN,
  prediction_error REAL,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS meta_model_registry (
  id SERIAL PRIMARY KEY,
  version TEXT,
  model_type TEXT,
  training_data_hash TEXT,
  training_start_time TIMESTAMPTZ,
  training_end_time TIMESTAMPTZ,
  training_duration INTEGER,
  training_data_size INTEGER,
  feature_count INTEGER,
  validation_accuracy REAL,
  validation_precision REAL,
  validation_recall REAL,
  validation_f1_score REAL,
  calibration_score REAL,
  hyperparameters JSONB,
  feature_importance JSONB,
  is_production BOOLEAN,
  promoted_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  model_artifact_path TEXT,
  model_size INTEGER,
  inference_latency REAL,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS learning_dataset (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  dataset_version TEXT,
  signal_id TEXT,
  input_features JSONB,
  technical_features JSONB,
  ensemble_features JSONB,
  market_context_features JSONB,
  profit_label BOOLEAN,
  pnl_label REAL,
  drawdown_label REAL,
  time_to_target_label INTEGER,
  meta_model_prediction REAL,
  meta_model_version TEXT,
  is_valid_sample BOOLEAN,
  has_outcome BOOLEAN,
  outlier_flag BOOLEAN,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS orderbook_data (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  bid_prices JSONB,
  bid_sizes JSONB,
  ask_prices JSONB,
  ask_sizes JSONB,
  spread_percent REAL,
  bid_depth NUMERIC,
  ask_depth NUMERIC,
  mid_price NUMERIC,
  imbalance_ratio REAL,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_ticks (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  minute_timestamp TIMESTAMPTZ,
  price NUMERIC,
  size NUMERIC,
  side TEXT,
  trade_id TEXT,
  notional_value NUMERIC,
  is_large_trade BOOLEAN,
  price_impact REAL,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_performance (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  forecast_timestamp TIMESTAMPTZ,
  initial_price NUMERIC,
  forecast_price NUMERIC,
  forecast_change REAL,
  confidence REAL,
  market_conditions JSONB,
  signal_strength REAL,
  actual_timestamp TIMESTAMPTZ,
  actual_price NUMERIC,
  actual_change REAL,
  accuracy REAL,
  is_successful BOOLEAN,
  profit_potential REAL,
  is_completed BOOLEAN,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS live_chart_data (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS live_ml_signals (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  signal TEXT,
  confidence REAL,
  profit_likelihood REAL,
  entry_price NUMERIC,
  take_profit NUMERIC,
  stop_loss NUMERIC,
  risk_reward_ratio REAL,
  model_explanation TEXT,
  feature_importance JSONB,
  is_filtered BOOLEAN,
  filter_reason TEXT,
  quality_tier TEXT,
  current_price NUMERIC,
  unrealized_pnl REAL,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS learning_analytics (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  total_analyzed_trades INTEGER,
  short_type_analyzed INTEGER,
  medium_type_analyzed INTEGER,
  long_type_analyzed INTEGER,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS algorithm_success_snapshots (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  trade_id INTEGER,
  success_rate_at_completion REAL,
  total_trades_at_time INTEGER,
  successful_trades_at_time INTEGER,
  completed_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS learning_weights (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  indicator_name TEXT,
  weight_value REAL,
  performance_score REAL,
  sample_size INTEGER,
  last_updated TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS pattern_performance (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  pattern_name TEXT,
  market_condition TEXT,
  success_rate REAL,
  avg_profit NUMERIC,
  sample_size INTEGER,
  confidence_threshold INTEGER,
  last_updated TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  metric_name TEXT,
  metric_value REAL,
  description TEXT,
  last_updated TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_accuracy_history (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  forecast_timestamp TIMESTAMPTZ,
  horizon_minute INTEGER,
  predicted_price NUMERIC,
  actual_price NUMERIC,
  direction_correct BOOLEAN,
  absolute_error_pct REAL,
  regime TEXT,
  base_model TEXT,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS horizon_feature_weights (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  horizon_range TEXT,
  feature_name TEXT,
  weight_value REAL,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS regime_model_scores (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  regime TEXT,
  base_model TEXT,
  horizon_minute INTEGER,
  accuracy REAL,
  sample_size INTEGER,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS persistent_forecasts (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  forecast_key TEXT,
  base_timestamp TIMESTAMPTZ,
  base_price_precision INTEGER,
  base_price NUMERIC,
  is_active BOOLEAN,
  last_adjusted_at TIMESTAMPTZ,
  adjustment_count INTEGER,
  forecast_type TEXT,
  confidence_score REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS persistent_forecast_points (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  forecast_id INTEGER,
  future_timestamp TIMESTAMPTZ,
  minutes_ahead INTEGER,
  predicted_open NUMERIC,
  predicted_high NUMERIC,
  predicted_low NUMERIC,
  predicted_close NUMERIC,
  predicted_volume NUMERIC,
  confidence REAL,
  volatility REAL,
  original_prediction NUMERIC,
  adjustment_factor REAL,
  trend_direction TEXT,
  support_level NUMERIC,
  resistance_level NUMERIC,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS ml_training_samples (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  sample_key TEXT,
  base_timestamp TIMESTAMPTZ,
  target_timestamp TIMESTAMPTZ,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  input_sequence JSONB,
  input_metadata JSONB,
  target_prices_raw JSONB,
  target_prices_normalized JSONB,
  target_volumes JSONB,
  has_complete_input BOOLEAN,
  has_complete_target BOOLEAN,
  missing_input_fields JSONB,
  missing_target_fields JSONB,
  input_data_completeness REAL,
  target_data_completeness REAL,
  price_volatility REAL,
  is_training_ready BOOLEAN,
  used_in_training BOOLEAN,
  training_batch_id TEXT,
  validation_accuracy REAL,
  prediction_error REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS ml_training_batches (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  batch_key TEXT,
  symbols_included JSONB,
  total_samples INTEGER,
  samples_per_symbol JSONB,
  data_window_start TIMESTAMPTZ,
  data_window_end TIMESTAMPTZ,
  model_architecture TEXT,
  input_features JSONB,
  normalization_params JSONB,
  training_accuracy REAL,
  validation_accuracy REAL,
  training_loss REAL,
  validation_loss REAL,
  epochs INTEGER,
  status TEXT,
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_chart_data (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  trade_id INTEGER,
  timestamp TIMESTAMPTZ,
  seconds_since_entry INTEGER,
  current_price NUMERIC,
  current_profit_percent NUMERIC,
  profit_time INTEGER,
  loss_time INTEGER,
  take_profit NUMERIC,
  stop_loss NUMERIC,
  entry_price NUMERIC,
  profit_chance NUMERIC,
  trade_duration_type TEXT,
  suggested_direction TEXT,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_accuracy_tracking (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  forecast_window_id TEXT,
  boldness_multiplier REAL,
  base_confidence REAL,
  learning_weights_snapshot JSONB,
  mean_absolute_error REAL,
  accuracy_percentage REAL,
  max_deviation_percent REAL,
  consecutive_accurate_minutes INTEGER,
  new_boldness_multiplier REAL,
  should_increase_boldness BOOLEAN,
  target_accuracy_reached BOOLEAN,
  forecast_created_at TIMESTAMPTZ,
  forecast_completed_at TIMESTAMPTZ,
  accuracy_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS adaptive_boldness_metrics (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  global_boldness_multiplier REAL,
  recent_accuracy_percentage REAL,
  consecutive_accurate_forecasts INTEGER,
  consecutive_inaccurate_forecasts INTEGER,
  target_accuracy_goal REAL,
  achieved_target_streak INTEGER,
  time_in_target_zone INTEGER,
  convergence_state TEXT,
  total_forecast_windows INTEGER,
  accurate_windows INTEGER,
  overall_success_rate REAL,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS hourly_success_snapshots (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  success_rate NUMERIC,
  total_trades INTEGER,
  successful_trades INTEGER,
  captured_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS ml_prediction_history (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  confidence INTEGER,
  profit_likelihood INTEGER,
  signal TEXT,
  was_filtered BOOLEAN,
  filter_reason TEXT,
  min_confidence_threshold INTEGER,
  min_profit_likelihood_threshold INTEGER,
  avg_confidence REAL,
  std_confidence REAL,
  avg_profit_likelihood REAL,
  std_profit_likelihood REAL,
  model_explanation TEXT,
  feature_importance JSONB,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS ml_engine_state (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  state_key TEXT,
  feature_weights JSONB,
  previous_weights JSONB,
  starting_weights JSONB,
  prediction_buffer JSONB,
  current_thresholds JSONB,
  performance_metrics JSONB,
  weight_adjustment_count INTEGER,
  last_training_time TIMESTAMPTZ,
  last_weight_refresh TIMESTAMPTZ,
  training_cycle INTEGER,
  experiment_logs JSONB,
  is_initialized BOOLEAN,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_windows (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  forecast_generated_at TIMESTAMPTZ,
  forecast_start_time TIMESTAMPTZ,
  forecast_end_time TIMESTAMPTZ,
  algorithm_version TEXT,
  algorithm_success_rate REAL,
  mean_absolute_error REAL,
  is_complete BOOLEAN,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_points (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  forecast_window_id INTEGER,
  timestamp TIMESTAMPTZ,
  predicted_price NUMERIC,
  actual_price NUMERIC,
  absolute_error NUMERIC,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS adaptive_parameters (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  parameter_name TEXT,
  parameter_value REAL,
  last_mae REAL,
  adjustment_direction TEXT,
  adjustment_count INTEGER,
  last_adjusted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS trade_suggestions (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  trade_id TEXT,
  symbol TEXT,
  timestamp TIMESTAMPTZ,
  direction TEXT,
  entry_price NUMERIC,
  take_profit_price NUMERIC,
  stop_loss_price NUMERIC,
  position_size INTEGER,
  forecast_return REAL,
  path_slope REAL,
  confidence REAL,
  technical_snapshot JSONB,
  reason TEXT,
  warnings JSONB,
  risk_reward_ratio REAL,
  status TEXT,
  executed_at TIMESTAMPTZ,
  executed_price NUMERIC,
  outcome_status TEXT,
  closed_at TIMESTAMPTZ,
  closed_price NUMERIC,
  actual_return REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS ml_diagnostics (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  component TEXT,
  diagnostic_type TEXT,
  timestamp TIMESTAMPTZ,
  feature_weights JSONB,
  top_features JSONB,
  bottom_features JSONB,
  weight_changes JSONB,
  model_accuracy REAL,
  in_sample_accuracy REAL,
  out_of_sample_accuracy REAL,
  confidence_threshold REAL,
  profit_threshold REAL,
  rolling_win_rate REAL,
  rolling_mean_pnl NUMERIC,
  rolling_max_drawdown NUMERIC,
  sample_size INTEGER,
  regime_change_detected BOOLEAN,
  regime_type TEXT,
  regime_threshold REAL,
  regime_value REAL,
  consecutive_regime_periods INTEGER,
  error_type TEXT,
  error_message TEXT,
  error_severity TEXT,
  stack_trace TEXT,
  symbol TEXT,
  trades_analyzed INTEGER,
  context_data JSONB,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS forecast_performance_data (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  trade_id INTEGER,
  symbol TEXT,
  forecast_minute INTEGER,
  timestamp TIMESTAMPTZ,
  predicted_price NUMERIC,
  actual_price NUMERIC,
  predicted_direction TEXT,
  actual_direction TEXT,
  correct_direction_flag BOOLEAN,
  abs_error NUMERIC,
  percent_error NUMERIC,
  market_regime_at_forecast TEXT,
  market_regime_actual TEXT,
  volatility_predicted NUMERIC,
  volatility_actual NUMERIC,
  learning_weight REAL,
  is_anomalous BOOLEAN,
  anomaly_reason TEXT,
  created_at TIMESTAMPTZ

);

CREATE TABLE IF NOT EXISTS regime_learning_weights (
  id SERIAL PRIMARY KEY,
  id INTEGER,
  symbol TEXT,
  market_regime TEXT,
  rsi_weight REAL,
  macd_weight REAL,
  bollinger_weight REAL,
  stochastic_weight REAL,
  volume_weight REAL,
  volatility_weight REAL,
  total_trades INTEGER,
  successful_trades INTEGER,
  success_rate REAL,
  last_trade_date TIMESTAMPTZ,
  last_update_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ

);
