/**
 * Weighted Success Score Calculator
 * 
 * Replaces the old dual-criteria success/failure system with a sophisticated weighted scoring approach
 * that provides nuanced performance evaluation based on multiple trade metrics.
 * 
 * SUCCESS SCORE RANGES:
 * - Full calculation (with time data): approximately -0.5 to +0.9
 * - Profit-only calculation (missing time data): approximately -0.25 to +0.25
 * - SL_HIT trades: always 0.0
 * 
 * Current trades mostly use profit-only scoring due to missing time-in-profit data.
 */

export interface SuccessScoreMetrics {
  finalNetProfitPct: number;      // Final realized profit/loss as decimal (e.g., 0.05 for +5%)
  timeInProfitRatio: number;      // Percent of trade duration spent in profit (0-1)
  maxFavorableExcursion: number;  // Highest unrealized profit as decimal
  maxDrawdown: number;            // Largest unrealized loss as decimal (positive value)
}

export interface SuccessScoreResult {
  successScore: number;
  isSuccessful: boolean;
  threshold: number;
  breakdown: {
    profitComponent: number;
    timeComponent: number;
    favorableComponent: number;
    drawdownPenalty: number;
  };
}

// SIMPLIFIED SUCCESS DEFINITION: Any profitable trade is successful
export const DEFAULT_SUCCESS_THRESHOLD = 0.0; // Set to 0 so any positive profit qualifies

/**
 * Calculate weighted success score using the ENHANCED PROFITABLE TIME formula:
 * 
 * EXPONENTIAL PROFITABLE TIME WEIGHTING:
 * - Base profitable time weight: 40%
 * - When profitable time > loss time: EXPONENTIAL bonus scaling
 * - Exponential multiplier = exp((profitable_ratio - 0.5) * 4) for ratios > 0.5
 * 
 * success_score = (
 *     0.3 * tanh(final_net_profit_pct) +
 *     ENHANCED_TIME_COMPONENT +
 *     0.15 * tanh(max_favorable_excursion_pct) -
 *     0.15 * abs(tanh(max_drawdown_pct))
 * )
 */
export function calculateSuccessScore(
  metrics: SuccessScoreMetrics,
  threshold: number = DEFAULT_SUCCESS_THRESHOLD,
  actualOutcome?: string
): SuccessScoreResult {
  
  // PRIORITY SCORING: TP_HIT and SL_HIT trades get automatic scores
  if (actualOutcome === 'TP_HIT') {
    return {
      successScore: 100.0, // 100% success score for TP_HIT
      isSuccessful: true,
      threshold,
      breakdown: {
        profitComponent: 100.0,
        timeComponent: 0,
        favorableComponent: 0,
        drawdownPenalty: 0
      }
    };
  }
  
  if (actualOutcome === 'SL_HIT') {
    return {
      successScore: 0.0,  // 0% success score for SL_HIT
      isSuccessful: false,
      threshold,
      breakdown: {
        profitComponent: 0.0,
        timeComponent: 0,
        favorableComponent: 0,
        drawdownPenalty: 0
      }
    };
  }
  
  // EXPIRED trades continue with weighted calculation
  // Calculate standard components with reduced profit weight
  const profitComponent = 0.25 * Math.tanh(metrics.finalNetProfitPct);
  
  // ENHANCED PROFITABLE TIME CALCULATION with exponential scaling
  let timeComponent = 0.5 * metrics.timeInProfitRatio; // Increased base weight to 50%
  
  // EXPONENTIAL BONUS when profitable time > 50% (more profitable than loss time)
  if (metrics.timeInProfitRatio > 0.5) {
    const profitAdvantage = metrics.timeInProfitRatio - 0.5; // How much above 50%
    const exponentialMultiplier = Math.exp(profitAdvantage * 3); // Reduced exponential factor for stability
    timeComponent = 0.5 * metrics.timeInProfitRatio * exponentialMultiplier;
    
    // Cap the maximum component to prevent extreme values
    timeComponent = Math.min(timeComponent, 2.5);
  }
  
  // SPECIAL BONUS for trades with very high profitable time (≥90%) to reward consistency
  if (metrics.timeInProfitRatio >= 0.9) {
    const consistencyBonus = 0.3 * metrics.timeInProfitRatio; // Additional 30% bonus for 90%+ profitable time
    timeComponent += consistencyBonus;
    timeComponent = Math.min(timeComponent, 3.0); // Higher cap for consistency bonus
  }
  
  const favorableComponent = 0.15 * Math.tanh(metrics.maxFavorableExcursion);
  const drawdownPenalty = 0.1 * Math.abs(Math.tanh(metrics.maxDrawdown)); // Reduced penalty weight
  
  // Calculate final weighted success score
  const successScore = profitComponent + timeComponent + favorableComponent - drawdownPenalty;
  
  // Determine if trade is successful based on threshold
  const isSuccessful = successScore >= threshold;
  
  // Log enhanced scoring when applied
  if (metrics.timeInProfitRatio > 0.5) {
    const profitAdvantage = metrics.timeInProfitRatio - 0.5;
    const exponentialMultiplier = Math.exp(profitAdvantage * 3);
    console.log(`🚀 EXPONENTIAL TIME BONUS: ${(metrics.timeInProfitRatio * 100).toFixed(1)}% profitable time (${profitAdvantage.toFixed(3)} advantage) × ${exponentialMultiplier.toFixed(2)} multiplier = ${timeComponent.toFixed(4)} component`);
  }
  
  if (metrics.timeInProfitRatio >= 0.9) {
    console.log(`⭐ CONSISTENCY BONUS: ${(metrics.timeInProfitRatio * 100).toFixed(1)}% profitable time earned consistency reward - final time component: ${timeComponent.toFixed(4)}`);
  }
  
  // CRITICAL FIX: Convert to percentage format for storage and display
  const successScoreAsPercentage = successScore * 100; // Convert 0.0175 → 1.75
  const thresholdAsPercentage = threshold * 100; // Convert 0.005 → 0.5
  
  return {
    successScore: Number(successScoreAsPercentage.toFixed(4)),
    isSuccessful,
    threshold: Number(thresholdAsPercentage.toFixed(4)),
    breakdown: {
      profitComponent: Number((profitComponent * 100).toFixed(4)),
      timeComponent: Number((timeComponent * 100).toFixed(4)),
      favorableComponent: Number((favorableComponent * 100).toFixed(4)),
      drawdownPenalty: Number((drawdownPenalty * 100).toFixed(4))
    }
  };
}

/**
 * Convert trade simulation data to success score metrics
 */
export function extractSuccessMetrics(trade: any): SuccessScoreMetrics {
  // Convert values to decimals - profit_loss is stored as percentage, others as decimals
  const finalNetProfitPct = parseFloat(trade.profitLoss || '0') / 100; // Convert percentage to decimal
  const timeInProfitRatio = parseFloat(trade.profitablePercentage || '0') / 100; // Convert percentage to decimal
  const maxFavorableExcursion = Math.abs(parseFloat(trade.highestProfit || '0')); // Already decimal, don't divide
  const maxDrawdown = Math.abs(parseFloat(trade.lowestLoss || '0')); // Already decimal, don't divide
  
  return {
    finalNetProfitPct,
    timeInProfitRatio,
    maxFavorableExcursion,
    maxDrawdown
  };
}

/**
 * Calculate success score for a completed trade and return database update values
 * 
 * ENHANCED TP/SL-AWARE SCORING SYSTEM:
 * 1. SL_HIT trades: Always receive 0.0 success score regardless of other data
 * 2. TP_HIT trades with missing data: Use profit-based scoring (PROFIT_WEIGHT × tanh(percent_profit_decimal))
 * 3. All other trades: Use full weighted calculation if data is complete, otherwise profit-based
 */
export function calculateTradeSuccessScore(trade: any, threshold: number = DEFAULT_SUCCESS_THRESHOLD) {
  
  // RULE 1: STOP LOSS HIT - Always 0% success score
  if (trade.actualOutcome === 'SL_HIT' || trade.outcome === 'SL_HIT') {
    console.log(`🛑 SL_HIT SCORING: ${trade.symbol} - Stop loss hit, assigning 0% success score`);
    return {
      successScore: 0.0, // 0% success score
      successScoreThreshold: threshold * 100, // Convert threshold to percentage format
      isSuccessful: false,
      timeInProfitRatio: 0,
      maxFavorableExcursion: '0',
      maxDrawdown: '0',
      calculationMethod: 'SL_HIT_zero_score',
      breakdown: {
        profitComponent: 0,
        timeComponent: 0,
        favorableComponent: 0,
        drawdownPenalty: 0
      }
    };
  }
  
  // RULE 2: TAKE PROFIT HIT - Always 100% success score
  const isTPHit = (trade.actualOutcome === 'TP_HIT' || trade.outcome === 'TP_HIT');
  
  if (isTPHit) {
    console.log(`🎯 TP_HIT SCORING: ${trade.symbol} - Take profit hit, assigning 100% success score`);
    return {
      successScore: 100.0, // 100% success score for TP_HIT
      successScoreThreshold: threshold * 100, // Convert threshold to percentage format
      isSuccessful: true,
      timeInProfitRatio: 1.0, // Perfect profitable time for TP_HIT
      maxFavorableExcursion: Math.abs(parseFloat(trade.highestProfit || '0')).toString(),
      maxDrawdown: Math.abs(parseFloat(trade.lowestLoss || '0')).toString(),
      calculationMethod: 'TP_HIT_perfect_score',
      breakdown: {
        profitComponent: 100.0,
        timeComponent: 0,
        favorableComponent: 0,
        drawdownPenalty: 0
      }
    };
  }
  
  // RULE 3: EXPIRED trades with missing data - Use profit-based scoring
  const hasMissingData = checkForMissingData(trade);
  
  if (hasMissingData) {
    console.log(`🎯 PROFIT-BASED SCORING: ${trade.symbol} - Missing data detected, using profit-only calculation`);
    return calculateProfitBasedSuccessScore(trade, threshold);
  }
  
  // RULE 4: Complete data - Use full weighted scoring
  const metrics = extractSuccessMetrics(trade);
  const result = calculateSuccessScore(metrics, threshold, trade.actualOutcome || trade.outcome);
  
  return {
    successScore: result.successScore, // Already converted to percentage in calculateSuccessScore
    successScoreThreshold: result.threshold, // Already converted to percentage in calculateSuccessScore
    isSuccessful: result.isSuccessful,
    timeInProfitRatio: metrics.timeInProfitRatio,
    maxFavorableExcursion: metrics.maxFavorableExcursion.toString(),
    maxDrawdown: metrics.maxDrawdown.toString(),
    calculationMethod: 'full_weighted_scoring',
    breakdown: result.breakdown // Already converted to percentage in calculateSuccessScore
  };
}

/**
 * Check if trade has missing or incomplete data required for full success score calculation
 * 
 * This function detects early TP-hit trades that lack sufficient ancillary metrics
 * for the complete weighted success score calculation.
 */
function checkForMissingData(trade: any): boolean {
  // Check for missing or zero values in key metrics
  const timeInProfitRatio = parseFloat(trade.profitablePercentage || '0') / 100;
  const maxFavorableExcursion = Math.abs(parseFloat(trade.highestProfit || '0'));
  const maxDrawdown = Math.abs(parseFloat(trade.lowestLoss || '0'));
  const totalDuration = parseFloat(trade.totalMinutes || '0') + (parseFloat(trade.totalSeconds || '0') / 60);
  
  // Consider data missing if:
  // 1. Time in profit data is zero or unavailable
  // 2. Duration tracking is zero or unavailable  
  // 3. Profit/loss extremes are both zero (indicating no tracking)
  const missingTimeData = timeInProfitRatio === 0 || totalDuration === 0;
  const missingExtremeData = maxFavorableExcursion === 0 && maxDrawdown === 0;
  const missingProfitableData = !trade.profitableSeconds || parseFloat(trade.profitableSeconds) === 0;
  
  const hasMissingData = missingTimeData || missingExtremeData || missingProfitableData;
  
  if (hasMissingData) {
    console.log(`🔍 MISSING DATA DETECTED: ${trade.symbol} - Time: ${missingTimeData}, Extremes: ${missingExtremeData}, Profitable: ${missingProfitableData}`);
  }
  
  return hasMissingData;
}

/**
 * Calculate profit-based success score for early TP-hit trades with missing ancillary data
 * 
 * For trades that hit take profit but lack complete time/drawdown data, this function
 * calculates success score based solely on the realized profit percentage using:
 * successScore = ENHANCED_PROFIT_WEIGHT × tanh(percent_profit_decimal)
 * 
 * Uses enhanced weighting to match the exponential time scaling philosophy.
 */
function calculateProfitBasedSuccessScore(trade: any, threshold: number = DEFAULT_SUCCESS_THRESHOLD) {
  // Extract profit percentage from trade data
  const profitLoss = parseFloat(trade.profitLoss || '0');
  const percentProfitDecimal = profitLoss / 100; // Convert percentage to decimal
  
  // Calculate profit-based success score using enhanced profit weight (70% for consistency with new system)
  const ENHANCED_PROFIT_WEIGHT = 0.7; // Increased from 0.5 to match new profitable time emphasis
  const successScore = ENHANCED_PROFIT_WEIGHT * Math.tanh(percentProfitDecimal);
  
  // Determine if successful based on threshold
  const isSuccessful = successScore >= threshold;
  
  // CRITICAL FIX: Convert to percentage format for storage and display
  const successScoreAsPercentage = successScore * 100; // Convert 0.0175 → 1.75
  const thresholdAsPercentage = threshold * 100; // Convert 0.005 → 0.5
  
  console.log(`📊 ENHANCED PROFIT-BASED CALCULATION: ${trade.symbol} - Profit: ${profitLoss}%, Enhanced Weight: ${ENHANCED_PROFIT_WEIGHT}, Score: ${successScoreAsPercentage.toFixed(4)}% (was ${successScore.toFixed(4)} decimal), Successful: ${isSuccessful}`);
  
  return {
    successScore: Number(successScoreAsPercentage.toFixed(4)),
    successScoreThreshold: Number(thresholdAsPercentage.toFixed(4)),
    isSuccessful,
    timeInProfitRatio: 0, // Not available for missing data trades
    maxFavorableExcursion: '0', // Not available for missing data trades  
    maxDrawdown: '0', // Not available for missing data trades
    calculationMethod: 'enhanced_profit_based_scoring',
    breakdown: {
      profitComponent: Number((ENHANCED_PROFIT_WEIGHT * Math.tanh(percentProfitDecimal) * 100).toFixed(4)),
      timeComponent: 0, // Not calculated for missing data trades
      favorableComponent: 0, // Not calculated for missing data trades
      drawdownPenalty: 0 // Not calculated for missing data trades
    }
  };
}

/**
 * Legacy compatibility: Check if trade would be successful under old dual-criteria system
 * (For comparison and migration purposes only)
 */
export function isLegacySuccessful(trade: any): boolean {
  const profitLoss = parseFloat(trade.profitLoss || '0');
  const profitablePercentage = parseFloat(trade.profitablePercentage || '0');
  
  return profitLoss > 0 && profitablePercentage >= 51;
}