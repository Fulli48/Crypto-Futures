CREATE TABLE "adaptive_boldness_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"global_boldness_multiplier" real DEFAULT 2.5 NOT NULL,
	"recent_accuracy_percentage" real DEFAULT 60 NOT NULL,
	"consecutive_accurate_forecasts" integer DEFAULT 0 NOT NULL,
	"consecutive_inaccurate_forecasts" integer DEFAULT 0 NOT NULL,
	"target_accuracy_goal" real DEFAULT 75 NOT NULL,
	"achieved_target_streak" integer DEFAULT 0 NOT NULL,
	"time_in_target_zone" integer DEFAULT 0 NOT NULL,
	"convergence_state" text DEFAULT 'LEARNING' NOT NULL,
	"total_forecast_windows" integer DEFAULT 0 NOT NULL,
	"accurate_windows" integer DEFAULT 0 NOT NULL,
	"overall_success_rate" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptive_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"parameter_name" text NOT NULL,
	"parameter_value" real NOT NULL,
	"last_mae" real,
	"adjustment_direction" text,
	"adjustment_count" integer DEFAULT 0 NOT NULL,
	"last_adjusted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "algorithm_success_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"success_rate_at_completion" real NOT NULL,
	"total_trades_at_time" integer NOT NULL,
	"successful_trades_at_time" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cryptocurrencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"market_cap" numeric(20, 2) NOT NULL,
	"volume_24h" numeric(20, 2) NOT NULL,
	"change_24h" numeric(10, 4) NOT NULL,
	"logo_url" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cryptocurrencies_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "enhanced_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"signal_id" text NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"forecast_vector" json NOT NULL,
	"current_price" numeric(20, 8) NOT NULL,
	"forecast_return" real NOT NULL,
	"forecast_slope" real NOT NULL,
	"model_confidence" real NOT NULL,
	"technical_indicators" json NOT NULL,
	"ensemble_dispersion" real NOT NULL,
	"model_agreement_score" real NOT NULL,
	"path_smoothness" real NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"take_profit_price" numeric(20, 8) NOT NULL,
	"stop_loss_price" numeric(20, 8) NOT NULL,
	"risk_reward_ratio" real NOT NULL,
	"position_size" real NOT NULL,
	"quality_score" real NOT NULL,
	"quality_metrics" json NOT NULL,
	"meta_model_prediction" real NOT NULL,
	"meta_model_version" text NOT NULL,
	"signal" text NOT NULL,
	"confidence" real NOT NULL,
	"suppression_reasons" json NOT NULL,
	"warnings" json NOT NULL,
	"feature_vector" json NOT NULL,
	"feature_checksum" text NOT NULL,
	"trade_id" text,
	"is_executed" boolean DEFAULT false NOT NULL,
	"execution_details" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enhanced_signals_signal_id_unique" UNIQUE("signal_id")
);
--> statement-breakpoint
CREATE TABLE "forecast_accuracy_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"forecast_timestamp" timestamp NOT NULL,
	"horizon_minute" integer NOT NULL,
	"predicted_price" numeric(20, 8) NOT NULL,
	"actual_price" numeric(20, 8),
	"direction_correct" boolean,
	"absolute_error_pct" real,
	"regime" text,
	"base_model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_accuracy_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"forecast_window_id" text NOT NULL,
	"boldness_multiplier" real DEFAULT 2.5 NOT NULL,
	"base_confidence" real NOT NULL,
	"learning_weights_snapshot" json,
	"mean_absolute_error" real,
	"accuracy_percentage" real,
	"max_deviation_percent" real,
	"consecutive_accurate_minutes" integer,
	"new_boldness_multiplier" real,
	"should_increase_boldness" boolean,
	"target_accuracy_reached" boolean,
	"forecast_created_at" timestamp NOT NULL,
	"forecast_completed_at" timestamp,
	"accuracy_calculated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forecast_accuracy_tracking_forecast_window_id_unique" UNIQUE("forecast_window_id")
);
--> statement-breakpoint
CREATE TABLE "forecast_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"forecast_timestamp" timestamp DEFAULT now() NOT NULL,
	"initial_price" numeric(20, 8) NOT NULL,
	"forecast_price" numeric(20, 8) NOT NULL,
	"forecast_change" real NOT NULL,
	"confidence" real NOT NULL,
	"market_conditions" json,
	"signal_strength" real DEFAULT 0,
	"actual_timestamp" timestamp,
	"actual_price" numeric(20, 8),
	"actual_change" real,
	"accuracy" real,
	"is_successful" boolean,
	"profit_potential" real,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_performance_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"forecast_minute" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"predicted_price" numeric(20, 8) NOT NULL,
	"actual_price" numeric(20, 8) NOT NULL,
	"predicted_direction" text NOT NULL,
	"actual_direction" text NOT NULL,
	"correct_direction_flag" boolean NOT NULL,
	"abs_error" numeric(20, 8) NOT NULL,
	"percent_error" numeric(10, 4) NOT NULL,
	"market_regime_at_forecast" text,
	"market_regime_actual" text,
	"volatility_predicted" numeric(10, 6),
	"volatility_actual" numeric(10, 6),
	"learning_weight" real DEFAULT 1 NOT NULL,
	"is_anomalous" boolean DEFAULT false NOT NULL,
	"anomaly_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"forecast_window_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"predicted_price" numeric(20, 8) NOT NULL,
	"actual_price" numeric(20, 8),
	"absolute_error" numeric(20, 8),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecast_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"forecast_generated_at" timestamp NOT NULL,
	"forecast_start_time" timestamp NOT NULL,
	"forecast_end_time" timestamp NOT NULL,
	"algorithm_version" text DEFAULT '1.0' NOT NULL,
	"algorithm_success_rate" real NOT NULL,
	"mean_absolute_error" real,
	"is_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horizon_feature_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"horizon_range" text NOT NULL,
	"feature_name" text NOT NULL,
	"weight_value" real DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hourly_success_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"success_rate" numeric(5, 2) NOT NULL,
	"total_trades" integer NOT NULL,
	"successful_trades" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_analyzed_trades" integer DEFAULT 0 NOT NULL,
	"short_type_analyzed" integer DEFAULT 0 NOT NULL,
	"medium_type_analyzed" integer DEFAULT 0 NOT NULL,
	"long_type_analyzed" integer DEFAULT 0 NOT NULL,
	"last_analyzed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_dataset" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_version" text NOT NULL,
	"signal_id" text NOT NULL,
	"input_features" json NOT NULL,
	"technical_features" json NOT NULL,
	"ensemble_features" json NOT NULL,
	"market_context_features" json NOT NULL,
	"profit_label" boolean NOT NULL,
	"pnl_label" real NOT NULL,
	"drawdown_label" real NOT NULL,
	"time_to_target_label" integer,
	"meta_model_prediction" real NOT NULL,
	"meta_model_version" text NOT NULL,
	"is_valid_sample" boolean DEFAULT true NOT NULL,
	"has_outcome" boolean DEFAULT false NOT NULL,
	"outlier_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"indicator_name" text NOT NULL,
	"weight_value" real DEFAULT 1 NOT NULL,
	"performance_score" real DEFAULT 0.5 NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_weights_indicator_name_unique" UNIQUE("indicator_name")
);
--> statement-breakpoint
CREATE TABLE "live_chart_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_ml_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"signal" text NOT NULL,
	"confidence" real NOT NULL,
	"profit_likelihood" real NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"take_profit" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"risk_reward_ratio" real NOT NULL,
	"model_explanation" text NOT NULL,
	"feature_importance" json DEFAULT '{}' NOT NULL,
	"is_filtered" boolean DEFAULT false NOT NULL,
	"filter_reason" text,
	"quality_tier" text NOT NULL,
	"current_price" numeric(20, 8) NOT NULL,
	"unrealized_pnl" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "live_ml_signals_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "market_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"target_value" numeric(20, 8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_model_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"model_type" text NOT NULL,
	"training_data_hash" text NOT NULL,
	"training_start_time" timestamp NOT NULL,
	"training_end_time" timestamp NOT NULL,
	"training_duration" integer NOT NULL,
	"training_data_size" integer NOT NULL,
	"feature_count" integer NOT NULL,
	"validation_accuracy" real NOT NULL,
	"validation_precision" real NOT NULL,
	"validation_recall" real NOT NULL,
	"validation_f1_score" real NOT NULL,
	"calibration_score" real NOT NULL,
	"hyperparameters" json NOT NULL,
	"feature_importance" json NOT NULL,
	"is_production" boolean DEFAULT false NOT NULL,
	"promoted_at" timestamp,
	"retired_at" timestamp,
	"model_artifact_path" text NOT NULL,
	"model_size" integer NOT NULL,
	"inference_latency" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_model_registry_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "ml_diagnostics" (
	"id" serial PRIMARY KEY NOT NULL,
	"component" text NOT NULL,
	"diagnostic_type" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"feature_weights" json,
	"top_features" json,
	"bottom_features" json,
	"weight_changes" json,
	"model_accuracy" real,
	"in_sample_accuracy" real,
	"out_of_sample_accuracy" real,
	"confidence_threshold" real,
	"profit_threshold" real,
	"rolling_win_rate" real,
	"rolling_mean_pnl" numeric(10, 4),
	"rolling_max_drawdown" numeric(10, 4),
	"sample_size" integer,
	"regime_change_detected" boolean DEFAULT false,
	"regime_type" text,
	"regime_threshold" real,
	"regime_value" real,
	"consecutive_regime_periods" integer DEFAULT 0,
	"error_type" text,
	"error_message" text,
	"error_severity" text,
	"stack_trace" text,
	"symbol" text,
	"trades_analyzed" integer,
	"context_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_engine_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"state_key" text NOT NULL,
	"feature_weights" json,
	"previous_weights" json,
	"starting_weights" json,
	"prediction_buffer" json,
	"current_thresholds" json,
	"performance_metrics" json,
	"weight_adjustment_count" integer DEFAULT 0,
	"last_training_time" timestamp,
	"last_weight_refresh" timestamp,
	"training_cycle" integer DEFAULT 0,
	"experiment_logs" json,
	"is_initialized" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ml_engine_state_state_key_unique" UNIQUE("state_key")
);
--> statement-breakpoint
CREATE TABLE "ml_prediction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"confidence" integer NOT NULL,
	"profit_likelihood" integer NOT NULL,
	"signal" text NOT NULL,
	"was_filtered" boolean DEFAULT false NOT NULL,
	"filter_reason" text,
	"min_confidence_threshold" integer,
	"min_profit_likelihood_threshold" integer,
	"avg_confidence" real,
	"std_confidence" real,
	"avg_profit_likelihood" real,
	"std_profit_likelihood" real,
	"model_explanation" text,
	"feature_importance" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_training_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_key" text NOT NULL,
	"symbols_included" json NOT NULL,
	"total_samples" integer NOT NULL,
	"samples_per_symbol" json NOT NULL,
	"data_window_start" timestamp NOT NULL,
	"data_window_end" timestamp NOT NULL,
	"model_architecture" text DEFAULT 'LSTM' NOT NULL,
	"input_features" json NOT NULL,
	"normalization_params" json NOT NULL,
	"training_accuracy" real,
	"validation_accuracy" real,
	"training_loss" real,
	"validation_loss" real,
	"epochs" integer,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"training_started_at" timestamp,
	"training_completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ml_training_batches_batch_key_unique" UNIQUE("batch_key")
);
--> statement-breakpoint
CREATE TABLE "ml_training_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"sample_key" text NOT NULL,
	"base_timestamp" timestamp NOT NULL,
	"target_timestamp" timestamp NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"input_sequence" json NOT NULL,
	"input_metadata" json NOT NULL,
	"target_prices_raw" json NOT NULL,
	"target_prices_normalized" json NOT NULL,
	"target_volumes" json NOT NULL,
	"has_complete_input" boolean DEFAULT true NOT NULL,
	"has_complete_target" boolean DEFAULT true NOT NULL,
	"missing_input_fields" json DEFAULT '[]',
	"missing_target_fields" json DEFAULT '[]',
	"input_data_completeness" real DEFAULT 100 NOT NULL,
	"target_data_completeness" real DEFAULT 100 NOT NULL,
	"price_volatility" real DEFAULT 0 NOT NULL,
	"is_training_ready" boolean DEFAULT false NOT NULL,
	"used_in_training" boolean DEFAULT false NOT NULL,
	"training_batch_id" text,
	"validation_accuracy" real,
	"prediction_error" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ml_training_samples_sample_key_unique" UNIQUE("sample_key")
);
--> statement-breakpoint
CREATE TABLE "orderbook_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"bid_prices" json DEFAULT '[]' NOT NULL,
	"bid_sizes" json DEFAULT '[]' NOT NULL,
	"ask_prices" json DEFAULT '[]' NOT NULL,
	"ask_sizes" json DEFAULT '[]' NOT NULL,
	"spread_percent" real NOT NULL,
	"bid_depth" numeric(20, 2) NOT NULL,
	"ask_depth" numeric(20, 2) NOT NULL,
	"mid_price" numeric(20, 8) NOT NULL,
	"imbalance_ratio" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pattern_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_name" text NOT NULL,
	"market_condition" text NOT NULL,
	"success_rate" real DEFAULT 0.5 NOT NULL,
	"avg_profit" numeric(10, 4) DEFAULT '0' NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"confidence_threshold" integer DEFAULT 50 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persistent_forecast_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"forecast_id" integer NOT NULL,
	"future_timestamp" timestamp NOT NULL,
	"minutes_ahead" integer NOT NULL,
	"predicted_open" numeric(20, 8) NOT NULL,
	"predicted_high" numeric(20, 8) NOT NULL,
	"predicted_low" numeric(20, 8) NOT NULL,
	"predicted_close" numeric(20, 8) NOT NULL,
	"predicted_volume" numeric(20, 8) DEFAULT '1000' NOT NULL,
	"confidence" real NOT NULL,
	"volatility" real DEFAULT 0.02 NOT NULL,
	"original_prediction" numeric(20, 8) NOT NULL,
	"adjustment_factor" real DEFAULT 1 NOT NULL,
	"trend_direction" text DEFAULT 'neutral' NOT NULL,
	"support_level" numeric(20, 8),
	"resistance_level" numeric(20, 8),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persistent_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"forecast_key" text NOT NULL,
	"base_timestamp" timestamp NOT NULL,
	"base_price_precision" integer NOT NULL,
	"base_price" numeric(20, 8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_adjusted_at" timestamp DEFAULT now() NOT NULL,
	"adjustment_count" integer DEFAULT 0 NOT NULL,
	"forecast_type" text DEFAULT 'ML_ENGINE' NOT NULL,
	"confidence_score" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "persistent_forecasts_forecast_key_unique" UNIQUE("forecast_key")
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"average_price" numeric(20, 8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regime_learning_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"market_regime" text NOT NULL,
	"rsi_weight" real DEFAULT 1 NOT NULL,
	"macd_weight" real DEFAULT 1 NOT NULL,
	"bollinger_weight" real DEFAULT 1 NOT NULL,
	"stochastic_weight" real DEFAULT 1 NOT NULL,
	"volume_weight" real DEFAULT 1 NOT NULL,
	"volatility_weight" real DEFAULT 1 NOT NULL,
	"total_trades" integer DEFAULT 0 NOT NULL,
	"successful_trades" integer DEFAULT 0 NOT NULL,
	"success_rate" real DEFAULT 0 NOT NULL,
	"last_trade_date" timestamp,
	"last_update_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regime_model_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"regime" text NOT NULL,
	"base_model" text NOT NULL,
	"horizon_minute" integer NOT NULL,
	"accuracy" real DEFAULT 0 NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rolling_chart_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) DEFAULT '0' NOT NULL,
	"funding_rate" numeric(10, 8),
	"next_funding_time" timestamp,
	"open_interest" numeric(20, 2),
	"oi_change" numeric(10, 4),
	"trade_count" integer DEFAULT 0,
	"buy_volume" numeric(20, 8) DEFAULT '0',
	"sell_volume" numeric(20, 8) DEFAULT '0',
	"avg_trade_size" numeric(20, 8) DEFAULT '0',
	"largest_trade" numeric(20, 8) DEFAULT '0',
	"realized_volatility" real DEFAULT 0,
	"volatility_5min" real DEFAULT 0,
	"volatility_15min" real DEFAULT 0,
	"volatility_60min" real DEFAULT 0,
	"rsi" real DEFAULT 50,
	"macd" real DEFAULT 0,
	"macd_signal" real DEFAULT 0,
	"macd_histogram" real DEFAULT 0,
	"bollinger_upper" numeric(20, 8) DEFAULT '0',
	"bollinger_middle" numeric(20, 8) DEFAULT '0',
	"bollinger_lower" numeric(20, 8) DEFAULT '0',
	"stochastic_k" real DEFAULT 50,
	"stochastic_d" real DEFAULT 50,
	"ema_alignment" integer DEFAULT 0,
	"support_level" numeric(20, 8) DEFAULT '0',
	"resistance_level" numeric(20, 8) DEFAULT '0',
	"market_structure" text DEFAULT 'range',
	"detected_patterns" json DEFAULT '[]',
	"volume_profile" json DEFAULT '{}',
	"macro_event_flag" boolean DEFAULT false,
	"news_impact_score" real DEFAULT 0,
	"market_regime_flag" text DEFAULT 'normal',
	"is_complete" boolean DEFAULT true,
	"has_missing_data" boolean DEFAULT false,
	"data_source_count" integer DEFAULT 1,
	"last_data_update" timestamp DEFAULT now(),
	"source" text DEFAULT 'BINANCE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" real NOT NULL,
	"description" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_metrics_metric_name_unique" UNIQUE("metric_name")
);
--> statement-breakpoint
CREATE TABLE "trade_chart_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"seconds_since_entry" integer NOT NULL,
	"current_price" numeric(20, 8) NOT NULL,
	"current_profit_percent" numeric(10, 4) NOT NULL,
	"profit_time" integer NOT NULL,
	"loss_time" integer NOT NULL,
	"take_profit" numeric(20, 8) NOT NULL,
	"stop_loss" numeric(20, 8) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"profit_chance" numeric(5, 2) NOT NULL,
	"trade_duration_type" text NOT NULL,
	"suggested_direction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_historical_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"open" numeric(20, 8) NOT NULL,
	"high" numeric(20, 8) NOT NULL,
	"low" numeric(20, 8) NOT NULL,
	"close" numeric(20, 8) NOT NULL,
	"volume" numeric(20, 8) NOT NULL,
	"profit_loss_percent" numeric(10, 4) NOT NULL,
	"distance_to_take_profit" numeric(10, 4) NOT NULL,
	"distance_to_stop_loss" numeric(10, 4) NOT NULL,
	"was_profitable" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" text NOT NULL,
	"signal_id" text NOT NULL,
	"symbol" text NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"exit_price" numeric(20, 8) NOT NULL,
	"entry_timestamp" timestamp NOT NULL,
	"exit_timestamp" timestamp NOT NULL,
	"exit_reason" text NOT NULL,
	"realized_pnl" numeric(10, 4) NOT NULL,
	"realized_pnl_percent" real NOT NULL,
	"max_drawdown" numeric(10, 4) NOT NULL,
	"max_drawdown_percent" real NOT NULL,
	"time_to_target" integer NOT NULL,
	"realized_volatility" real NOT NULL,
	"forecast_accuracy" real NOT NULL,
	"path_accuracy" real NOT NULL,
	"total_fees" numeric(10, 6) NOT NULL,
	"total_slippage" numeric(10, 6) NOT NULL,
	"net_pnl" numeric(10, 4) NOT NULL,
	"predicted_win_prob" real NOT NULL,
	"actual_win" boolean NOT NULL,
	"prediction_error" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_outcomes_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "trade_simulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"signal_type" text NOT NULL,
	"simulation_type" text DEFAULT 'SHORT' NOT NULL,
	"confidence" real NOT NULL,
	"profit_likelihood" real NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"tp_price" numeric(20, 8) NOT NULL,
	"sl_price" numeric(20, 8) NOT NULL,
	"amount" numeric(20, 8) DEFAULT '1000' NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"actual_outcome" text DEFAULT 'IN_PROGRESS',
	"profit_loss" numeric(10, 4) DEFAULT '0' NOT NULL,
	"profitable_percentage" real DEFAULT 0 NOT NULL,
	"highest_profit" numeric(10, 4) DEFAULT '0' NOT NULL,
	"lowest_loss" numeric(10, 4) DEFAULT '0' NOT NULL,
	"success_score" real DEFAULT 0 NOT NULL,
	"success_score_threshold" real DEFAULT 0.1 NOT NULL,
	"is_successful" boolean DEFAULT false NOT NULL,
	"time_in_profit_ratio" real DEFAULT 0 NOT NULL,
	"max_favorable_excursion" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_drawdown" numeric(10, 4) DEFAULT '0' NOT NULL,
	"duration_minutes" integer DEFAULT 20 NOT NULL,
	"final_profitable_seconds" integer DEFAULT 0 NOT NULL,
	"market_conditions" json,
	"indicator_values" json,
	"completion_processed" boolean DEFAULT false NOT NULL,
	"last_processed_at" timestamp,
	"process_version" integer DEFAULT 1 NOT NULL,
	"current_profit_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"profit_time" integer DEFAULT 0 NOT NULL,
	"loss_time" integer DEFAULT 0 NOT NULL,
	"last_update_timestamp" timestamp DEFAULT now() NOT NULL,
	"actual_movement_percent" numeric(10, 4) DEFAULT '0' NOT NULL,
	"max_price_during_trade" numeric(20, 8) DEFAULT '0' NOT NULL,
	"min_price_during_trade" numeric(20, 8) DEFAULT '0' NOT NULL,
	"excluded_from_learning" boolean DEFAULT false NOT NULL,
	"movement_filter_threshold" numeric(10, 4) DEFAULT '0.1' NOT NULL,
	"avg_forecast_accuracy" real,
	"early_accuracy_3min" real,
	"volatility_alignment_score" real,
	"drift_correction_applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" text NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"direction" text NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"take_profit_price" numeric(20, 8),
	"stop_loss_price" numeric(20, 8),
	"position_size" integer,
	"forecast_return" real NOT NULL,
	"path_slope" real NOT NULL,
	"confidence" real NOT NULL,
	"technical_snapshot" json NOT NULL,
	"reason" text NOT NULL,
	"warnings" json NOT NULL,
	"risk_reward_ratio" real,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"executed_at" timestamp,
	"executed_price" numeric(20, 8),
	"outcome_status" text,
	"closed_at" timestamp,
	"closed_price" numeric(20, 8),
	"actual_return" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trade_suggestions_trade_id_unique" UNIQUE("trade_id")
);
--> statement-breakpoint
CREATE TABLE "trade_ticks" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"minute_timestamp" timestamp NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"size" numeric(20, 8) NOT NULL,
	"side" text NOT NULL,
	"trade_id" text,
	"notional_value" numeric(20, 2) NOT NULL,
	"is_large_trade" boolean DEFAULT false,
	"price_impact" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"total" numeric(20, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "algorithm_success_snapshots" ADD CONSTRAINT "algorithm_success_snapshots_trade_id_trade_simulations_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_simulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_performance_data" ADD CONSTRAINT "forecast_performance_data_trade_id_trade_simulations_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_dataset" ADD CONSTRAINT "learning_dataset_signal_id_enhanced_signals_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."enhanced_signals"("signal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persistent_forecast_points" ADD CONSTRAINT "persistent_forecast_points_forecast_id_persistent_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."persistent_forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_chart_data" ADD CONSTRAINT "trade_chart_data_trade_id_trade_simulations_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_historical_prices" ADD CONSTRAINT "trade_historical_prices_trade_id_trade_simulations_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade_simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_outcomes" ADD CONSTRAINT "trade_outcomes_signal_id_enhanced_signals_signal_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."enhanced_signals"("signal_id") ON DELETE no action ON UPDATE no action;