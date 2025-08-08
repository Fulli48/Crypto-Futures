import { db } from './db';
import { eq, sql, desc, not, and, ne, isNotNull } from 'drizzle-orm';
import { tradeSimulations, learningWeights, learningAnalytics, systemMetrics, tradeChartData } from '../shared/schema';
import { validateTradeBeforeSave } from './trade-validation';
import { calculate_mfe_and_drawdown, createTradeHistoryPoint, formatMFEDrawdown } from './mfe-drawdown-calculator';
import { mlDiagnosticsService } from './ml-diagnostics-service';

// Define feature learning stats type with correlation patterns
type FeatureLearningStats = {
  rsi: { weight: number; used: number };
  macd: { weight: number; used: number };
  bollinger: { weight: number; used: number };
  stochastic: { weight: number; used: number };
  ema: { weight: number; used: number };
  support_resistance: { weight: number; used: number };
  market_structure: { weight: number; used: number };
  patterns: { weight: number; used: number };
  volatility: { weight: number; used: number };
  volume_profile: { weight: number; used: number };
};

// Define technical indicator correlation patterns
type IndicatorCorrelationPattern = {
  pattern: string;
  weight: number;
  successCount: number;
  totalCount: number;
  successRate: number;
  lastUsed: number;
};

// Symbol-specific correlation patterns for per-symbol learning
type SymbolCorrelationPatterns = {
  [symbol: string]: {
    [patternId: string]: IndicatorCorrelationPattern;
  };
};

// Initialize feature learning stats with default weights of 5.0 and usage count of 0
const feature_learning_stats: FeatureLearningStats = {
  rsi: { weight: 5.0, used: 0 },
  macd: { weight: 5.0, used: 0 },
  bollinger: { weight: 5.0, used: 0 },
  stochastic: { weight: 5.0, used: 0 },
  ema: { weight: 5.0, used: 0 },
  support_resistance: { weight: 5.0, used: 0 },
  market_structure: { weight: 5.0, used: 0 },
  patterns: { weight: 5.0, used: 0 },
  volatility: { weight: 5.0, used: 0 },
  volume_profile: { weight: 5.0, used: 0 }
};

// Initialize correlation pattern learning system
const symbol_correlation_patterns: SymbolCorrelationPatterns = {};

// Define common correlation patterns to learn
const CORRELATION_PATTERNS = {
  'rsi_overbought_macd_bullish': 'RSI > 70 + MACD > 0',
  'rsi_oversold_stoch_oversold': 'RSI < 30 + Stochastic < 20',
  'bollinger_squeeze_low_vol': 'Bollinger tight + Low volatility',
  'macd_crossover_rsi_divergence': 'MACD crossover + RSI divergence',
  'rsi_mid_macd_strong': 'RSI 40-60 + Strong MACD signal',
  'stoch_oversold_support': 'Stochastic < 20 + Near support',
  'volatility_spike_momentum': 'Volume spike + Momentum alignment',
  'bollinger_breakout_rsi': 'Bollinger breakout + RSI confirmation'
};

// Reduced per-symbol learning threshold from 5 to 3 trades
const PER_SYMBOL_LEARNING_THRESHOLD = 3;

// Increased learning rate multiplier from 1.2x to 1.5x
const LEARNING_RATE_MULTIPLIER = 1.5;

// Define threshold for trade scoring (minimum score to take a trade)
const TRADE_SCORE_THRESHOLD = 30;
const MIN_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Calculate a graded reward score from trade outcome data using REALISTIC trade outcome logic
 * 
 * UPDATED GRADED REWARD SYSTEM (Realistic Trade Outcomes):
 * - SUCCESS: TP_HIT = +1.0, PULLOUT_PROFIT = +1.0 (both considered full success)
 * - FAILURE: SL_HIT = -1.0, NO_PROFIT = -1.0 (both considered full failure)
 * - MFE bonus: +0.2 * (MFE / TP_TARGET) for capturing favorable price movements
 * - Drawdown penalty: -0.2 * (Drawdown / |SL_TARGET|) for risk management assessment
 * - Final reward range: approximately -1.4 to +1.4
 * 
 * This enables realistic learning where trades are rewarded based on actual profit opportunities
 * rather than arbitrary time expiration, focusing on meaningful pullout opportunities.
 */
function calculate_trade_reward(
  trade: any, 
  tpTarget: number, 
  slTarget: number
): number {
  let reward = 0;
  
  // Base reward based on REALISTIC outcome classification
  if (trade.actual_outcome === 'TP_HIT' || trade.actual_outcome === 'PULLOUT_PROFIT') {
    reward = 1.0; // Full positive reward for both TP hits and profitable pullout opportunities
  } else if (trade.actual_outcome === 'SL_HIT' || trade.actual_outcome === 'NO_PROFIT') {
    reward = -1.0; // Full negative reward for both SL hits and no meaningful profit opportunities
  } else if (trade.actual_outcome === 'EXPIRED') {
    // Legacy fallback for any remaining EXPIRED trades - analyze profit performance
    const profitLoss = parseFloat(trade.profit_loss?.toString() || '0');
    const tpDistance = Math.abs(tpTarget - parseFloat(trade.entry_price?.toString() || '0'));
    
    if (tpDistance > 0) {
      // Scale profit/loss relative to TP target distance, cap at +/-0.5
      reward = Math.max(-0.5, Math.min(0.5, (profitLoss / tpDistance) * 0.5));
    }
  }
  
  // Add MFE (Maximum Favorable Excursion) bonus - rewards capturing good moves
  const mfe = parseFloat(trade.max_favorable_excursion?.toString() || '0');
  const tpDistance = Math.abs(tpTarget - parseFloat(trade.entry_price?.toString() || '0'));
  if (tpDistance > 0 && mfe > 0) {
    const mfeRatio = mfe / tpDistance;
    reward += 0.2 * mfeRatio; // Up to +0.2 bonus for strong favorable moves
  }
  
  // Add drawdown penalty - penalizes poor risk management
  const drawdown = Math.abs(parseFloat(trade.max_drawdown?.toString() || '0'));
  const slDistance = Math.abs(slTarget - parseFloat(trade.entry_price?.toString() || '0'));
  if (slDistance > 0 && drawdown > 0) {
    const drawdownRatio = drawdown / slDistance;
    reward -= 0.2 * drawdownRatio; // Up to -0.2 penalty for deep drawdowns
  }
  
  // Ensure reasonable bounds
  reward = Math.max(-1.4, Math.min(1.4, reward));
  
  return Math.round(reward * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Update feature weights based on trade outcome and reward
 */
function update_feature_weights(trade: any, reward: number): void {
  if (!trade.features) return;
  
  for (const [feature, used] of Object.entries(trade.features)) {
    if (used && feature in feature_learning_stats) {
      const featureKey = feature as keyof FeatureLearningStats;
      const stats = feature_learning_stats[featureKey];
      stats.used += 1;
      const decay = Math.max(0.01, 1 / Math.pow(stats.used, 0.5));
      // Apply increased learning rate multiplier (1.5x instead of 1.2x)
      const adjustment = reward * decay * LEARNING_RATE_MULTIPLIER;
      stats.weight += adjustment;
      stats.weight = Math.max(0.1, Math.min(stats.weight, 10.0));
      
      console.log(`🧠 [FEATURE LEARNING] Updated ${feature}: weight=${stats.weight.toFixed(4)}, used=${stats.used}, reward=${reward}, adjustment=${adjustment.toFixed(4)} (rate: ${LEARNING_RATE_MULTIPLIER}x)`);
    }
  }
}

/**
 * Detect and learn correlation patterns from trade data
 */
function detect_correlation_patterns(trade: any): string[] {
  const detectedPatterns: string[] = [];
  
  if (!trade.indicator_values) return detectedPatterns;
  
  const indicators = trade.indicator_values;
  const rsi = parseFloat(indicators.rsi || '50');
  const macd = parseFloat(indicators.macd || '0');
  const stochK = parseFloat(indicators.stochasticK || '50');
  const volatility = parseFloat(indicators.volatility || '0');
  
  // Pattern detection logic
  if (rsi > 70 && macd > 0) {
    detectedPatterns.push('rsi_overbought_macd_bullish');
  }
  
  if (rsi < 30 && stochK < 20) {
    detectedPatterns.push('rsi_oversold_stoch_oversold');
  }
  
  if (rsi >= 40 && rsi <= 60 && Math.abs(macd) > 0.5) {
    detectedPatterns.push('rsi_mid_macd_strong');
  }
  
  if (stochK < 20) {
    detectedPatterns.push('stoch_oversold_support');
  }
  
  if (volatility > 0.01) {
    detectedPatterns.push('volatility_spike_momentum');
  }
  
  // Add more pattern detection as needed
  
  return detectedPatterns;
}

/**
 * Update correlation pattern weights based on trade outcome
 */
function update_correlation_patterns(symbol: string, patterns: string[], reward: number): void {
  if (!symbol_correlation_patterns[symbol]) {
    symbol_correlation_patterns[symbol] = {};
  }
  
  for (const patternId of patterns) {
    if (!symbol_correlation_patterns[symbol][patternId]) {
      symbol_correlation_patterns[symbol][patternId] = {
        pattern: CORRELATION_PATTERNS[patternId] || patternId,
        weight: 1.0,
        successCount: 0,
        totalCount: 0,
        successRate: 0.5,
        lastUsed: Date.now()
      };
    }
    
    const pattern = symbol_correlation_patterns[symbol][patternId];
    pattern.totalCount += 1;
    pattern.lastUsed = Date.now();
    
    if (reward > 0) {
      pattern.successCount += 1;
    }
    
    pattern.successRate = pattern.successCount / pattern.totalCount;
    
    // Apply enhanced learning rate to correlation patterns
    const adjustment = reward * 0.1 * LEARNING_RATE_MULTIPLIER;
    pattern.weight += adjustment;
    pattern.weight = Math.max(0.1, Math.min(pattern.weight, 5.0));
    
    console.log(`🔗 [CORRELATION LEARNING] ${symbol} pattern "${patternId}": weight=${pattern.weight.toFixed(3)}, success_rate=${(pattern.successRate * 100).toFixed(1)}%, total=${pattern.totalCount}`);
  }
}

/**
 * Master learning function to process completed trades using graded reward system
 * NOW WITH MOVEMENT-BASED FILTERING: Only learns from trades with sufficient price movement
 */
function process_trade_learning(trade: any): void {
  // MOVEMENT-BASED FILTER: Check if trade should be excluded from learning
  const actualMovement = parseFloat(trade.actual_movement_percent?.toString() || '0');
  const excludedFromLearning = trade.excluded_from_learning === true;
  const MOVEMENT_THRESHOLD = 0.1; // 0.1% threshold
  
  if (excludedFromLearning || actualMovement < MOVEMENT_THRESHOLD) {
    console.log(`🚫 [MOVEMENT FILTER] Trade ${trade.id} excluded from learning: movement=${actualMovement.toFixed(4)}% < ${MOVEMENT_THRESHOLD}% threshold`);
    return; // Skip learning for low-movement trades
  }
  
  // Ensure features exist or initialize with default values
  trade.features = trade.features || {
    "rsi": 0, "macd": 0, "bollinger": 0, "stochastic": 0, "ema": 0,
    "support_resistance": 0, "market_structure": 0, "patterns": 0,
    "volatility": 0, "volume_profile": 0
  };
  
  // Extract trade parameters for graded reward calculation
  const entryPrice = parseFloat(trade.entry_price?.toString() || '0');
  const takeProfit = parseFloat(trade.take_profit?.toString() || '0');
  const stopLoss = parseFloat(trade.stop_loss?.toString() || '0');
  
  // Calculate graded reward using risk-adjusted performance metrics
  const reward = calculate_trade_reward(trade, takeProfit, stopLoss);
  
  // Update feature weights based on the graded reward
  update_feature_weights(trade, reward);
  
  // Detect and learn correlation patterns
  const detectedPatterns = detect_correlation_patterns(trade);
  if (detectedPatterns.length > 0) {
    update_correlation_patterns(trade.symbol, detectedPatterns, reward);
  }
  
  // Add reward to trade data for tracking
  trade.reward = reward;
  
  console.log(`🎯 [MOVEMENT LEARNING] Trade ${trade.id}: movement=${actualMovement.toFixed(4)}%, reward=${reward} (outcome: ${trade.actual_outcome}, profit: ${trade.profit_loss}, mfe: ${trade.max_favorable_excursion}, dd: ${trade.max_drawdown}), patterns: ${detectedPatterns.join(', ')}`);
}

/**
 * Calculate trade score based on feature weights and correlation patterns
 */
function calculate_trade_score(signal_set: Record<string, number>, symbol?: string, indicators?: any): number {
  let score = 0;
  
  // Base feature scoring
  for (const [feature, value] of Object.entries(signal_set)) {
    if (feature in feature_learning_stats) {
      const featureKey = feature as keyof FeatureLearningStats;
      const weight = feature_learning_stats[featureKey].weight;
      score += value * weight;
    }
  }
  
  // Add correlation pattern bonuses if available
  if (symbol && indicators && symbol_correlation_patterns[symbol]) {
    const patterns = detect_correlation_patterns({ symbol, indicator_values: indicators });
    for (const patternId of patterns) {
      if (symbol_correlation_patterns[symbol][patternId]) {
        const pattern = symbol_correlation_patterns[symbol][patternId];
        const bonus = pattern.weight * pattern.successRate * 2; // 2x multiplier for proven patterns
        score += bonus;
        console.log(`🔗 [PATTERN BONUS] ${symbol} "${patternId}": +${bonus.toFixed(2)} (weight: ${pattern.weight.toFixed(2)}, success: ${(pattern.successRate * 100).toFixed(1)}%)`);
      }
    }
  }
  
  return Math.round(score * 10000) / 10000; // Round to 4 decimal places
}

/**
 * Check if a trade should be taken based on score and confidence thresholds
 */
function should_take_trade(signal_set: Record<string, number>, confidence: number, symbol?: string, indicators?: any): boolean {
  const score = calculate_trade_score(signal_set, symbol, indicators);
  const meetsScoreThreshold = score >= TRADE_SCORE_THRESHOLD;
  const meetsConfidenceThreshold = confidence >= MIN_CONFIDENCE_THRESHOLD;
  
  console.log(`📊 [TRADE EVALUATION] ${symbol || 'Unknown'}: Score: ${score}, Confidence: ${confidence}, Score≥${TRADE_SCORE_THRESHOLD}: ${meetsScoreThreshold}, Conf≥${MIN_CONFIDENCE_THRESHOLD}: ${meetsConfidenceThreshold}`);
  
  return meetsScoreThreshold && meetsConfidenceThreshold;
}

/**
 * Get current feature learning statistics
 */
function get_feature_learning_stats(): FeatureLearningStats {
  return { ...feature_learning_stats };
}

/**
 * Get correlation pattern statistics for a symbol
 */
function get_symbol_correlation_patterns(symbol: string): any {
  return symbol_correlation_patterns[symbol] || {};
}

/**
 * Get all correlation pattern statistics
 */
function get_all_correlation_patterns(): SymbolCorrelationPatterns {
  return { ...symbol_correlation_patterns };
}

/**
 * Self-improving ML Learning Engine
 */
export class SelfImprovingMLEngine {
  private realPriceAPI: any;
  private lastSimulationAttempt: number = Date.now() - 35000;

  constructor() {
    this.initializeAPIs();
    console.log('🚀 [SELF-IMPROVING ML] Engine initialized with feature learning system');
  }

  private async initializeAPIs() {
    try {
      const { realPriceAPI } = await import('./real-price-api');
      this.realPriceAPI = realPriceAPI;
    } catch (error) {
      console.error('Error initializing APIs:', error);
    }
  }

  /**
   * Get current feature weights for compatibility with existing system
   */
  async getLearningWeights() {
    try {
      // Convert feature learning stats to legacy format for UI compatibility
      return {
        rsi: feature_learning_stats.rsi.weight,
        macd: feature_learning_stats.macd.weight,
        rsi_fast: feature_learning_stats.rsi.weight, // Map to RSI for compatibility
        stochastic: feature_learning_stats.stochastic.weight,
        ema_alignment: feature_learning_stats.ema.weight,
        bollinger_bands: feature_learning_stats.bollinger.weight,
        support_resistance: feature_learning_stats.support_resistance.weight,
        market_structure: feature_learning_stats.market_structure.weight,
        patterns: feature_learning_stats.patterns.weight,
        volatility: feature_learning_stats.volatility.weight
      };
    } catch (error) {
      console.error('Error getting learning weights:', error);
      return {};
    }
  }

  /**
   * Process completed trades and apply learning
   */
  async analyzeAndDeleteCompletedTrades() {
    try {
      const completedTrades = await db.select()
        .from(tradeSimulations)
        .where(
          and(
            not(eq(tradeSimulations.actualOutcome, 'IN_PROGRESS')),
            isNotNull(tradeSimulations.completedAt)
          )
        )
        .orderBy(desc(tradeSimulations.completedAt));

      console.log(`🔍 [LEARNING] Found ${completedTrades.length} completed trades for analysis`);

      for (const trade of completedTrades) {
        // Prepare trade data for learning INCLUDING movement data
        const tradeData = {
          id: trade.id,
          symbol: trade.symbol,
          pnl: parseFloat(trade.profitLoss || '0'),
          mfe: parseFloat(trade.maxFavorableExcursion || '0'),
          drawdown: parseFloat(trade.maxDrawdown || '0'),
          reached_tp: trade.actualOutcome === 'TP_HIT',
          confidence: parseFloat(trade.confidence?.toString() || '0') / 100,
          features: this.extractFeaturesFromTrade(trade),
          // MOVEMENT FILTER DATA
          actual_movement_percent: trade.actualMovementPercent,
          excluded_from_learning: trade.excludedFromLearning,
          actual_outcome: trade.actualOutcome,
          profit_loss: trade.profitLoss,
          max_favorable_excursion: trade.maxFavorableExcursion,
          max_drawdown: trade.maxDrawdown,
          entry_price: trade.entryPrice,
          take_profit: trade.tpPrice,
          stop_loss: trade.slPrice
        };

        // Apply self-improving learning WITH MOVEMENT FILTERING
        process_trade_learning(tradeData);

        // Update the trade in database with new learning data
        await this.updateTradeWithLearningData(trade.id, tradeData);
      }

      // Delete processed trades to prevent reprocessing
      if (completedTrades.length > 0) {
        const tradeIds = completedTrades.map(t => t.id);
        await db.delete(tradeSimulations).where(
          sql`id IN (${sql.join(tradeIds, sql`, `)})`
        );
        console.log(`🗑️ [CLEANUP] Deleted ${completedTrades.length} processed trades`);
      }

      return completedTrades.length;
    } catch (error) {
      console.error('Error in analyzeAndDeleteCompletedTrades:', error);
      return 0;
    }
  }

  /**
   * Extract features from trade for learning
   */
  private extractFeaturesFromTrade(trade: any): Record<string, number> {
    // Extract features based on indicators used in the trade
    // This is a simplified extraction - in practice, you'd want to capture
    // which specific features contributed to the trade signal
    return {
      rsi: trade.indicatorValues?.rsi ? 1 : 0,
      macd: trade.indicatorValues?.macd ? 1 : 0,
      bollinger: 1, // Assume always used for now
      stochastic: 1, // Assume always used for now
      ema: 1, // Assume always used for now
      support_resistance: 1,
      market_structure: 1,
      patterns: 1,
      volatility: 1,
      volume_profile: 1
    };
  }

  /**
   * Update trade in database with learning data
   */
  private async updateTradeWithLearningData(tradeId: number, tradeData: any) {
    try {
      // In a real implementation, you might want to store learning data
      // in a separate table or extend the trade schema
      console.log(`💾 [LEARNING DATA] Trade ${tradeId} processed with reward ${tradeData.reward}`);
    } catch (error) {
      console.error(`Error updating trade ${tradeId} with learning data:`, error);
    }
  }

  /**
   * Generate trade signals using self-improving ML logic
   */
  async generateTradeSignal(symbol: string, marketData: any): Promise<any> {
    try {
      // Extract signal features from market data
      const signalFeatures = this.extractSignalFeatures(marketData);
      
      // Calculate confidence score (simplified)
      const confidence = this.calculateConfidence(signalFeatures);
      
      // Check if trade should be taken
      const shouldTake = should_take_trade(signalFeatures, confidence, symbol, marketData?.indicators);
      
      if (!shouldTake) {
        console.log(`❌ [SIGNAL] ${symbol} rejected - score/confidence below threshold`);
        return {
          signal: 'WAIT',
          confidence: Math.round(confidence * 100),
          profitLikelihood: 50,
          reason: 'Below score or confidence threshold'
        };
      }

      // Generate directional signal based on features
      const signal = this.generateDirectionalSignal(signalFeatures);
      const score = calculate_trade_score(signalFeatures, symbol, marketData?.indicators);

      console.log(`✅ [SIGNAL] ${symbol} ${signal} - Score: ${score}, Confidence: ${Math.round(confidence * 100)}%`);

      return {
        signal,
        confidence: Math.round(confidence * 100),
        profitLikelihood: Math.min(95, Math.max(60, score * 2)), // Convert score to likelihood
        score,
        features: signalFeatures
      };
    } catch (error) {
      console.error(`Error generating signal for ${symbol}:`, error);
      return {
        signal: 'WAIT',
        confidence: 50,
        profitLikelihood: 50,
        reason: 'Error in signal generation'
      };
    }
  }

  /**
   * Extract signal features from market data
   */
  private extractSignalFeatures(marketData: any): Record<string, number> {
    // This is a simplified feature extraction
    // In practice, you'd compute actual technical indicators
    return {
      rsi: Math.random() * 100, // Replace with actual RSI calculation
      macd: Math.random() * 2 - 1, // Replace with actual MACD calculation
      bollinger: Math.random(),
      stochastic: Math.random() * 100,
      ema: Math.random(),
      support_resistance: Math.random(),
      market_structure: Math.random(),
      patterns: Math.random(),
      volatility: Math.random(),
      volume_profile: Math.random()
    };
  }

  /**
   * Calculate confidence based on signal features
   */
  private calculateConfidence(features: Record<string, number>): number {
    // Simple confidence calculation based on feature alignment
    let confidence = 0.5; // Base confidence
    
    // Add confidence based on strong feature signals
    Object.entries(features).forEach(([feature, value]) => {
      if (feature in feature_learning_stats) {
        const featureKey = feature as keyof FeatureLearningStats;
        const weight = feature_learning_stats[featureKey].weight;
        const normalizedValue = Math.abs(value) / 100; // Normalize to 0-1
        confidence += (normalizedValue * weight) / 1000; // Scale influence
      }
    });

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  /**
   * Generate directional signal based on features
   */
  private generateDirectionalSignal(features: Record<string, number>): 'LONG' | 'SHORT' {
    // Simple directional logic - sum weighted features
    let longScore = 0;
    let shortScore = 0;

    Object.entries(features).forEach(([feature, value]) => {
      if (feature in feature_learning_stats) {
        const featureKey = feature as keyof FeatureLearningStats;
        const weight = feature_learning_stats[featureKey].weight;
        if (value > 50) { // Bullish signal
          longScore += weight;
        } else { // Bearish signal
          shortScore += weight;
        }
      }
    });

    return longScore > shortScore ? 'LONG' : 'SHORT';
  }

  /**
   * Get learning metrics for UI display
   */
  async getLearningMetrics() {
    const stats = get_feature_learning_stats();
    const totalUsage = Object.values(stats).reduce((sum, stat) => sum + stat.used, 0);
    const avgWeight = Object.values(stats).reduce((sum, stat) => sum + stat.weight, 0) / Object.keys(stats).length;

    return {
      totalTrades: totalUsage,
      avgWeight: Math.round(avgWeight * 100) / 100,
      featureStats: stats,
      threshold: TRADE_SCORE_THRESHOLD,
      minConfidence: MIN_CONFIDENCE_THRESHOLD
    };
  }

  /**
   * Get success rate for UI compatibility
   */
  async getDecayBasedSuccessRate() {
    try {
      const completedTrades = await db.select()
        .from(tradeSimulations)
        .where(not(eq(tradeSimulations.actualOutcome, 'IN_PROGRESS')))
        .orderBy(desc(tradeSimulations.completedAt))
        .limit(50);

      if (completedTrades.length === 0) return { successRate: 0, improvement: 0 };

      const successfulTrades = completedTrades.filter(trade => 
        trade.actualOutcome === 'TP_HIT' || 
        trade.actualOutcome === 'PULLOUT_PROFIT' ||
        (trade.actualOutcome === 'EXPIRED' && parseFloat(trade.profitLoss || '0') > 0) // Legacy fallback
      );

      const successRate = (successfulTrades.length / completedTrades.length) * 100;
      return { successRate, improvement: 0 };
    } catch (error) {
      console.error('Error calculating success rate:', error);
      return { successRate: 0, improvement: 0 };
    }
  }

  /**
   * Log current feature learning statistics
   */
  logFeatureStats() {
    console.log('📊 [FEATURE STATS] Current learning statistics:');
    Object.entries(feature_learning_stats).forEach(([feature, stats]) => {
      console.log(`  ${feature}: weight=${stats.weight.toFixed(4)}, used=${stats.used}`);
    });
  }
}

// Export the learning functions for external use
export {
  calculate_trade_reward,
  update_feature_weights,
  process_trade_learning,
  calculate_trade_score,
  should_take_trade,
  get_feature_learning_stats,
  get_symbol_correlation_patterns,
  get_all_correlation_patterns,
  TRADE_SCORE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD
};