import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Format price values for user-friendly display
function formatPredictedPrice(price: number, symbol: string): string {
  // For high-value currencies like BTC, format as abbreviated thousands
  if (symbol.includes('BTC') && price >= 10000) {
    return `${(price / 1000).toFixed(1)}k`;
  }
  
  // For ETH (typically $1000-$5000 range)
  if (symbol.includes('ETH') && price >= 1000) {
    return `${(price / 1000).toFixed(2)}k`;
  }
  
  // For SOL (typically $100-$300 range)
  if (symbol.includes('SOL') && price >= 100) {
    return `${price.toFixed(0)}`;
  }
  
  // For smaller value coins (XRP, ADA, HBAR - typically $0.xx range)
  if (price < 10) {
    return `${price.toFixed(3)}`;
  }
  
  // Default formatting for other cases
  return `${price.toFixed(2)}`;
}

interface ForecastedDataPoint {
  minute: number;
  predictedPrice: number;
  confidence: number;
  volume: number;
  timestamp: string;
}

interface ForecastedDataResponse {
  symbol: string;
  forecastedAmounts: ForecastedDataPoint[];
  timestamp: string;
  forecastId?: number;
}

interface ForecastedDataDisplayProps {
  symbol: string;
}

export function ForecastedDataDisplay({ symbol }: ForecastedDataDisplayProps) {
  const [displayData, setDisplayData] = useState<ForecastedDataPoint[]>([]);

  const { data: forecastData, isLoading } = useQuery<ForecastedDataResponse>({
    queryKey: ['/api/forecasted-data', symbol],
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!symbol
  });

  useEffect(() => {
    if (forecastData?.forecastedAmounts) {
      // Show next 5 minutes of forecasted data for compact display
      setDisplayData(forecastData.forecastedAmounts.slice(0, 5));
    }
  }, [forecastData]);

  if (isLoading || !displayData.length) {
    return (
      <div className="text-xs text-blue-400 opacity-70">
        Loading forecast...
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-blue-400 font-medium opacity-80">
        Forecasted Data (Next 5min):
      </div>
      <div className="grid grid-cols-5 gap-1 text-xs">
        {displayData.map((point) => (
          <div key={point.minute} className="text-blue-400 opacity-70">
            <div className="font-mono text-xs">
              ${formatPredictedPrice(point.predictedPrice, symbol)}
            </div>
            <div className="text-blue-300 opacity-60 text-xs">
              {(point.confidence > 1 ? point.confidence : point.confidence * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}