/**
 * Signal Quality Classification System for Dynamic Live ML Engine
 * Provides proper quality levels and badges for ML trading signals
 */

// Create internal learning mode detection to avoid circular imports
function isLearningModeSignal(signal: TradeSignalForClassification): boolean {
  return signal.confidence === 35 && signal.profitLikelihood === 25;
}

// Interface for dynamic live ML signals
interface SignalData {
  signal: string;
  confidence: number;
  profitLikelihood: number;
}

export interface QualityClassification {
  level: 'QUALITY' | 'MODERATE' | 'WEAK' | 'LEARNING';
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export interface TradeSignalForClassification {
  signal: string;
  confidence: number;
  profitLikelihood: number;
  successScorePrediction?: {
    predictedSuccessScore?: number;
    successProbability?: number;
  };
  marketConditions?: {
    marketScore?: number;
    entryScore?: number;
    riskRewardRatio?: number;
  };
}

/**
 * Classify signal quality based on confidence, profit likelihood, and learning mode
 */
export function classifySignalQuality(signal: TradeSignalForClassification): QualityClassification {
  // Check if this is a learning mode signal
  const isLearningMode = isLearningModeSignal(signal);
  
  if (isLearningMode) {
    return {
      level: 'LEARNING',
      label: 'LEARNING',
      color: 'text-blue-400',
      bgColor: 'bg-gradient-to-r from-blue-500/80 to-indigo-500/80',
      borderColor: 'border-blue-400/50',
      icon: '📚'
    };
  }

  const confidence = signal.confidence;
  const profitLikelihood = signal.profitLikelihood;

  // Quality tier classification based on confidence levels
  if (confidence >= 75 && profitLikelihood >= 60) {
    return {
      level: 'QUALITY',
      label: 'QUALITY',
      color: 'text-green-400',
      bgColor: 'bg-gradient-to-r from-emerald-500 to-green-500',
      borderColor: 'border-green-400/50',
      icon: '⭐'
    };
  } else if (confidence >= 60 && profitLikelihood >= 40) {
    return {
      level: 'MODERATE',
      label: 'MODERATE',
      color: 'text-yellow-400',
      bgColor: 'bg-gradient-to-r from-yellow-500/80 to-orange-500/80',
      borderColor: 'border-yellow-400/50',
      icon: '⚡'
    };
  } else if (confidence >= 45 && profitLikelihood >= 25) {
    return {
      level: 'WEAK',
      label: 'WEAK',
      color: 'text-orange-400',
      bgColor: 'bg-gradient-to-r from-orange-500/70 to-red-500/70',
      borderColor: 'border-orange-400/50',
      icon: '⚠️'
    };
  } else {
    // Very low confidence signals
    return {
      level: 'WEAK',
      label: 'POOR',
      color: 'text-red-400',
      bgColor: 'bg-gradient-to-r from-red-500/60 to-gray-500/60',
      borderColor: 'border-red-400/50',
      icon: '🔸'
    };
  }
}

/**
 * Get quality badge component props
 */
export function getQualityBadgeProps(signal: TradeSignalForClassification) {
  const quality = classifySignalQuality(signal);
  
  return {
    className: `${quality.bgColor} text-white text-xs px-2 py-0.5 border-0 shadow-lg`,
    children: `${quality.icon} ${quality.label}`
  };
}

/**
 * Check if system is in learning mode (for insufficient training indicator)
 */
export function isSystemInLearningMode(signals: Record<string, any>): boolean {
  // Check if majority of signals are learning mode signals
  const signalArray = Object.values(signals).filter(s => s && typeof s === 'object');
  if (signalArray.length === 0) return false;
  
  const learningSignals = signalArray.filter(signal => 
    signal.confidence <= 35 && signal.profitLikelihood <= 25
  );
  
  // If more than 50% of signals are low confidence/profit, we're in learning mode
  return learningSignals.length / signalArray.length > 0.5;
}

/**
 * Get learning mode status message
 */
export function getLearningModeMessage(isLearningMode: boolean): string {
  if (isLearningMode) {
    return "Insufficient Training - Collecting Learning Data";
  }
  return "ML Engine Trained - Quality Signals Active";
}

// Dynamic Live ML System classification functions
interface DynamicQualityClassification {
  level: 'QUALITY' | 'MODERATE' | 'WEAK' | 'LEARNING';
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  badge: string;
  isFiltered: boolean;
}

export function classifyDynamicSignalQuality(data: SignalData): DynamicQualityClassification {
  const { signal, confidence, profitLikelihood } = data;
  
  // If signal is WAIT, always classify as LEARNING
  if (signal === 'WAIT') {
    return {
      level: 'LEARNING',
      description: 'Waiting for clear directional signal',
      color: 'bg-gray-500',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      badge: 'WAITING',
      isFiltered: true
    };
  }
  
  // Classification based on confidence and profit likelihood
  if (confidence >= 75 && profitLikelihood >= 65) {
    return {
      level: 'QUALITY',
      description: 'High confidence with strong profit potential',
      color: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      badge: 'QUALITY',
      isFiltered: false
    };
  } else if (confidence >= 60 && profitLikelihood >= 50) {
    return {
      level: 'MODERATE',
      description: 'Good confidence with moderate profit potential',
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      badge: 'MODERATE',
      isFiltered: false
    };
  } else if (confidence >= 45 && profitLikelihood >= 35) {
    return {
      level: 'WEAK',
      description: 'Lower confidence requiring careful consideration',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
      badge: 'WEAK',
      isFiltered: true
    };
  } else {
    return {
      level: 'LEARNING',
      description: 'Low confidence signal for learning purposes',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      badge: 'LEARNING',
      isFiltered: true
    };
  }
}

// Check if signal meets quality thresholds for display
export function shouldDisplayDynamicSignal(data: SignalData, minConfidence: number = 50): boolean {
  const { signal, confidence } = data;
  
  // Never display WAIT signals
  if (signal === 'WAIT') {
    return false;
  }
  
  // Display if meets minimum confidence threshold
  return confidence >= minConfidence;
}

// Get filter reason for filtered signals
export function getDynamicFilterReason(data: SignalData, minConfidence: number = 50): string | null {
  const { signal, confidence, profitLikelihood } = data;
  
  if (signal === 'WAIT') {
    return 'Signal is WAIT - no directional bias detected';
  }
  
  if (confidence < minConfidence) {
    return `Confidence ${confidence}% below ${minConfidence}% threshold`;
  }
  
  return null;
}