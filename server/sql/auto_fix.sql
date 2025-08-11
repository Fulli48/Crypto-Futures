CREATE TABLE IF NOT EXISTS forecast_performance (id SERIAL PRIMARY KEY);
ALTER TABLE IF EXISTS learning_weights ADD COLUMN IF NOT EXISTS performance_score REAL;
ALTER TABLE IF EXISTS rolling_chart_data ADD COLUMN IF NOT EXISTS bollinger_middle REAL;
ALTER TABLE IF EXISTS trade_simulations ADD COLUMN IF NOT EXISTS profit_likelihood NUMERIC;