import React from 'react';

interface IdealEntryBadgeProps {
  percentIdeal: number;
  className?: string;
  showLabel?: boolean;
}

export function IdealEntryBadge({ 
  percentIdeal, 
  className = '', 
  showLabel = true 
}: IdealEntryBadgeProps) {
  // Color coding based on percentage
  const getTextColorClass = (percent: number): string => {
    if (percent >= 90) return 'text-green-700 dark:text-green-400';
    if (percent >= 70) return 'text-yellow-700 dark:text-yellow-400';
    if (percent >= 50) return 'text-orange-700 dark:text-orange-400';
    return 'text-red-700 dark:text-red-400';
  };

  const getBgColorClass = (percent: number): string => {
    if (percent >= 90) return 'bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700';
    if (percent >= 70) return 'bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700';
    if (percent >= 50) return 'bg-orange-100 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
    return 'bg-red-100 dark:bg-red-900 border-red-200 dark:border-red-700';
  };

  const textColorClass = getTextColorClass(percentIdeal);
  const bgColorClass = getBgColorClass(percentIdeal);
  
  const getQualityText = (percent: number): string => {
    if (percent >= 90) return 'EXCELLENT';
    if (percent >= 70) return 'GOOD';
    if (percent >= 50) return 'SUBOPTIMAL';
    return 'POOR';
  };

  const formatPercent = (percent: number): string => {
    return `${Math.round(percent)}%`;
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <div className={`px-2 py-1 rounded-md border text-xs font-medium ${bgColorClass} ${textColorClass}`}>
        {showLabel && "% Ideal Entry: "}
        {formatPercent(percentIdeal)}
      </div>
      <span className={`text-xs ${textColorClass}`}>
        {getQualityText(percentIdeal)}
      </span>
    </div>
  );
}

interface IdealEntryProgressBarProps {
  percentIdeal: number;
  className?: string;
}

export function IdealEntryProgressBar({ 
  percentIdeal, 
  className = '' 
}: IdealEntryProgressBarProps) {
  const getBarColor = (percent: number): string => {
    if (percent >= 90) return 'bg-green-500';
    if (percent >= 70) return 'bg-yellow-500';
    if (percent >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getBarColor(percentIdeal)}`}
          style={{ width: `${Math.min(100, Math.max(0, percentIdeal))}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-300 min-w-[3rem] text-right">
        {Math.round(percentIdeal)}%
      </span>
    </div>
  );
}