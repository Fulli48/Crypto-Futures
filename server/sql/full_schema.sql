-- Comprehensive local schema derived from shared/schema.ts (best-effort)
-- This creates the main tables and columns expected at startup.

CREATE TABLE IF NOT EXISTS trade_simulations (
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

CREATE TABLE IF NOT EXISTS trade_historical_prices (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  open NUMERIC(20,8) NOT NULL,
  high NUMERIC(20,8) NOT NULL,
  low NUMERIC(20,8) NOT NULL,
  close NUMERIC(20,8) NOT NULL,
  volume NUMERIC(20,8) NOT NULL,
  profit_loss_percent NUMERIC(10,4) NOT NULL,
  distance_to_take_profit NUMERIC(10,4) NOT NULL,
  distance_to_stop_loss NUMERIC(10,4) NOT NULL,
  was_profitable BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rolling_chart_data (
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

CREATE TABLE IF NOT EXISTS learning_weights (
  id SERIAL PRIMARY KEY,
  indicator_name TEXT,
  weight_value REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_prediction_history (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  predicted_at TIMESTAMPTZ,
  accuracy REAL,
  confidence REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_training_samples (
  id SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  data JSONB
);

CREATE TABLE IF NOT EXISTS ml_training_batches (
  id SERIAL PRIMARY KEY,
  batch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS persistent_forecasts (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS persistent_forecast_points (
  id SERIAL PRIMARY KEY,
  forecast_id INTEGER,
  point_time TIMESTAMPTZ,
  value NUMERIC
);

CREATE TABLE IF NOT EXISTS forecast_windows (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  horizon INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forecast_points (
  id SERIAL PRIMARY KEY,
  forecast_window_id INTEGER,
  timestamp TIMESTAMPTZ,
  prediction NUMERIC
);

-- Basic tables to reduce further missing-table errors
CREATE TABLE IF NOT EXISTS cryptocurrencies (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC(20,8),
  market_cap NUMERIC(20,2),
  volume_24h NUMERIC(20,2),
  change_24h NUMERIC(10,4),
  logo_url TEXT,
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  symbol TEXT,
  amount NUMERIC(20,8),
  average_price NUMERIC(20,8),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

