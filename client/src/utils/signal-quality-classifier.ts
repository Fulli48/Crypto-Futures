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
  successScorePrediction?: { predictedSuccessScore?: number; successProbability?: number };
  marketConditions?: { marketScore?: number; entryScore?: number; riskRewardRatio?: number };
}

// internal helper (named export not required)
function isLearningModeSignal(signal: TradeSignalForClassification): boolean {
  return signal.confidence === 35 && signal.profitLikelihood === 25;
}

// REQUIRED named export:
export function classifySignalQuality(signal: TradeSignalForClassification): QualityClassification {
  if (isLearningModeSignal(signal)) {
    return {
      level: 'LEARNING',
      label: 'LEARNING',
      color: 'text-blue-400',
      bgColor: 'bg-gradient-to-r from-blue-500/80 to-indigo-500/80',
      borderColor: 'border-blue-400/50',
      icon: '📚'
    };
  }

  const { confidence, profitLikelihood } = signal;

  if (confidence >= 75 && profitLikelihood >= 60) {
    return {
      level: 'QUALITY', label: 'QUALITY',
      color: 'text-green-400',
      bgColor: 'bg-gradient-to-r from-emerald-500 to-green-500',
      borderColor: 'border-green-400/50',
      icon: '⭐'
    };
  } else if (confidence >= 60 && profitLikelihood >= 40) {
    return {
      level: 'MODERATE', label: 'MODERATE',
      color: 'text-yellow-400',
      bgColor: 'bg-gradient-to-r from-yellow-500/80 to-orange-500/80',
      borderColor: 'border-yellow-400/50',
      icon: '⚡'
    };
  } else if (confidence >= 45 && profitLikelihood >= 25) {
    return {
      level: 'WEAK', label: 'WEAK',
      color: 'text-orange-400',
      bgColor: 'bg-gradient-to-r from-orange-500/70 to-red-500/70',
      borderColor: 'border-orange-400/50',
      icon: '⚠️'
    };
  } else {
    return {
      level: 'WEAK', label: 'POOR',
      color: 'text-red-400',
      bgColor: 'bg-gradient-to-r from-red-500/60 to-gray-500/60',
      borderColor: 'border-red-400/50',
      icon: '🔸'
    };
  }
}

// optional helper used by UI
export function getQualityBadgeProps(signal: TradeSignalForClassification) {
  const q = classifySignalQuality(signal);
  return { className: `${q.bgColor} text-white text-xs px-2 py-0.5 border-0 shadow-lg`, children: `${q.icon} ${q.label}` };
}
