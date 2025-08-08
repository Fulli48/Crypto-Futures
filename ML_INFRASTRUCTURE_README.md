# ML Infrastructure Documentation

## Overview
Comprehensive machine learning infrastructure for cryptocurrency trading with real-time inference, continuous learning, and enterprise-grade logging/recovery capabilities.

## Database Schema

### Core Tables

#### `rollingChartData`
Real-time minute-by-minute cryptocurrency data with technical indicators.
```sql
- id: SERIAL PRIMARY KEY
- symbol: VARCHAR(20) NOT NULL -- BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, ADAUSDT, HBARUSDT
- timestamp: TIMESTAMP NOT NULL -- ISO 8601 format
- open: DECIMAL(20,8) -- Opening price
- high: DECIMAL(20,8) -- Highest price
- low: DECIMAL(20,8) -- Lowest price
- close: DECIMAL(20,8) -- Closing price
- volume: DECIMAL(20,8) -- Trading volume
- rsi: DECIMAL(10,4) -- Relative Strength Index (0-100)
- macd: DECIMAL(15,8) -- MACD indicator
- bollinger_upper: DECIMAL(20,8) -- Bollinger Band upper
- bollinger_lower: DECIMAL(20,8) -- Bollinger Band lower
- stochastic_k: DECIMAL(10,4) -- Stochastic K% (0-100)
- stochastic_d: DECIMAL(10,4) -- Stochastic D% (0-100)
- volatility: DECIMAL(10,6) -- Price volatility (0-1)
- is_complete: BOOLEAN -- All indicators calculated
- created_at: TIMESTAMP DEFAULT NOW()
```

#### `mlTrainingSamples`
Training data for machine learning models.
```sql
- id: SERIAL PRIMARY KEY
- symbol: VARCHAR(20) NOT NULL
- features: JSONB NOT NULL -- Technical indicators and market data
- target: DECIMAL(10,6) -- Future price change percentage
- forecast_horizon: INTEGER NOT NULL -- Minutes ahead (5, 15, 30, 60)
- created_at: TIMESTAMP DEFAULT NOW()
- metadata: JSONB -- Additional context
```

#### `mlTrainingBatches`
Training batch tracking and model versioning.
```sql
- id: SERIAL PRIMARY KEY
- batch_id: VARCHAR(50) UNIQUE NOT NULL
- symbol: VARCHAR(20) NOT NULL
- model_type: VARCHAR(30) -- 'xgboost', 'lstm', 'ensemble'
- training_samples: INTEGER NOT NULL
- validation_samples: INTEGER NOT NULL
- rmse: DECIMAL(10,6) -- Root Mean Square Error
- mae: DECIMAL(10,6) -- Mean Absolute Error
- accuracy: DECIMAL(5,4) -- Model accuracy (0-1)
- model_path: VARCHAR(255) -- File system path to model
- is_production: BOOLEAN DEFAULT FALSE
- created_at: TIMESTAMP DEFAULT NOW()
```

#### `persistentForecasts`
ML model predictions and forecast tracking.
```sql
- id: SERIAL PRIMARY KEY
- symbol: VARCHAR(20) NOT NULL
- forecast_type: VARCHAR(30) -- 'price_direction', 'volatility', 'trend'
- confidence: DECIMAL(5,2) -- Prediction confidence (0-100)
- predicted_value: DECIMAL(15,8) -- Predicted price/change
- actual_value: DECIMAL(15,8) -- Actual outcome (when available)
- forecast_horizon: INTEGER -- Minutes ahead
- model_version: VARCHAR(50) -- Model identifier
- created_at: TIMESTAMP DEFAULT NOW()
- expires_at: TIMESTAMP -- Forecast expiration
```

#### `tradeSimulations`
Simulated trade execution and performance tracking.
```sql
- id: SERIAL PRIMARY KEY
- symbol: VARCHAR(20) NOT NULL
- signal_type: VARCHAR(10) -- 'LONG', 'SHORT', 'WAIT'
- entry_price: DECIMAL(20,8) NOT NULL
- tp_price: DECIMAL(20,8) -- Take profit target
- sl_price: DECIMAL(20,8) -- Stop loss level
- current_price: DECIMAL(20,8) -- Current market price
- confidence: INTEGER -- ML confidence (0-100)
- profit_likelihood: INTEGER -- Profit probability (0-100)
- real_time_pnl: DECIMAL(10,4) -- Current P&L percentage
- highest_profit: DECIMAL(10,4) -- Peak profit achieved
- lowest_loss: DECIMAL(10,4) -- Maximum drawdown
- profitable_minutes: INTEGER -- Time in profit
- total_minutes: INTEGER -- Total trade duration
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP DEFAULT NOW()
- completed_at: TIMESTAMP -- Trade completion time
```

### Logging Tables

#### `systemLogs`
Enterprise-grade system event logging.
```sql
- id: SERIAL PRIMARY KEY
- category: VARCHAR(50) -- 'feature_calculation', 'ml_training', 'api_request'
- subcategory: VARCHAR(50) -- Specific operation type
- level: VARCHAR(10) -- 'info', 'warning', 'error', 'debug'
- message: TEXT -- Log message
- context: JSONB -- Additional context data
- symbol: VARCHAR(20) -- Associated cryptocurrency (if applicable)
- timestamp: TIMESTAMP DEFAULT NOW()
- stack_trace: TEXT -- Error stack trace (if error)
```

#### `recoveryState`
System recovery and state management.
```sql
- id: SERIAL PRIMARY KEY
- service_name: VARCHAR(50) -- 'chart_building', 'ml_training', 'api_requests'
- operation_id: VARCHAR(100) -- Unique operation identifier
- state_data: JSONB -- Serialized state information
- checkpoint_type: VARCHAR(30) -- 'success', 'error', 'intermediate'
- created_at: TIMESTAMP DEFAULT NOW()
```

## Worker Architecture

### 1. Feature Calculation Worker (`workers/feature-calculator.ts`)
**Purpose**: Calculate technical indicators and market features
**Dependencies**: 
- `rollingChartService` for data access
- `loggingService` for audit trails
- Real-time price APIs

**Configuration**:
```typescript
interface FeatureConfig {
  rsiPeriod: number; // Default: 14
  macdFast: number; // Default: 12
  macdSlow: number; // Default: 26
  macdSignal: number; // Default: 9
  bollingerPeriod: number; // Default: 20
  bollingerStdDev: number; // Default: 2
  stochasticK: number; // Default: 14
  stochasticD: number; // Default: 3
  volatilityWindow: number; // Default: 5
}
```

### 2. ML Training Worker (`workers/ml-trainer.ts`)
**Purpose**: Automated model training and validation
**Dependencies**:
- `mlTrainingSamples` table for training data
- Python ML scripts for model execution
- Model registry for versioning

**Configuration**:
```typescript
interface TrainingConfig {
  windowSize: number; // Default: 600 minutes
  forecastHorizons: number[]; // Default: [5, 15, 30, 60]
  validationSplit: number; // Default: 0.2
  modelTypes: string[]; // Default: ['xgboost', 'lstm', 'ensemble']
  batchSize: number; // Default: 1000
  maxEpochs: number; // Default: 100
  earlyStoppingPatience: number; // Default: 10
}
```

### 3. ML Inference Worker (`workers/ml-inference.ts`)
**Purpose**: Real-time prediction generation
**Dependencies**:
- Trained models from registry
- Live market data
- Feature calculation pipeline

**Configuration**:
```typescript
interface InferenceConfig {
  confidenceThreshold: number; // Default: 60
  ensembleWeights: Record<string, number>; // Model voting weights
  predictionCache: boolean; // Default: true
  maxPredictionAge: number; // Default: 300 seconds
}
```

### 4. Forecasting Worker (`workers/forecaster.ts`)
**Purpose**: Multi-horizon price and trend forecasting
**Dependencies**:
- ML models for different horizons
- Historical pattern analysis
- Market condition assessment

**Configuration**:
```typescript
interface ForecastConfig {
  horizons: number[]; // Default: [5, 15, 30, 60, 240, 1440]
  updateFrequency: number; // Default: 60 seconds
  confidenceDecay: number; // Default: 0.95 per minute
  marketRegimes: string[]; // ['trending', 'ranging', 'volatile']
}
```

### 5. Chart Monitor Worker (`workers/chart-monitor.ts`)
**Purpose**: Data quality monitoring and validation
**Dependencies**:
- All chart data tables
- Data completeness metrics
- Alert systems

**Configuration**:
```typescript
interface MonitorConfig {
  completenessThreshold: number; // Default: 0.95
  alertThresholds: {
    missingData: number; // Default: 0.1
    staleData: number; // Default: 300 seconds
    invalidValues: number; // Default: 0.05
  };
  checkInterval: number; // Default: 60 seconds
}
```

## Configuration Management

### Global Configuration (`config/ml-config.ts`)
```typescript
interface MLSystemConfig {
  system: {
    environment: 'development' | 'production';
    logLevel: 'debug' | 'info' | 'warning' | 'error';
    enableRecovery: boolean;
    maxConcurrentWorkers: number;
  };
  
  data: {
    retentionDays: number; // Default: 30
    compressionThreshold: number; // Default: 7 days
    backfillBatchSize: number; // Default: 1000
  };
  
  features: FeatureConfig;
  training: TrainingConfig;
  inference: InferenceConfig;
  forecasting: ForecastConfig;
  monitoring: MonitorConfig;
  
  symbols: string[]; // ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT']
  exchanges: string[]; // ['binance-us', 'coinbase', 'bybit']
}
```

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Real-Time     │───▶│  Feature         │───▶│   ML Training   │
│   Price APIs    │    │  Calculator      │    │   Worker        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ rollingChartData│    │  Technical       │    │ mlTrainingSamples│
│     Table       │    │  Indicators      │    │     Table       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ML Inference  │───▶│   Forecasting    │───▶│ persistentForecasts│
│     Worker      │    │     Worker       │    │     Table       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Trading Signals │    │  Chart Monitor   │
│   & Simulation  │    │     Worker       │
└─────────────────┘    └──────────────────┘
```

## Performance Metrics

### Model Performance Tracking
- **RMSE**: Root Mean Square Error for price predictions
- **MAE**: Mean Absolute Error for directional accuracy
- **Accuracy**: Percentage of correct directional predictions
- **Sharpe Ratio**: Risk-adjusted return measurement
- **Maximum Drawdown**: Largest peak-to-trough decline

### System Performance Monitoring
- **Latency**: End-to-end prediction generation time
- **Throughput**: Predictions per second
- **Data Completeness**: Percentage of complete feature sets
- **Error Rate**: Failed operations per total operations
- **Recovery Time**: Time to restore from failures

## Deployment and Scaling

### Production Requirements
- **Memory**: 4GB minimum for ML model loading
- **CPU**: 4 cores minimum for parallel processing
- **Storage**: 50GB for model registry and data retention
- **Database**: PostgreSQL 13+ with JSONB support

### Monitoring and Alerting
- Real-time dashboard for system health
- Automated alerts for data quality issues
- Performance degradation detection
- Model accuracy drift monitoring

### Backup and Recovery
- Automated database backups every 6 hours
- Model registry versioning and rollback
- State checkpointing for critical operations
- Disaster recovery procedures documented

## Security Considerations

### API Security
- Rate limiting on external API calls
- Secure storage of API credentials
- Request/response validation
- Error handling without data exposure

### Data Protection
- Encrypted storage of sensitive data
- Access control for model files
- Audit logging for all operations
- Data retention policies compliance

## Troubleshooting Guide

### Common Issues
1. **Model Training Failures**: Check data completeness and feature validation
2. **Prediction Latency**: Monitor feature calculation performance
3. **Data Gaps**: Verify API connectivity and rate limits
4. **Memory Issues**: Review model loading and caching strategies

### Debug Tools
- Comprehensive logging with context data
- Performance profiling for bottlenecks
- Data quality reports
- Model performance analytics

## Future Enhancements

### Planned Features
- Multi-timeframe analysis integration
- Advanced ensemble methods
- Real-time anomaly detection
- Automated hyperparameter optimization
- Cross-market correlation analysis

### Research Areas
- Deep reinforcement learning for trading
- Attention mechanisms for time series
- Federated learning for privacy
- Quantum computing applications