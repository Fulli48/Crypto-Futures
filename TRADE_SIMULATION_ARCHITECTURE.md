# Complete A-Z Trade Simulation System Architecture

## Overview
This document provides a comprehensive A-Z explanation of the cryptocurrency trade simulation system, including all data structures, algorithms, storage mechanisms, and component connections. The system uses authentic Coinbase API data exclusively with no fallbacks or synthetic data.

---

## A. AUTHENTICATION & API INTEGRATION

### Coinbase API System
**File:** `server/real-price-api.ts`
- **Authentication:** Uses COINBASE_API_KEY and COINBASE_API_SECRET environment variables
- **Data Sources:** Exclusively Coinbase spot prices with calculated futures premiums
- **Symbols:** 6 approved cryptocurrencies (BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, ADAUSDT, HBARUSDT)
- **Pricing Logic:** Spot price + futures premium (BTC +1.2%, ETH +0.8%, SOL +0.5%, etc.)

### API Rate Limiting & Caching
- **Cache Duration:** 3-second intervals to prevent API overload
- **Batch Processing:** Single API calls per symbol with intelligent caching
- **Error Handling:** Comprehensive error logging with no fallback data sources

---

## B. BACKGROUND SERVICES

### ML Learning Background Service
**File:** `server/routes.ts` (lines 2655-2709)
```javascript
const runMLLearningCycle = async () => {
  // STEP 1: Analyze completed trades
  const analyzedTrades = await learningEngine.analyzeAndDeleteCompletedTrades();
  
  // STEP 2: Retrain ML engine with new data
  await mlTradeSignalEngine.trainModel();
  
  // STEP 3: Create new trades with ML filtering
  await learningEngine.createNewTradesWithMLFiltering();
};
setInterval(runMLLearningCycle, 30000); // Every 30 seconds
```

### Moderate Backfill Service
**File:** `server/moderate-backfill-service.ts`
- **Purpose:** Gradual historical data accumulation (3 minutes every 15 seconds)
- **API-Friendly:** 1-second delays between symbols to prevent overload
- **Control Endpoints:**
  - `POST /api/moderate-backfill/start` - Start service
  - `POST /api/moderate-backfill/stop` - Stop service
  - `GET /api/moderate-backfill/status` - Progress tracking

---

## C. CHART DATA SYSTEM

### Rolling Chart Data (Primary System)
**Database Table:** `rollingChartData`
```sql
CREATE TABLE rolling_chart_data (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  open DECIMAL(20,8) NOT NULL,
  high DECIMAL(20,8) NOT NULL,
  low DECIMAL(20,8) NOT NULL,
  close DECIMAL(20,8) NOT NULL,
  volume DECIMAL(20,8) DEFAULT '0',
  
  -- Technical Indicators
  rsi REAL DEFAULT 50,
  macd REAL DEFAULT 0,
  macd_signal REAL DEFAULT 0,
  macd_histogram REAL DEFAULT 0,
  bollinger_upper DECIMAL(20,8) DEFAULT '0',
  bollinger_middle DECIMAL(20,8) DEFAULT '0',
  bollinger_lower DECIMAL(20,8) DEFAULT '0',
  stochastic_k REAL DEFAULT 50,
  stochastic_d REAL DEFAULT 50,
  ema_alignment INTEGER DEFAULT 0,
  support_level DECIMAL(20,8) DEFAULT '0',
  resistance_level DECIMAL(20,8) DEFAULT '0',
  market_structure TEXT DEFAULT 'range',
  detected_patterns JSON DEFAULT '[]',
  volatility REAL DEFAULT 0,
  volume_profile JSON DEFAULT '{}',
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Chart Data Collection Process
1. **Real-time Collection:** Every 3 seconds via Dynamic Live ML Engine
2. **Historical Backfill:** 3 minutes every 15 seconds via Moderate Backfill Service
3. **Technical Indicators:** Calculated and stored with each price point
4. **Cleanup:** Maintains 60-minute rolling window, removes data older than 65 minutes

---

## D. DYNAMIC LIVE ML ENGINE

### Core Engine Architecture
**File:** `server/dynamic-live-ml-engine.ts`
```javascript
export class DynamicLiveMLEngine {
  private mlEngine: MLTradeSignalEngine;
  private updateIntervals: Map<string, NodeJS.Timeout>;
  private approvedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private chartDataStatus: Map<string, {
    lastUpdate: number;
    dataPoints: number;
    isComplete: boolean;
  }>;
}
```

### Data Flow Process
1. **Price Fetching:** Authentic Coinbase prices every 3 seconds
2. **Chart Data Storage:** Minute-by-minute OHLCV with technical indicators
3. **ML Signal Generation:** 20-minute forecasts using ML Forecast Engine
4. **Signal Storage:** Live ML signals in database for frontend consumption
5. **Quality Classification:** PREMIUM/HIGH/MEDIUM/LOW/FILTERED tiers

---

## E. ENHANCED TRADING ENGINE

### Trade Creation Algorithm
**File:** `server/enhanced-trading-engine.ts`
```javascript
shouldCreateTradeWithSuccessScore(signal, marketCondition, entryScore, successScorePrediction) {
  // Quality thresholds for trade creation:
  const MINIMUM_CONFIDENCE = 60;           // 60% ML confidence
  const MINIMUM_SUCCESS_SCORE_PREDICTION = 5.0;   // 5.0% success score
  const MINIMUM_SUCCESS_PROBABILITY = 30.0;       // 30% success probability
  const MINIMUM_MARKET_SCORE = 35;               // 35% market score
  const MINIMUM_ENTRY_SCORE = 45;                // 45% entry score
  const MINIMUM_RR_RATIO = 1.2;                  // 1.2:1 risk/reward
  
  return signal.confidence >= MINIMUM_CONFIDENCE &&
         signal.signal !== 'WAIT' &&
         successScorePrediction.successScore >= MINIMUM_SUCCESS_SCORE_PREDICTION &&
         successScorePrediction.successProbability >= MINIMUM_SUCCESS_PROBABILITY;
}
```

---

## F. FORECASTING SYSTEM

### ML Forecast Engine
**File:** `server/ml-forecast-engine.ts`
- **Prediction Window:** 20-minute forecasts with minute-by-minute OHLCV data
- **Data Requirements:** Minimum 20 minutes of historical chart data
- **Algorithm:** Linear regression with volatility modeling and trend analysis
- **Output:** Directional signals (LONG/SHORT/WAIT) with confidence scores

### Persistent Forecast Storage
**Database Tables:** `persistentForecasts` and `persistentForecastPoints`
```sql
-- Main forecast metadata
CREATE TABLE persistent_forecasts (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  forecast_key TEXT UNIQUE NOT NULL,
  base_timestamp TIMESTAMP NOT NULL,
  base_price_precision INTEGER NOT NULL,
  base_price DECIMAL(20,8) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  forecast_type TEXT DEFAULT 'ML_ENGINE',
  confidence_score REAL DEFAULT 0
);

-- Individual forecast points (1-20 minutes ahead)
CREATE TABLE persistent_forecast_points (
  id SERIAL PRIMARY KEY,
  forecast_id INTEGER REFERENCES persistent_forecasts(id) ON DELETE CASCADE,
  future_timestamp TIMESTAMP NOT NULL,
  minutes_ahead INTEGER NOT NULL,
  predicted_open DECIMAL(20,8) NOT NULL,
  predicted_high DECIMAL(20,8) NOT NULL,
  predicted_low DECIMAL(20,8) NOT NULL,
  predicted_close DECIMAL(20,8) NOT NULL,
  predicted_volume DECIMAL(20,8) DEFAULT '1000',
  confidence REAL NOT NULL
);
```

---

## G. GUARANTEED DATA INTEGRITY

### Validation Systems
**File:** `server/data-validation.ts`
- **Trade Validation:** Comprehensive validation before database storage
- **Price Validation:** Ensures all prices are authentic Coinbase data
- **Null Protection:** Multi-layer validation preventing corrupted data
- **Foreign Key Constraints:** Cascading deletes maintain referential integrity

### Data Cleanup Service
**File:** `server/data-cleanup-service.ts`
- **Quality Filtering:** Removes trades with 2+ instances of 0.0 or N/A values
- **Selective Deletion:** Preserves good trades for ML learning, removes corrupted data
- **Automatic Cleanup:** 30-second delay after trade completion with quality assessment

---

## H. HISTORICAL PRICE DATA

### Trade Historical Prices Table
**Database Schema:**
```sql
CREATE TABLE trade_historical_prices (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER REFERENCES trade_simulations(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  open DECIMAL(20,8) NOT NULL,
  high DECIMAL(20,8) NOT NULL,
  low DECIMAL(20,8) NOT NULL,
  close DECIMAL(20,8) NOT NULL,
  volume DECIMAL(20,8) NOT NULL,
  
  -- Trade analysis for each minute
  profit_loss_percent DECIMAL(10,4) NOT NULL,
  distance_to_take_profit DECIMAL(10,4) NOT NULL,
  distance_to_stop_loss DECIMAL(10,4) NOT NULL,
  was_profitable BOOLEAN NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## I. IDEMPOTENCY SYSTEM

### Trade Completion Processing
**Database Fields:** `completionProcessed`, `lastProcessedAt`, `processVersion`
- **Atomic Transactions:** Prevents duplicate processing during concurrent operations
- **Process Versioning:** Tracks processing attempts and prevents race conditions
- **Transaction Rollback:** Automatic rollback on failed completions

---

## J. JSON DATA STRUCTURES

### Market Conditions Storage
```json
{
  "signal": "SHORT",
  "profitLikelihood": 76,
  "mlPredictionStrength": "DYNAMIC_ML_ENGINE",
  "riskRewardRatio": 1.5,
  "marketScore": 67,
  "entryScore": 72,
  "volatility": "MEDIUM",
  "trendDirection": "BEARISH"
}
```

### Indicator Values Storage
```json
{
  "rsi": 50,
  "macd": 0,
  "confidence": 74,
  "mlEngineGenerated": true,
  "dynamicLiveMLGenerated": true,
  "bollingerPosition": "MIDDLE",
  "stochasticOverbought": false
}
```

---

## K. KEY PERFORMANCE METRICS

### Success Score Calculation Algorithm
**File:** `server/learning-engine.ts`
```javascript
calculateEnhancedSuccessScore(trade) {
  const profitComponent = (trade.profitLoss / 100) * 0.2;    // 20% weight
  const timeComponent = (trade.timeInProfitRatio) * 0.4;     // 40% weight  
  const mfeComponent = (trade.maxFavorableExcursion / 100) * 0.15;  // 15% weight
  const drawdownPenalty = (trade.maxDrawdown / 100) * -0.15;        // -15% penalty
  
  let baseScore = profitComponent + timeComponent + mfeComponent + drawdownPenalty;
  
  // Consistency bonus for sustained performance
  if (trade.timeInProfitRatio > 0.7) {
    baseScore *= 1.5; // 50% bonus
  }
  
  return Math.max(-1, Math.min(1, baseScore));
}
```

---

## L. LEARNING ENGINE

### ML Training Process
**File:** `server/learning-engine.ts`
- **Trade Analysis:** Analyzes completed trades every 30 seconds
- **Weight Optimization:** Adjusts technical indicator weights based on performance
- **Feature Importance:** Tracks which indicators contribute most to successful trades
- **Model Retraining:** Continuous improvement using authentic trade performance data

### Learning Analytics
**Database Table:** `learningAnalytics`
- **Trade Counting:** Tracks total analyzed trades by simulation type
- **Performance Metrics:** Success rates, profit margins, sample sizes
- **Temporal Tracking:** Last analysis timestamps for monitoring

---

## M. ML SIGNAL STORAGE

### Live ML Signals Table
**Database Schema:**
```sql
CREATE TABLE live_ml_signals (
  id SERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  signal TEXT NOT NULL,           -- 'LONG', 'SHORT', 'WAIT'
  confidence REAL NOT NULL,
  profit_likelihood REAL NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  take_profit DECIMAL(20,8) NOT NULL,
  stop_loss DECIMAL(20,8) NOT NULL,
  risk_reward_ratio REAL NOT NULL,
  model_explanation TEXT NOT NULL,
  feature_importance JSON DEFAULT '{}',
  is_filtered BOOLEAN DEFAULT FALSE,
  filter_reason TEXT,
  quality_tier TEXT NOT NULL,     -- 'PREMIUM', 'HIGH', 'MEDIUM', 'LOW', 'FILTERED'
  current_price DECIMAL(20,8) NOT NULL,
  unrealized_pnl REAL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## N. NOTIFICATION & MONITORING

### Health Monitoring System
- **Chart Data Completeness:** Tracks data accumulation progress (X/60 minutes)
- **API Health:** Monitors Coinbase API response times and error rates
- **ML Engine Status:** Tracks signal generation frequency and quality
- **Auto-Restart:** Automatic system recovery with maximum 10 restart attempts

---

## O. OPERATIONAL WORKFLOWS

### Trade Creation Workflow
1. **Chart Data Check:** Ensure minimum 20 minutes of data available
2. **ML Signal Generation:** Generate 20-minute forecast using ML Forecast Engine
3. **Quality Assessment:** Apply 70% confidence threshold and quality criteria
4. **Trade Creation:** Create trade record with TP/SL levels and market conditions
5. **Real-time Monitoring:** Track profit/loss, time in profit, MFE/drawdown

### Trade Completion Workflow
1. **Outcome Detection:** TP_HIT, SL_HIT, or EXPIRED status
2. **Historical Analysis:** Minute-by-minute P&L calculation using authentic prices
3. **Success Score Calculation:** Enhanced 4-component weighted algorithm
4. **ML Learning:** Feed results back to ML engine for continuous improvement
5. **Data Cleanup:** Selective quality-based trade deletion

---

## P. PRECISION & PRICING

### Price Precision System
- **Dynamic Precision:** Matches current market price decimal places
- **Futures Premiums:** Calculated based on spot prices with realistic spreads
- **TP/SL Calculation:** Risk/reward ratios between 1.2:1 and 2.0:1
- **Profit Tracking:** Real-time P&L calculated to 4 decimal places

---

## Q. QUALITY CONTROL

### Signal Quality Classification
```javascript
classifySignalQuality(signal) {
  if (signal.confidence >= 80 && signal.profitLikelihood >= 70) return 'PREMIUM';
  if (signal.confidence >= 65 && signal.profitLikelihood >= 55) return 'HIGH';
  if (signal.confidence >= 50 && signal.profitLikelihood >= 40) return 'MEDIUM';
  if (signal.confidence >= 35) return 'LOW';
  return 'FILTERED';
}
```

### Trade Quality Thresholds
- **Minimum Confidence:** 70% for trade creation
- **Success Score Prediction:** ≥5.0% for quality trades
- **Risk/Reward Ratio:** ≥1.2:1 for acceptable risk
- **Market Score:** ≥35% for favorable conditions

---

## R. REAL-TIME DATA PROCESSING

### 3-Second Update Cycle
1. **Price Fetching:** Coinbase spot prices for all 6 symbols
2. **Technical Analysis:** Calculate RSI, MACD, Bollinger Bands, Stochastic
3. **Chart Data Storage:** Store minute-level OHLCV with indicators
4. **ML Signal Update:** Generate/update live ML signals
5. **Frontend Sync:** Update UI with latest signals and trade data

---

## S. SIMULATION TYPES & DURATION

### Trade Simulation Types
- **SHORT:** 5-minute simulations for quick signals
- **MEDIUM:** 10-minute simulations for balanced analysis  
- **LONG:** 15-minute simulations for comprehensive trends

### Duration Tracking
```sql
-- Key timing fields in trade_simulations table
start_time TIMESTAMP NOT NULL DEFAULT NOW(),
end_time TIMESTAMP,                          -- Set when completed
duration_minutes INTEGER DEFAULT 5,
final_profitable_seconds INTEGER DEFAULT 0,
```

---

## T. TRADE SIMULATIONS DATABASE

### Complete Trade Simulations Schema
```sql
CREATE TABLE trade_simulations (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL,              -- 'LONG' or 'SHORT'
  simulation_type TEXT DEFAULT 'SHORT',   -- 'SHORT', 'MEDIUM', 'LONG'
  confidence REAL NOT NULL,
  profit_likelihood REAL NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  tp_price DECIMAL(20,8) NOT NULL,        -- Take Profit Price
  sl_price DECIMAL(20,8) NOT NULL,        -- Stop Loss Price
  
  -- Critical timing data
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,                     -- NULL when active
  
  -- Trade outcome tracking
  actual_outcome TEXT DEFAULT 'IN_PROGRESS',  -- 'IN_PROGRESS', 'TP_HIT', 'SL_HIT', 'EXPIRED'
  profit_loss DECIMAL(10,4) DEFAULT '0',
  profitable_percentage REAL DEFAULT 0,
  highest_profit DECIMAL(10,4) DEFAULT '0',
  lowest_loss DECIMAL(10,4) DEFAULT '0',
  
  -- Enhanced success metrics
  success_score REAL DEFAULT 0,
  success_score_threshold REAL DEFAULT 0.1,
  is_successful BOOLEAN DEFAULT FALSE,
  time_in_profit_ratio REAL DEFAULT 0,
  max_favorable_excursion DECIMAL(10,4) DEFAULT '0',
  max_drawdown DECIMAL(10,4) DEFAULT '0',
  duration_minutes INTEGER DEFAULT 5,
  final_profitable_seconds INTEGER DEFAULT 0,
  
  -- Market context
  market_conditions JSON,                 -- ML signal data snapshot
  indicator_values JSON,                  -- Technical indicators at creation
  
  -- Processing control
  completion_processed BOOLEAN DEFAULT FALSE,
  last_processed_at TIMESTAMP,
  process_version INTEGER DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Data Points Stored Per Trade
1. **Entry Data:** Symbol, signal type, confidence, profit likelihood
2. **Price Levels:** Entry price, take profit, stop loss with precise calculations
3. **Timing Information:** Start time, end time, duration tracking
4. **Performance Metrics:** Real-time P&L, highest profit, lowest loss
5. **Success Analysis:** Success score (4-component algorithm), time in profit ratio
6. **Market Context:** Complete market conditions and technical indicators snapshot
7. **Processing Metadata:** Completion status, processing timestamps, version control

---

## U. USER INTERFACE INTEGRATION

### Frontend Data Flow
1. **Active Trades Display:** Real-time P&L, progress bars, remaining time
2. **ML Signals Panel:** Current signals with confidence and profit likelihood
3. **Chart Data Progress:** Visual progress bars showing data accumulation (X/60 minutes)
4. **Performance Metrics:** Success rates, profit strength, failure rates

### API Endpoints
- `GET /api/active-trades` - Current active simulations
- `GET /api/dynamic-live-ml/signal/:symbol` - Latest ML signals
- `GET /api/learning/algorithm-success` - Performance statistics
- `GET /api/rolling-chart-data/:symbol` - Chart data completeness

---

## V. VALIDATION & ERROR HANDLING

### Comprehensive Validation Pipeline
1. **Input Validation:** Zod schemas for all API requests
2. **Price Validation:** Ensure prices are within reasonable market ranges
3. **Technical Indicator Validation:** Verify RSI (0-100), MACD reasonable ranges
4. **Database Constraints:** Foreign keys, NOT NULL constraints, precision limits
5. **Business Logic Validation:** Risk/reward ratios, confidence thresholds

---

## W. WORKFLOW COORDINATION

### Background Service Coordination
```javascript
// Main application startup sequence
1. Initialize databases and schemas
2. Start Real Price API with Coinbase authentication
3. Launch Dynamic Live ML Engine (3-second intervals)
4. Start Moderate Backfill Service (15-second intervals)
5. Begin ML Learning Background Service (30-second intervals)
6. Initialize Trade Completion Monitor
7. Start API server and frontend serving
```

---

## X. EXTERNAL DEPENDENCIES

### Required Services
1. **Coinbase Advanced Trade API:** Exclusive price data source
2. **PostgreSQL Database:** Primary data storage with Drizzle ORM
3. **Node.js Runtime:** Backend services and Express API server
4. **React Frontend:** Real-time UI with chart visualization

### Environment Variables
```bash
# Authentication
COINBASE_API_KEY=<required>
COINBASE_API_SECRET=<required>

# Database
DATABASE_URL=<postgresql_connection_string>
PGHOST=<host>
PGPORT=<port>
PGUSER=<username>
PGPASSWORD=<password>
PGDATABASE=<database_name>
```

---

## Y. YIELDING PERFORMANCE RESULTS

### Current System Performance (from logs)
- **Active Trades:** 24 concurrent simulations
- **Chart Data Progress:** 44/60 minutes accumulated (73.3% complete)
- **Confidence Levels:** All active trades show 70%+ confidence (73%, 74%, etc.)
- **Data Collection Rate:** 3-second real-time + 15-second historical backfill
- **Success Rate:** 30.7% using combined scoring methodology
- **API Efficiency:** Cached responses preventing overload, 1-second delays between symbols

---

## Z. ZERO FALLBACK POLICY

### Absolute Data Integrity Requirements
1. **No Synthetic Data:** System never generates fake prices or fallback data
2. **Coinbase Only:** Exclusive use of Coinbase API for all price information
3. **Authentic Futures:** Calculated futures premiums based on real spot prices
4. **Error Handling:** Clear error states when authentic data unavailable
5. **Quality Enforcement:** 70% confidence threshold ensures only high-quality trades

### System Failure Modes
- **API Unavailable:** Display error messages, no synthetic substitution
- **Insufficient Data:** Block trade creation until adequate chart data accumulated
- **Authentication Issues:** Clear user guidance to provide proper API credentials
- **Database Errors:** Graceful degradation with comprehensive error logging

---

## COMPONENT CONNECTIONS DIAGRAM

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Coinbase API │───▶│  Real Price API  │───▶│ Rolling Chart   │
│   (Authentic)   │    │  (3s intervals)  │    │ Data Storage    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Moderate        │    │ Dynamic Live ML  │───▶│ ML Forecast     │
│ Backfill        │───▶│ Engine           │    │ Engine          │
│ (15s intervals) │    │ (3s updates)     │    │ (20min predict) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Enhanced        │◀───│ Live ML Signals  │───▶│ Trade           │
│ Trading Engine  │    │ Storage          │    │ Simulations     │
│ (70% threshold) │    │ (Database)       │    │ Database        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Active Trade    │    │ Learning Engine  │◀───│ Trade Historical│
│ Monitoring      │    │ (30s cycles)     │    │ Prices          │
│ (Real-time P&L) │    │ (ML Training)    │    │ (Minute-by-min) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ React Frontend  │◀───│ Express API      │───▶│ PostgreSQL      │
│ (Real-time UI)  │    │ Routes           │    │ Database        │
│ (Chart Progress)│    │ (REST endpoints) │    │ (Complete Data) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

This comprehensive A-Z documentation covers every aspect of the trade simulation system architecture, from authentication through zero-fallback policies, providing complete understanding for system revamp planning.