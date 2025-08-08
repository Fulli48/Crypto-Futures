/**
 * Enhanced Trade Filter - UI Filtering Logic matching Enhanced Trading Engine
 * 
 * This ensures displayed trade suggestions use the same filtering criteria
 * that determines actual trade creation in the enhanced trading engine.
 */

export interface EnhancedFilterCriteria {
  // UI Display Constants - Lower thresholds for showing signals to user
  MINIMUM_CONFIDENCE: number;  // Lower threshold for display - show signals even below trade creation threshold
  MINIMUM_SUCCESS_SCORE_PREDICTION: number;  
  MINIMUM_SUCCESS_PROBABILITY: number;      
  MINIMUM_MARKET_SCORE: number;               
  MINIMUM_ENTRY_SCORE: number;                
  MINIMUM_RR_RATIO: number;                  
}

// Relaxed criteria for learning mode when ML engine is undertrained
export interface LearningFilterCriteria {
  MINIMUM_CONFIDENCE: 25;  // Very relaxed for learning data collection
  MINIMUM_PROFIT_LIKELIHOOD: 20;  // Basic threshold for learning trades
}

export interface TradeSignalForFiltering {
  signal: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  profitLikelihood: number;
  marketConditions?: {
    marketScore?: number;
    entryScore?: number;
    riskRewardRatio?: number;
  };
  successScorePrediction?: {
    predictedSuccessScore?: number;
    successProbability?: number;
  };
}

const FILTER_CRITERIA: EnhancedFilterCriteria = {
  MINIMUM_CONFIDENCE: 35,  // Lower threshold for UI display - show signals below trade creation threshold
  MINIMUM_SUCCESS_SCORE_PREDICTION: 5.0,  
  MINIMUM_SUCCESS_PROBABILITY: 30.0,      
  MINIMUM_MARKET_SCORE: 35,               
  MINIMUM_ENTRY_SCORE: 45,                
  MINIMUM_RR_RATIO: 1.2                   
};

const LEARNING_CRITERIA: LearningFilterCriteria = {
  MINIMUM_CONFIDENCE: 25,
  MINIMUM_PROFIT_LIKELIHOOD: 20
};

/**
 * Detect if this is a weak WAIT signal that should not be simulated (ML engine filtered signal)
 */
export function isWeakWaitSignal(signal: TradeSignalForFiltering): boolean {
  return signal.signal === 'WAIT' && (signal.confidence <= 35 || signal.profitLikelihood <= 25);
}

/**
 * Detect if this is a learning mode signal (undertrained ML engine)
 * Learning signals have low confidence (35%) and low profit likelihood (25%)
 */
export function isLearningModeSignal(signal: TradeSignalForFiltering): boolean {
  return signal.confidence === 35 && signal.profitLikelihood === 25;
}

/**
 * Apply enhanced trading engine filtering logic to determine if trade suggestion should be displayed
 * This matches the shouldCreateTradeWithSuccessScore() logic from enhanced-trading-engine.ts
 * Uses relaxed thresholds for learning mode signals when ML engine is undertrained
 */
export function shouldDisplayTradeSignal(signal: TradeSignalForFiltering): boolean {
  // Must have directional signal (not WAIT)
  if (signal.signal === 'WAIT') {
    console.log(`🚫 [UI FILTER] Filtered out WAIT signal`);
    return false;
  }
  
  // Detect learning mode and use appropriate thresholds
  const isLearningMode = isLearningModeSignal(signal);
  const minConfidence = isLearningMode ? LEARNING_CRITERIA.MINIMUM_CONFIDENCE : FILTER_CRITERIA.MINIMUM_CONFIDENCE;
  const minProfitLikelihood = isLearningMode ? LEARNING_CRITERIA.MINIMUM_PROFIT_LIKELIHOOD : 0; // No profit likelihood filter for normal mode
  
  if (isLearningMode) {
    console.log(`📚 [UI FILTER] Learning mode detected - using relaxed thresholds (${minConfidence}% confidence)`);
  }
  
  // Must meet minimum confidence threshold (normal or learning mode)
  if (signal.confidence < minConfidence) {
    console.log(`🚫 [UI FILTER] Confidence ${signal.confidence}% < ${minConfidence}% threshold`);
    return false;
  }
  
  // For learning mode, also check profit likelihood threshold
  if (isLearningMode && signal.profitLikelihood < minProfitLikelihood) {
    console.log(`🚫 [UI FILTER] Learning mode: Profit likelihood ${signal.profitLikelihood}% < ${minProfitLikelihood}% threshold`);
    return false;
  }
  
  // Check success score prediction if available
  if (signal.successScorePrediction) {
    if (signal.successScorePrediction.predictedSuccessScore !== undefined && 
        signal.successScorePrediction.predictedSuccessScore < FILTER_CRITERIA.MINIMUM_SUCCESS_SCORE_PREDICTION) {
      console.log(`🚫 [UI FILTER] Predicted success score ${signal.successScorePrediction.predictedSuccessScore}% < ${FILTER_CRITERIA.MINIMUM_SUCCESS_SCORE_PREDICTION}% threshold`);
      return false;
    }
    
    if (signal.successScorePrediction.successProbability !== undefined && 
        signal.successScorePrediction.successProbability < FILTER_CRITERIA.MINIMUM_SUCCESS_PROBABILITY) {
      console.log(`🚫 [UI FILTER] Success probability ${signal.successScorePrediction.successProbability}% < ${FILTER_CRITERIA.MINIMUM_SUCCESS_PROBABILITY}% threshold`);
      return false;
    }
  }
  
  // Check market conditions if available
  if (signal.marketConditions) {
    if (signal.marketConditions.marketScore !== undefined && 
        signal.marketConditions.marketScore < FILTER_CRITERIA.MINIMUM_MARKET_SCORE) {
      console.log(`🚫 [UI FILTER] Market score ${signal.marketConditions.marketScore}% < ${FILTER_CRITERIA.MINIMUM_MARKET_SCORE}% threshold`);
      return false;
    }
    
    if (signal.marketConditions.entryScore !== undefined && 
        signal.marketConditions.entryScore < FILTER_CRITERIA.MINIMUM_ENTRY_SCORE) {
      console.log(`🚫 [UI FILTER] Entry score ${signal.marketConditions.entryScore}% < ${FILTER_CRITERIA.MINIMUM_ENTRY_SCORE}% threshold`);
      return false;
    }
    
    if (signal.marketConditions.riskRewardRatio !== undefined && 
        signal.marketConditions.riskRewardRatio < FILTER_CRITERIA.MINIMUM_RR_RATIO) {
      console.log(`🚫 [UI FILTER] Risk/Reward ratio ${signal.marketConditions.riskRewardRatio} < ${FILTER_CRITERIA.MINIMUM_RR_RATIO} threshold`);
      return false;  
    }
  }
  
  const mode = isLearningModeSignal(signal) ? 'LEARNING MODE' : 'NORMAL MODE';
  console.log(`✅ [UI FILTER] ${mode} signal approved for display: ${signal.signal} (${signal.confidence}% confidence)`);
  return true;
}

/**
 * Check if signal meets high-confidence criteria for detailed display
 * Uses the same logic as enhanced trading engine's shouldCreateTradeWithSuccessScore()
 */
export function isHighQualitySignal(signal: TradeSignalForFiltering): boolean {
  return shouldDisplayTradeSignal(signal);
}

/**
 * Get appropriate waiting message based on why signal was filtered
 */
export function getWaitingMessage(symbol: string, signal: TradeSignalForFiltering): string {
  const coinName = symbol.replace('USDT', '');
  
  if (signal.signal === 'WAIT') {
    return `${coinName} market conditions unclear - waiting for directional signal`;
  }
  
  if (signal.confidence < FILTER_CRITERIA.MINIMUM_CONFIDENCE) {
    return `${coinName} confidence too low (${signal.confidence}% < 60% required)`;
  }
  
  if (signal.marketConditions?.marketScore && signal.marketConditions.marketScore < FILTER_CRITERIA.MINIMUM_MARKET_SCORE) {
    return `${coinName} poor market conditions (${signal.marketConditions.marketScore.toFixed(1)}% score)`;
  }
  
  if (signal.marketConditions?.entryScore && signal.marketConditions.entryScore < FILTER_CRITERIA.MINIMUM_ENTRY_SCORE) {
    return `${coinName} suboptimal entry timing (${signal.marketConditions.entryScore}% score)`;
  }
  
  return `${coinName} analyzing market conditions for quality setup`;
}

/**
 * Get market status summary for overall conditions
 */
export function getMarketStatusMessage(signals: Record<string, any>): string {
  const signalValues = Object.values(signals);
  const avgConfidence = signalValues.reduce((sum: number, s: any) => sum + (s.confidence || 0), 0) / signalValues.length;
  const waitSignals = signalValues.filter((s: any) => s.signal === 'WAIT').length;
  const lowConfidenceSignals = signalValues.filter((s: any) => s.confidence < 60).length;
  
  if (waitSignals > signalValues.length * 0.6) {
    return `Market conditions unclear - ${waitSignals}/${signalValues.length} symbols generating WAIT signals`;
  }
  
  if (lowConfidenceSignals === signalValues.length) {
    return `Low confidence market environment - average ${avgConfidence.toFixed(0)}% (60% required)`;
  }
  
  if (lowConfidenceSignals > signalValues.length * 0.7) {
    return `Mostly weak signals - ${lowConfidenceSignals}/${signalValues.length} below 60% confidence threshold`;
  }
  
  return `Mixed market conditions - ${signalValues.length - lowConfidenceSignals} quality signals available`;
}