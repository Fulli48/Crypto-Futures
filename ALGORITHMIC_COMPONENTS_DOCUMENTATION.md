# ALGORITHMIC COMPONENTS AND COMPONENT-TO-COMPONENT CONNECTIONS

This document provides detailed algorithmic explanations and component interaction patterns for your cryptocurrency trading system revamp planning.

## I. CORE ALGORITHMIC COMPONENTS

### A. ML TRADE SIGNAL ENGINE ALGORITHM (ml-trade-signal-engine.ts)

**Primary Algorithm: Multi-Factor ML Signal Generation**

```pseudocode
ALGORITHM: generateTradeSignalWithTPSL(symbol)
INPUT: symbol (string)
OUTPUT: MLTradeSignal with confidence, profitLikelihood, prices

1. Initialize feature weights from database:
   - volatility: 7.875, volume_profile: 7.875
   - rsi: 7.5, macd: 7.5, bollinger_bands: 7.671331
   - stochastic: 7.5, ema_alignment: 7.875
   - support_resistance: 7.875, market_structure: 7.875

2. Fetch last 60 minutes chart data for symbol

3. Calculate technical indicators:
   - RSI(14) with overbought/oversold levels
   - MACD(12,26,9) with signal crossovers
   - Bollinger Bands(20) position analysis
   - Stochastic oscillator momentum
   - EMA alignment scoring

4. Generate base signal using weighted ensemble:
   confidence = Σ(indicator_value × weight) / Σ(weights)
   
5. Apply performance-based multipliers:
   - EMA smoothing: 0.15 alpha factor
   - Signal-specific multipliers for LONG/SHORT
   - Volatility adjustment based on price history

6. Calculate optimal TP/SL prices:
   TP_distance = entry_price × (confidence / 100) × risk_multiplier
   SL_distance = entry_price × (1 - confidence / 100) × risk_multiplier
   
7. Apply signal stabilization:
   - Track 10-minute signal history
   - Minimum 12% confidence change to flip signal
   - Maximum 6% confidence change per update

8. Return MLTradeSignal with all components
```

**Component Connections:**
- **Input**: Chart data from RollingChartService
- **Input**: Feature weights from LearningEngine  
- **Output**: Signals to DynamicLiveMLEngine
- **Output**: Price calculations to TradeCreation routes

### B. SUCCESS SCORE CALCULATOR ALGORITHM (success-score-calculator.ts)

**Primary Algorithm: 4-Component Weighted Success Scoring**

```pseudocode
ALGORITHM: calculateSuccessScore(metrics)
INPUT: {finalNetProfitPct, timeInProfitRatio, maxFavorableExcursion, maxDrawdown}
OUTPUT: {successScore, isSuccessful, breakdown}

1. Handle priority outcomes:
   IF actualOutcome == 'TP_HIT': RETURN 100.0
   IF actualOutcome == 'SL_HIT': RETURN 0.0

2. Calculate weighted components:
   profitComponent = 0.25 × tanh(finalNetProfitPct)
   
3. Enhanced profitable time calculation:
   baseTimeComponent = 0.5 × timeInProfitRatio
   
   IF timeInProfitRatio > 0.5:
     profitAdvantage = timeInProfitRatio - 0.5
     exponentialMultiplier = exp(profitAdvantage × 3)
     timeComponent = 0.5 × timeInProfitRatio × exponentialMultiplier
     timeComponent = min(timeComponent, 2.5)  // Cap extreme values
   
   IF timeInProfitRatio >= 0.9:
     consistencyBonus = 0.3 × timeInProfitRatio
     timeComponent += consistencyBonus
     timeComponent = min(timeComponent, 3.0)

4. Calculate additional components:
   favorableComponent = 0.15 × tanh(maxFavorableExcursion)
   drawdownPenalty = 0.1 × abs(tanh(maxDrawdown))

5. Final weighted score:
   successScore = profitComponent + timeComponent + favorableComponent - drawdownPenalty

6. Success determination:
   isSuccessful = successScore >= threshold (default: 0.0)
```

**Component Connections:**
- **Input**: Trade completion data from LearningEngine
- **Input**: MFE/Drawdown from chart data analysis
- **Output**: Success scores to ML weight optimization
- **Output**: Performance metrics to UI display

### C. ML FORECAST ENGINE ALGORITHM (ml-forecast-engine.ts)

**Primary Algorithm: 20-Minute Price Prediction**

```pseudocode
ALGORITHM: generate20MinuteForecast(symbol)
INPUT: symbol (string)
OUTPUT: ForecastedPrice array with confidence scores

1. Fetch last 60 minutes OHLCV data:
   chartData = getLast60MinutesData(symbol)
   REQUIRE: chartData.length >= 20 (minimum data requirement)

2. Calculate price momentum and trend:
   priceChanges = []
   FOR i = 1 to chartData.length:
     change = (chartData[i].close - chartData[i-1].close) / chartData[i-1].close
     priceChanges.append(change)
   
   avgMomentum = mean(priceChanges[-10:])  // Last 10 minutes
   trendStrength = std(priceChanges) × volatility_factor

3. Generate 20 future price points:
   basePrice = chartData[-1].close
   FOR minute = 1 to 20:
     // Apply momentum with decay
     momentum_decay = exp(-minute × 0.1)
     price_drift = avgMomentum × momentum_decay
     
     // Add realistic volatility
     volatility = calculateVolatility(chartData[-20:])
     noise = random_normal(0, volatility)
     
     predictedPrice = basePrice × (1 + price_drift + noise)
     confidence = calculateConfidence(trendStrength, volatility, minute)
     
     forecastPoints.append({
       timestamp: now + minute_minutes,
       predictedPrice: predictedPrice,
       confidence: confidence,
       volatility: volatility
     })

4. Calculate forecast quality metrics:
   directionalConsistency = count(same_direction_changes) / 20
   movementMagnitude = abs(finalPrice - basePrice) / basePrice
   confidenceScore = baseConfidence × directionalConsistency

5. Return forecast with quality metrics
```

**Component Connections:**
- **Input**: Rolling chart data from RollingChartService
- **Output**: 20-minute forecasts to DynamicLiveMLEngine
- **Output**: Price predictions to trade signal generation
- **Output**: Confidence scores to ML signal enhancement

### D. ROLLING CHART SERVICE ALGORITHM (rolling-chart-service.ts)

**Primary Algorithm: 60-Minute Sliding Window Data Management**

```pseudocode
ALGORITHM: addMinuteData(symbol, ohlcvData)
INPUT: symbol, {open, high, low, close, volume, timestamp}
OUTPUT: StoredChartData with technical indicators

1. Data validation and normalization:
   timestamp = roundToMinute(timestamp)
   REQUIRE: all_prices > 0 AND volume >= 0
   
2. Check for existing data:
   existing = database.query(symbol, timestamp)
   IF existing.exists: RETURN existing_data

3. Calculate technical indicators:
   // Fetch last 20 points for moving averages
   historical = getLastNPoints(symbol, 20)
   
   rsi = calculateRSI(historical + [close], period=14)
   macd = calculateMACD(historical + [close], 12, 26, 9)
   bb = calculateBollingerBands(historical + [close], 20, 2)
   stoch = calculateStochastic(historical + [ohlcv], 14)
   
   sma20 = mean(last_20_closes)
   ema12 = calculateEMA(closes, 12)
   ema26 = calculateEMA(closes, 26)

4. Store data with indicators:
   chartData = {
     symbol, timestamp, open, high, low, close, volume,
     rsi, macd, bollinger_upper, bollinger_lower,
     sma20, ema12, ema26, stochastic, isComplete: true
   }
   database.insert(rollingChartData, chartData)

5. Cleanup old data (sliding window):
   cutoffTime = now - 60_minutes
   database.delete(WHERE timestamp < cutoffTime AND symbol = symbol)

6. Update completeness tracking:
   totalPoints = database.count(symbol, last_60_minutes)
   completeness = totalPoints / 60 * 100%
```

**Component Connections:**
- **Input**: Real-time OHLCV from RealPriceAPI
- **Output**: Technical indicators to MLTradeSignalEngine
- **Output**: Chart data to MLForecastEngine
- **Output**: Completeness metrics to UI display
- **Storage**: Persistent data in PostgreSQL rollingChartData table

## II. COMPONENT-TO-COMPONENT DATA FLOW PATTERNS

### A. REAL-TIME SIGNAL GENERATION CHAIN

```
1. RealPriceAPI.getRealPrice(symbol)
   ↓ [OHLCV data every 3 seconds]
   
2. RollingChartService.addMinuteData()
   ↓ [Chart data + technical indicators]
   
3. MLTradeSignalEngine.generateTradeSignalWithTPSL()
   ↓ [ML signal + confidence + TP/SL prices]
   
4. DynamicLiveMLEngine.updateSymbolData()
   ↓ [Enhanced signal with forecast]
   
5. EnhancedTradingEngine.shouldCreateTrade()
   ↓ [Quality-filtered trade decision]
   
6. Routes.createMLTrade()
   ↓ [Trade simulation creation]
   
7. Database.tradeSimulations.insert()
```

### B. TRADE COMPLETION AND LEARNING CHAIN

```
1. Routes.getActiveTrades() [Every 1 second]
   ↓ [Real-time P&L calculation]
   
2. LearningEngine.analyzeAndDeleteCompletedTrades() [Every 30s]
   ↓ [Trade completion detection]
   
3. SuccessScoreCalculator.calculateSuccessScore()
   ↓ [4-component weighted scoring]
   
4. MLTradeSignalEngine.trainModel()
   ↓ [Feature weight optimization]
   
5. Database.learningWeights.update()
   ↓ [Persistent learning state]
   
6. Next signal generation uses updated weights
```

### C. FORECAST-DRIVEN TRADE CREATION CHAIN

```
1. MLForecastEngine.generate20MinuteForecast()
   ↓ [20-minute price predictions]
   
2. MLForecastEngine.generateOptimalTradeSignal()
   ↓ [LONG/SHORT decision based on predicted movement]
   
3. DynamicLiveMLEngine.storeMLSignal()
   ↓ [Signal persistence with forecast data]
   
4. Routes.ml-engine/signal/{symbol}
   ↓ [API endpoint serving forecast-based signals]
   
5. UI fetches and displays signals
   ↓ [Real-time signal updates every 60 seconds]
```

## III. CRITICAL ALGORITHMIC BOTTLENECKS AND OPTIMIZATIONS

### A. Signal Stabilization Algorithm

**Problem**: Dramatic confidence swings from micro price movements
**Solution**: Multi-layer stabilization system

```pseudocode
ALGORITHM: stabilizeSignal(newSignal, symbol)
1. Fetch signal history (last 10 minutes)
2. Calculate EMA smoothed confidence (15% new, 85% previous)
3. Apply maximum change cap (6% per update)
4. Check minimum change threshold (12% to flip signal type)
5. Store stabilized signal in history buffer
```

### B. Adaptive Threshold System

**Problem**: Fixed thresholds don't adapt to market conditions
**Solution**: Rolling statistical threshold calculation

```pseudocode
ALGORITHM: calculateAdaptiveThresholds()
1. Maintain rolling buffer of last 100 predictions
2. Calculate mean and standard deviation of confidence/profitLikelihood
3. Set adaptive thresholds:
   minConfidence = mean - (0.5 × std)
   minProfitLikelihood = mean - (0.5 × std)
4. Update thresholds every 50 predictions
```

### C. Learning Mode Failsafe

**Problem**: Undertrained ML engines block trade creation
**Solution**: Automatic learning mode with relaxed thresholds

```pseudocode
ALGORITHM: checkLearningMode()
IF completedTradeCount < 5:
  RETURN learning_mode_signal(35% confidence, 25% profitLikelihood)
ELIF recent_confidence_variance < threshold:
  RETURN enhanced_signal_with_learning_bonus()
ELSE:
  RETURN normal_ml_signal()
```

## IV. DATABASE INTERACTION ALGORITHMS

### A. Trade Chart Data Second-by-Second Tracking

```sql
-- Real-time trade performance tracking
INSERT INTO trade_chart_data (
  trade_id, seconds_since_entry, current_price, 
  profit_percent, profit_time, loss_time
) VALUES (?, ?, ?, ?, 
  CASE WHEN profit_percent > 0 THEN profit_time + 1 ELSE profit_time END,
  CASE WHEN profit_percent <= 0 THEN loss_time + 1 ELSE loss_time END
);
```

### B. ML Weight Optimization Database Pattern

```sql
-- Feature weight persistence and retrieval
UPDATE learning_weights 
SET weight_value = weight_value * performance_multiplier
WHERE feature_name = ? AND symbol = ?;

-- Batch weight retrieval for signal generation
SELECT feature_name, weight_value 
FROM learning_weights 
WHERE symbol = ? OR symbol = 'GLOBAL'
ORDER BY last_updated DESC;
```

### C. Rolling Chart Data Cleanup Algorithm

```sql
-- Sliding window maintenance (runs every 10 minutes)
DELETE FROM rolling_chart_data 
WHERE timestamp < NOW() - INTERVAL '65 minutes'
  AND symbol = ?;
  
-- Data completeness calculation
SELECT COUNT(*) as minutes_stored
FROM rolling_chart_data 
WHERE symbol = ? 
  AND timestamp >= NOW() - INTERVAL '60 minutes';
```

## V. PERFORMANCE METRICS AND QUALITY GATES

### A. Chart Data Completeness Calculation

```pseudocode
ALGORITHM: calculateDataCompleteness(symbol)
1. Query last 60 minutes of chart data
2. Count actual data points stored
3. Calculate percentage: (stored_minutes / 60) × 100%
4. Apply quality gates:
   - < 20 minutes: "BUILDING" status
   - >= 20 minutes: Enable ML signal generation
   - >= 60 minutes: "COMPLETE" status with full forecasting
```

### B. ML Signal Quality Classification

```pseudocode
ALGORITHM: classifySignalQuality(signal)
IF confidence >= 75% AND profitLikelihood >= 40%:
  RETURN "PREMIUM"
ELIF confidence >= 60% AND profitLikelihood >= 30%:
  RETURN "HIGH" 
ELIF confidence >= 50% AND profitLikelihood >= 25%:
  RETURN "MEDIUM"
ELIF confidence >= 35% AND profitLikelihood >= 20%:
  RETURN "LOW"
ELSE:
  RETURN "FILTERED"
```

This algorithmic documentation provides the deep technical understanding needed for your system revamp planning, showing exactly how each component processes data and connects to other components through specific data structures and API patterns.