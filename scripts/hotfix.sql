-- create state table used by ML engine
CREATE TABLE IF NOT EXISTS ml_engine_state (
  state_key                text PRIMARY KEY,
  feature_weights          jsonb NOT NULL,
  previous_weights         jsonb NOT NULL DEFAULT '{}'::jsonb,
  starting_weights         jsonb NOT NULL DEFAULT '{}'::jsonb,
  prediction_buffer        jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_thresholds       jsonb NOT NULL,
  performance_metrics      jsonb,
  weight_adjustment_count  integer NOT NULL DEFAULT 0,
  last_training_time       timestamptz,
  last_weight_refresh      timestamptz,
  training_cycle           integer NOT NULL DEFAULT 0,
  experiment_logs          jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_initialized           boolean NOT NULL DEFAULT false,
  last_updated             timestamptz NOT NULL DEFAULT now()
);

-- columns referenced by the code but missing in your DB
ALTER TABLE IF EXISTS learning_weights
  ADD COLUMN IF NOT EXISTS sample_size integer DEFAULT 0;

ALTER TABLE IF EXISTS ml_prediction_history
  ADD COLUMN IF NOT EXISTS profit_likelihood numeric;

ALTER TABLE IF EXISTS rolling_chart_data
  ADD COLUMN IF NOT EXISTS ema_alignment numeric;

ALTER TABLE IF EXISTS forecast_performance
  ADD COLUMN IF NOT EXISTS symbol text;
