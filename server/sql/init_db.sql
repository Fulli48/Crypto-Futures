-- Minimal schema for local development
CREATE TABLE IF NOT EXISTS trade_simulations (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  signal_type TEXT,
  actual_outcome TEXT DEFAULT 'IN_PROGRESS',
  profit_loss NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_weights (
  id SERIAL PRIMARY KEY,
  feature TEXT,
  weight REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_prediction_history (
  id SERIAL PRIMARY KEY,
  symbol TEXT,
  predicted_at TIMESTAMPTZ,
  accuracy REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_training_samples (
  id SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  data JSONB
);

