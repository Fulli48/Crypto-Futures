import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  BarElement,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// ✅ Updated interface for unified data format (80 total: 60 historical + 20 forecast)
interface DataPoint {
  timestamp: number; // Unix timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 0 for forecast data points
}

interface BinanceChartProps {
  data: DataPoint[];
  tp?: number;
  sl?: number;
  currentPrice?: number;
}

// Register Chart.js components for line and bar charts
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function BinanceChart({ data, tp, sl, currentPrice }: BinanceChartProps) {
  const chartRef = useRef<ChartJS>(null);
  
  // ✅ Process unified line data (80 total: 60 historical + 20 forecast)
  const isValidData = data && Array.isArray(data) && data.length > 0;
  const historicalData = isValidData ? data.slice(0, 60) : [];
  const forecastData = isValidData ? data.slice(60, 80) : [];
  
  // Safety check - show loading if no valid data
  if (!isValidData) {
    return (
      <div className="h-[300px] sm:h-[400px] lg:h-[500px] flex items-center justify-center bg-[#1E2329] text-gray-400">
        Loading chart data...
      </div>
    );
  }

  console.log("Historical data points:", historicalData.length);
  console.log("Forecast data points:", forecastData.length);

  // Calculate tight price range for better viewport control
  const allPrices = [
    ...historicalData.flatMap(c => [c.open, c.high, c.low, c.close]),
    ...forecastData.flatMap(c => [c.open, c.high, c.low, c.close])
  ].filter(p => p > 0);

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const buffer = priceRange * 0.05; // 5% buffer

  const chartMin = minPrice - buffer;
  const chartMax = maxPrice + buffer;

  console.log(`[CHART DEBUG] Setting tight price range: ${chartMin.toFixed(2)} - ${chartMax.toFixed(2)} (range: ${priceRange.toFixed(2)})`);

  // ✅ Create TP/SL line data if provided
  const tpData = tp ? historicalData.concat(forecastData).map(candle => ({
    x: candle.timestamp,
    y: tp,
  })) : [];

  const slData = sl ? historicalData.concat(forecastData).map(candle => ({
    x: candle.timestamp,
    y: sl,
  })) : [];

  // ✅ Transform historical data to line chart format using close prices
  const historicalLineData = historicalData.map(candle => ({
    x: candle.timestamp,
    y: candle.close,
  }));

  // ✅ Transform forecast data to line chart format using close prices
  const forecastLineData = forecastData.map(candle => ({
    x: candle.timestamp,
    y: candle.close,
  }));

  // ✅ Transform volume data for bar chart
  const volumeData = historicalData.map(candle => ({
    x: candle.timestamp,
    y: candle.volume * 1000, // Scale volume for visibility
  }));

  const chartData = {
    datasets: [
      {
        label: 'Historical Price',
        type: 'line' as const,
        data: historicalLineData,
        borderColor: '#F7931A',    // Bitcoin orange color
        backgroundColor: 'rgba(247, 147, 26, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
        yAxisID: 'y',
        order: 1,
      },
      {
        label: 'Forecast Price',
        type: 'line' as const,
        data: forecastLineData,
        borderColor: '#3B82F6',    // Blue forecast line
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        borderDash: [8, 4],        // Dashed line for forecast
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
        yAxisID: 'y',
        order: 1,
      },
      {
        label: 'Volume',
        type: 'bar' as const,
        data: volumeData,
        backgroundColor: 'rgba(183, 189, 198, 0.2)',
        borderColor: 'rgba(183, 189, 198, 0.4)',
        borderWidth: 1,
        yAxisID: 'volume',
        order: 3, // Render behind price lines
      },
      ...(tp ? [{
        label: 'Take Profit',
        type: 'line' as const,
        data: tpData,
        borderColor: '#0ECB81',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        fill: false,
        yAxisID: 'y',
        order: 1,
      }] : []),
      ...(sl ? [{
        label: 'Stop Loss',
        type: 'line' as const,
        data: slData,
        borderColor: '#F6465D',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        fill: false,
        yAxisID: 'y',
        order: 1,
      }] : []),
    ],
  };

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#EAECEF',
          font: {
            family: "'Whitney', -apple-system, BlinkMacSystemFont, sans-serif",
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#2B3139',
        titleColor: '#EAECEF',
        bodyColor: '#EAECEF',
        borderColor: '#848E9C',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          displayFormats: {
            minute: 'HH:mm',
          },
        },
        grid: {
          color: '#2B3139',
        },
        ticks: {
          color: '#B7BDC6',
          font: {
            family: "'Whitney', -apple-system, BlinkMacSystemFont, sans-serif",
            size: window.innerWidth < 640 ? 9 : 11,
          },
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: chartMin,
        max: chartMax,
        grid: {
          color: '#2B3139',
        },
        ticks: {
          color: '#B7BDC6',
          font: {
            family: "'Whitney', -apple-system, BlinkMacSystemFont, sans-serif",
            size: window.innerWidth < 640 ? 9 : 11,
          },
          callback: function(value) {
            return typeof value === 'number' ? value.toFixed(2) : value;
          },
        },
      },
      volume: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#B7BDC6',
          font: {
            family: "'Whitney', -apple-system, BlinkMacSystemFont, sans-serif",
            size: window.innerWidth < 640 ? 8 : 9,
          },
          callback: function(value) {
            return typeof value === 'number' ? (value / 1000).toFixed(1) + 'K' : value;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  console.log(`[CHART DEBUG] Force applied tight range: ${chartMin.toFixed(2)} - ${chartMax.toFixed(2)}`);

  return (
    <div className="h-[300px] sm:h-[400px] lg:h-[500px] w-full bg-[#1E2329] p-2 sm:p-4">
      <Chart
        ref={chartRef}
        type="line"
        data={chartData}
        options={chartOptions}
      />
    </div>
  );
}