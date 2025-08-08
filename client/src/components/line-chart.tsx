import React, { useEffect, useRef, memo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register Chart.js components for line and bar charts only
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend
);

interface PriceDataPoint {
  timestamp: number;
  close: number;
  volume: number;
}

interface LineChartProps {
  historicalData: PriceDataPoint[];
  forecastData: PriceDataPoint[];
  tp?: number;
  sl?: number;
  symbol: string;
}

const LineChart = memo(function LineChart({ historicalData, forecastData, tp, sl, symbol }: LineChartProps) {
  const chartRef = useRef<ChartJS>(null);

  if (!historicalData.length && !forecastData.length) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-[#1E2329] text-gray-400">
        Loading chart data...
      </div>
    );
  }

  console.log(`LineChart: ${historicalData.length} historical + ${forecastData.length} forecast points`);

  // Create historical price line data (orange line)
  const historicalLineData = historicalData.map(point => ({
    x: point.timestamp,
    y: point.close,
  }));

  // Create forecast price line data (blue dashed line)
  const forecastLineData = forecastData.map(point => ({
    x: point.timestamp,
    y: point.close,
  }));

  // Create volume bar data (only for historical data)
  const volumeBarData = historicalData.map(point => ({
    x: point.timestamp,
    y: point.volume * 1000, // Scale for visibility
  }));

  // Create TP/SL line data if provided
  const allTimestamps = [...historicalData, ...forecastData].map(p => p.timestamp);
  const tpLineData = tp ? allTimestamps.map(timestamp => ({
    x: timestamp,
    y: tp,
  })) : [];

  const slLineData = sl ? allTimestamps.map(timestamp => ({
    x: timestamp,
    y: sl,
  })) : [];

  const chartData = {
    datasets: [
      // Historical price line (orange)
      {
        label: 'Historical Price',
        type: 'line' as const,
        data: historicalLineData,
        borderColor: '#F7931A',
        backgroundColor: 'rgba(247, 147, 26, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
        yAxisID: 'price',
        order: 1,
      },
      // Forecast price line (blue dashed)
      {
        label: 'Forecast Price',
        type: 'line' as const,
        data: forecastLineData,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        borderDash: [8, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.1,
        yAxisID: 'price',
        order: 1,
      },
      // Volume bars
      {
        label: 'Volume',
        type: 'bar' as const,
        data: volumeBarData,
        backgroundColor: 'rgba(76, 175, 80, 0.3)',
        borderColor: 'rgba(76, 175, 80, 0.8)',
        borderWidth: 1,
        yAxisID: 'volume',
        order: 3,
      },
      // Take Profit line (green dashed)
      ...(tp ? [{
        label: 'Take Profit',
        type: 'line' as const,
        data: tpLineData,
        borderColor: '#10B981',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        yAxisID: 'price',
        order: 2,
      }] : []),
      // Stop Loss line (red dashed)
      ...(sl ? [{
        label: 'Stop Loss',
        type: 'line' as const,
        data: slLineData,
        borderColor: '#EF4444',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        yAxisID: 'price',
        order: 2,
      }] : []),
    ],
  };

  const options: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: `${symbol} Price Chart`,
        color: '#F3F4F6',
        font: { size: 16 },
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#F3F4F6',
          filter: (legendItem) => {
            return legendItem.text !== 'Volume'; // Hide volume from legend
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#F3F4F6',
        bodyColor: '#F3F4F6',
        borderColor: '#374151',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
          },
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
      price: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9CA3AF',
          callback: function(value) {
            return typeof value === 'number' ? value.toLocaleString() : value;
          },
        },
      },
      volume: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: {
          display: false,
        },
        ticks: {
          color: '#9CA3AF',
          display: false, // Hide volume ticks
        },
        max: Math.max(...volumeBarData.map(d => d.y)) * 4, // Scale volume smaller
      },
    },
  };

  return (
    <div className="h-[500px] bg-[#1E2329] p-4 rounded-lg">
      <Chart ref={chartRef} type="line" data={chartData} options={options} />
    </div>
  );
});

export default LineChart;