import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  TooltipItem,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { useQuery } from '@tanstack/react-query';

// ✅ Enhanced interface for forecast visualization
interface ForecastDataPoint {
  timestamp: string;
  price: number;
  confidence: number;
  minutesAhead: number;
}

interface ForecastData {
  id: number;
  symbol: string;
  forecastTimestamp: string;
  inputWindowStart: string;
  inputWindowEnd: string;
  predictionHorizon: number;
  volatility: number;
  validationStatus: string;
  validationReason: string;
  filteredOutliers: number;
  modelDetails: any;
  predictions: ForecastDataPoint[];
  createdAt: string;
}

interface HistoricalDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ForecastChartProps {
  symbol: string;
  historicalData: HistoricalDataPoint[];
  currentPrice?: number;
  tp?: number;
  sl?: number;
}

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ForecastChart({ symbol, historicalData, currentPrice, tp, sl }: ForecastChartProps) {
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);
  const [showValidationStatus, setShowValidationStatus] = useState(true);

  // Fetch latest ML forecast for the symbol
  const { data: forecastData, isLoading: forecastLoading } = useQuery<{ success: boolean; data: ForecastData }>({
    queryKey: ['/api/forecasts/latest', symbol],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch forecast accuracy data for audit
  const { data: accuracyData, isLoading: accuracyLoading } = useQuery<{ 
    success: boolean; 
    data: { 
      avgErrorPercent: number; 
      avgConfidence: number; 
      totalForecasts: number; 
      totalPredictions: number; 
    }
  }>({
    queryKey: ['/api/forecasts/accuracy', symbol],
    refetchInterval: 60000, // Refresh every minute
  });

  const isValidData = historicalData && Array.isArray(historicalData) && historicalData.length > 0;
  
  if (!isValidData) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-[#1E2329] text-gray-400">
        Loading chart data...
      </div>
    );
  }

  // Process historical data for chart display
  const historicalLineData = historicalData.map(candle => ({
    x: candle.timestamp,
    y: candle.close,
  }));

  // Process forecast data if available
  let forecastLineData: { x: number; y: number }[] = [];
  let confidenceBandData: { x: number; y: number; confidence: number }[] = [];
  
  if (forecastData?.success && forecastData.data.predictions.length > 0) {
    const forecast = forecastData.data;
    
    forecastLineData = forecast.predictions.map(pred => ({
      x: new Date(pred.timestamp).getTime(),
      y: pred.price,
    }));

    // Create confidence bands (higher confidence = more opaque)
    confidenceBandData = forecast.predictions.map(pred => ({
      x: new Date(pred.timestamp).getTime(),
      y: pred.price,
      confidence: pred.confidence,
    }));
  }

  // Calculate price range for better viewport control
  const allPrices = [
    ...historicalData.flatMap(c => [c.open, c.high, c.low, c.close]),
    ...forecastLineData.map(f => f.y)
  ].filter(p => p > 0);

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const buffer = priceRange * 0.05; // 5% buffer

  const chartMin = minPrice - buffer;
  const chartMax = maxPrice + buffer;

  // Create TP/SL line data if provided
  const timeRange = [...historicalLineData, ...forecastLineData];
  const tpData = tp ? timeRange.map(point => ({ x: point.x, y: tp })) : [];
  const slData = sl ? timeRange.map(point => ({ x: point.x, y: sl })) : [];

  // Chart configuration with forecast overlays
  const chartData = {
    datasets: [
      {
        label: 'Historical Price',
        type: 'line' as const,
        data: historicalLineData,
        borderColor: '#F7931A',    // Bitcoin orange
        backgroundColor: 'rgba(247, 147, 26, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
      },
      // ML Forecast Line (dotted)
      ...(forecastLineData.length > 0 ? [{
        label: `ML Forecast (${forecastData?.data.validationStatus || 'Unknown'})`,
        type: 'line' as const,
        data: forecastLineData,
        borderColor: forecastData?.data.validationStatus === 'VALID' ? '#00D4AA' : '#F23645', // Green for valid, red for filtered
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5], // Dotted line for predictions
        pointRadius: 2,
        pointBackgroundColor: '#00D4AA',
        fill: false,
        tension: 0.1,
      }] : []),
      // Confidence Bands (if enabled)
      ...(showConfidenceBands && confidenceBandData.length > 0 ? [{
        label: 'Confidence Band',
        type: 'line' as const,
        data: confidenceBandData.map(point => ({
          x: point.x,
          y: point.y + (point.y * 0.02 * (point.confidence / 100)), // Upper band based on confidence
        })),
        borderColor: 'rgba(0, 212, 170, 0.3)',
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        fill: '+1', // Fill to next dataset
        tension: 0.1,
      }, {
        label: '',
        type: 'line' as const,
        data: confidenceBandData.map(point => ({
          x: point.x,
          y: point.y - (point.y * 0.02 * (point.confidence / 100)), // Lower band based on confidence
        })),
        borderColor: 'rgba(0, 212, 170, 0.3)',
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0.1,
      }] : []),
      // Take Profit Line
      ...(tp ? [{
        label: `Take Profit ($${tp.toFixed(2)})`,
        type: 'line' as const,
        data: tpData,
        borderColor: '#00D4AA',
        backgroundColor: 'rgba(0, 212, 170, 0.1)',
        borderWidth: 1,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
      }] : []),
      // Stop Loss Line
      ...(sl ? [{
        label: `Stop Loss ($${sl.toFixed(2)})`,
        type: 'line' as const,
        data: slData,
        borderColor: '#F23645',
        backgroundColor: 'rgba(242, 54, 69, 0.1)',
        borderWidth: 1,
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
      }] : []),
      // Current Price Indicator
      ...(currentPrice ? [{
        label: `Current ($${currentPrice.toFixed(2)})`,
        type: 'line' as const,
        data: timeRange.map(point => ({ x: point.x, y: currentPrice })),
        borderColor: '#FFF',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      }] : []),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#FFFFFF',
          usePointStyle: true,
          pointStyle: 'line',
          filter: (legendItem) => legendItem.text !== '', // Hide empty labels
        },
      },
      title: {
        display: true,
        text: `${symbol} - Price Chart with ML Forecasts`,
        color: '#FFFFFF',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'nearest',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#FFFFFF',
        bodyColor: '#FFFFFF',
        borderColor: '#333',
        borderWidth: 1,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].parsed.x);
            return date.toLocaleString();
          },
          label: (context) => {
            const value = context.parsed.y;
            const label = context.dataset.label || '';
            
            // Add confidence information for forecast points
            if (label.includes('ML Forecast') && confidenceBandData.length > 0) {
              const timeIndex = context.dataIndex;
              const confidence = confidenceBandData[timeIndex]?.confidence;
              return `${label}: $${value.toFixed(6)} (${confidence?.toFixed(1)}% confidence)`;
            }
            
            return `${label}: $${value.toFixed(6)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#FFFFFF',
          maxTicksLimit: 10,
        },
      },
      y: {
        min: chartMin,
        max: chartMax,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: '#FFFFFF',
          callback: function(value) {
            return `$${Number(value).toFixed(6)}`;
          },
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      {/* Forecast Controls */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded p-3 border border-gray-700/50">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showConfidenceBands}
              onChange={(e) => setShowConfidenceBands(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
            />
            <span>Show Confidence Bands</span>
          </label>
          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showValidationStatus}
              onChange={(e) => setShowValidationStatus(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
            />
            <span>Show Validation Status</span>
          </label>
        </div>
        
        {/* Forecast Status */}
        {forecastData?.success && (
          <div className="flex items-center space-x-2 text-xs">
            <div className={`px-2 py-1 rounded text-white ${
              forecastData.data.validationStatus === 'VALID' ? 'bg-green-600' : 
              forecastData.data.validationStatus === 'FILTERED' ? 'bg-red-600' : 'bg-yellow-600'
            }`}>
              {forecastData.data.validationStatus}
            </div>
            <span className="text-gray-400">
              {forecastData.data.predictions.length} predictions
            </span>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="h-[500px] bg-[#1E2329] rounded border border-gray-700/50">
        <Chart type="line" data={chartData} options={options} />
      </div>

      {/* Forecast Information Panel */}
      {forecastData?.success && showValidationStatus && (
        <div className="bg-gray-800/50 rounded p-4 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-3">ML Forecast Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {forecastData.data.predictions.length}
              </div>
              <div className="text-sm text-gray-400">Prediction Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {(forecastData.data.volatility * 100).toFixed(2)}%
              </div>
              <div className="text-sm text-gray-400">Volatility</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {forecastData.data.filteredOutliers}
              </div>
              <div className="text-sm text-gray-400">Filtered Outliers</div>
            </div>
          </div>

          {forecastData.data.validationReason && (
            <div className="bg-gray-700/50 rounded p-3 mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Validation Reason</h4>
              <p className="text-sm text-gray-400">{forecastData.data.validationReason}</p>
            </div>
          )}

          {/* Accuracy Metrics */}
          {accuracyData?.success && (
            <div className="bg-gray-700/50 rounded p-3">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Model Performance (Last 7 Days)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-white font-medium">{accuracyData.data.avgErrorPercent.toFixed(2)}%</div>
                  <div className="text-gray-400">Avg Error</div>
                </div>
                <div>
                  <div className="text-white font-medium">{accuracyData.data.avgConfidence.toFixed(1)}%</div>
                  <div className="text-gray-400">Avg Confidence</div>
                </div>
                <div>
                  <div className="text-white font-medium">{accuracyData.data.totalForecasts}</div>
                  <div className="text-gray-400">Total Forecasts</div>
                </div>
                <div>
                  <div className="text-white font-medium">{accuracyData.data.totalPredictions}</div>
                  <div className="text-gray-400">Total Predictions</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading States */}
      {(forecastLoading || accuracyLoading) && (
        <div className="bg-gray-800/50 rounded p-3 border border-gray-700/50 text-center">
          <div className="text-sm text-gray-400">
            Loading ML forecast data...
          </div>
        </div>
      )}
    </div>
  );
}