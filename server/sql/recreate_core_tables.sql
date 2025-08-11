-- Drop and recreate core tables to ensure correct column names (safe for local dev)
DROP TABLE IF EXISTS trade_simulations CASCADE;
DROP TABLE IF EXISTS rolling_chart_data CASCADE;
DROP TABLE IF EXISTS learning_weights CASCADE;
DROP TABLE IF EXISTS ml_prediction_history CASCADE;
DROP TABLE IF EXISTS ml_training_samples CASCADE;

-- Recreate with expected snake_case column names
CREATE TABLE trade_simulations (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  simulation_type TEXT DEFAULT 'SHORT',
  confidence REAL,
  profit_likelihood REAL,
  entry_price NUMERIC(20,8),
  tp_price NUMERIC(20,8),
  sl_price NUMERIC(20,8),
  amount NUMERIC(20,8) DEFAULT 1000,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  actual_outcome TEXT DEFAULT 'IN_PROGRESS',
  profit_loss NUMERIC(10,4) DEFAULT 0,
  profitable_percentage REAL DEFAULT 0,
  highest_profit NUMERIC(10,4) DEFAULT 0,
  lowest_loss NUMERIC(10,4) DEFAULT 0,
  success_score REAL DEFAULT 0,
  success_score_threshold REAL DEFAULT 0.1,
  is_successful BOOLEAN DEFAULT false,
  time_in_profit_ratio REAL DEFAULT 0,
  max_favorable_excursion NUMERIC(10,4) DEFAULT 0,
  max_drawdown NUMERIC(10,4) DEFAULT 0,
  duration_minutes INTEGER DEFAULT 20,
  final_profitable_seconds INTEGER DEFAULT 0,
  market_conditions JSONB,
  indicator_values JSONB,
  completion_processed BOOLEAN DEFAULT false,
  last_processed_at TIMESTAMPTZ,
  process_version INTEGER DEFAULT 1,
  current_profit_percent NUMERIC(10,4) DEFAULT 0,
  profit_time INTEGER DEFAULT 0,
  loss_time INTEGER DEFAULT 0,
  last_update_timestamp TIMESTAMPTZ DEFAULT now(),
  actual_movement_percent NUMERIC(10,4) DEFAULT 0,
  max_price_during_trade NUMERIC(20,8) DEFAULT 0,
  min_price_during_trade NUMERIC(20,8) DEFAULT 0,
  excluded_from_learning BOOLEAN DEFAULT false,
  movement_filter_threshold NUMERIC(10,4) DEFAULT 0.1,
  avg_forecast_accuracy REAL,
  early_accuracy_3min REAL,
  volatility_alignment_score REAL,
  drift_correction_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rolling_chart_data (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC(20,8) NOT NULL,
  high NUMERIC(20,8) NOT NULL,
  low NUMERIC(20,8) NOT NULL,
  close NUMERIC(20,8) NOT NULL,
  volume NUMERIC(20,8) DEFAULT 0,
  funding_rate NUMERIC(10,8),
  next_funding_time TIMESTAMPTZ,
  open_interest NUMERIC(20,2),
  oi_change NUMERIC(10,4),
  trade_count INTEGER DEFAULT 0,
  buy_volume NUMERIC(20,8) DEFAULT 0,
  sell_volume NUMERIC(20,8) DEFAULT 0,
  avg_trade_size NUMERIC(20,8) DEFAULT 0,
  largest_trade NUMERIC(20,8) DEFAULT 0,
  realized_volatility REAL DEFAULT 0,
  volatility_5min REAL DEFAULT 0,
  volatility_15min REAL DEFAULT 0,
  volatility_60min REAL DEFAULT 0,
  rsi REAL DEFAULT 50,
  macd REAL DEFAULT 0,
  macd_signal REAL DEFAULT 0,
  macd_histogram REAL DEFAULT 0,
  bollinger_upper NUMERIC(20,8),
  bollinger_lower NUMERIC(20,8),
  stochastic_k REAL,
  stochastic_d REAL,
  stochastic REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE learning_weights (
  id SERIAL PRIMARY KEY,
  indicator_name TEXT,
  weight_value REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ml_prediction_history (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  predicted_at TIMESTAMPTZ,
  accuracy REAL,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ml_training_samples (
  id SERIAL PRIMARY KEY,
  createdAt TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  data JSONB
);

