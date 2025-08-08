import { useEffect, useRef, useState } from "react";
import axios from "axios";

interface MiniChartProps {
  symbol: string;
  signal: "LONG" | "SHORT" | "NO DATA";
  isBackground?: boolean;
}

export default function MiniChart({ symbol, signal, isBackground = false }: MiniChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartData, setChartData] = useState<{ candles: any[], forecast: any[] } | null>(null);

  useEffect(() => {
    const fetchMiniChartData = async () => {
      try {
        const response = await axios.get(`/api/binance/chart/${symbol}`);
        const responseData = response.data;
        
        // Handle enhanced response format with data and metadata
        let chartDataArray = [];
        let qualityMetrics = null;
        
        if (responseData && responseData.data && responseData.metadata) {
          // New enhanced format
          chartDataArray = responseData.data;
          qualityMetrics = responseData.metadata.qualityMetrics;
          console.log(`📊 [MINI CHART] ${symbol} enhanced data quality: ${qualityMetrics.qualityScore}%`);
        } else if (Array.isArray(responseData)) {
          // Old format - backward compatibility
          chartDataArray = responseData;
        }
        
        if (chartDataArray && chartDataArray.length > 0) {
          // Split enhanced data into historical and forecast
          const historicalData = chartDataArray.filter(d => !d.isForecast);
          const forecastData = chartDataArray.filter(d => d.isForecast);
          
          setChartData({
            candles: historicalData,
            forecast: forecastData,
            qualityMetrics
          });
        }
      } catch (error) {
        console.error("Error fetching enhanced mini chart data:", error);
      }
    };

    fetchMiniChartData();
  }, [symbol]);

  useEffect(() => {
    if (!chartData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Combine candle and forecast data with null checks
    const allData = [
      ...chartData.candles.filter(c => c && c.time && c.close).map(c => ({ time: c.time, value: c.close, type: 'historical' })),
      ...(chartData.forecast || []).filter(f => f && f.time && f.value).map(f => ({ time: f.time, value: f.value, type: 'forecast' }))
    ];

    if (allData.length === 0) return;

    // Find min/max values
    const values = allData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    // Draw historical line (solid) with enhanced visibility and gradient effect
    const historicalData = allData.filter(d => d.type === 'historical');
    if (historicalData.length > 1) {
      // Adjust opacity based on background mode - make lines more visible
      const shadowOpacity = isBackground ? 0.25 : 0.3;
      const lineOpacity = isBackground ? 0.7 : 1.0;
      
      // Create gradient effect for background mode
      if (isBackground) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `rgba(${signal === "LONG" ? "34, 197, 94" : signal === "SHORT" ? "239, 68, 68" : "156, 163, 175"}, 0.1)`);
        gradient.addColorStop(1, `rgba(${signal === "LONG" ? "34, 197, 94" : signal === "SHORT" ? "239, 68, 68" : "156, 163, 175"}, 0.05)`);
        
        // Fill area under curve for background effect
        ctx.beginPath();
        ctx.moveTo(0, historicalData[0] ? (maxValue - historicalData[0].value + padding) * (canvas.height / (range + 2 * padding)) : canvas.height);
        historicalData.forEach((data, index) => {
          const x = (index / (allData.length - 1)) * canvas.width;
          const y = (maxValue - data.value + padding) * (canvas.height / (range + 2 * padding));
          ctx.lineTo(x, y);
        });
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Draw shadow/outline for better definition
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      ctx.lineWidth = isBackground ? 6 : 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      historicalData.forEach((point, index) => {
        const x = (index / (allData.length - 1)) * rect.width;
        const y = rect.height - ((point.value - minValue + padding) / (range + 2 * padding)) * rect.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw main line
      ctx.beginPath();
      const baseColor = signal === "LONG" ? "16, 185, 129" : signal === "SHORT" ? "239, 68, 68" : "156, 163, 175";
      ctx.strokeStyle = `rgba(${baseColor}, ${lineOpacity})`;
      ctx.lineWidth = isBackground ? 4 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      historicalData.forEach((point, index) => {
        const x = (index / (allData.length - 1)) * rect.width;
        const y = rect.height - ((point.value - minValue + padding) / (range + 2 * padding)) * rect.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw forecast line (dashed) with enhanced visibility
    const forecastStart = historicalData.length - 1;
    const forecastData = allData.slice(forecastStart);
    if (forecastData.length > 1) {
      // Adjust opacity for background mode - make forecast lines more visible
      const shadowOpacity = isBackground ? 0.15 : 0.2;
      const lineOpacity = isBackground ? 0.45 : 1.0;
      
      // Draw shadow for dashed line
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      ctx.lineWidth = isBackground ? 5 : 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(isBackground ? [4, 4] : [3, 3]);

      forecastData.forEach((point, index) => {
        const x = ((forecastStart + index) / (allData.length - 1)) * rect.width;
        const y = rect.height - ((point.value - minValue + padding) / (range + 2 * padding)) * rect.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw main dashed line
      ctx.beginPath();
      const baseColor = signal === "LONG" ? "16, 185, 129" : signal === "SHORT" ? "239, 68, 68" : "156, 163, 175";
      ctx.strokeStyle = `rgba(${baseColor}, ${lineOpacity})`;
      ctx.lineWidth = isBackground ? 3 : 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(isBackground ? [4, 4] : [3, 3]);

      forecastData.forEach((point, index) => {
        const x = ((forecastStart + index) / (allData.length - 1)) * rect.width;
        const y = rect.height - ((point.value - minValue + padding) / (range + 2 * padding)) * rect.height;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash
    }

  }, [chartData, signal, isBackground]);

  if (isBackground) {
    return (
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="h-8 w-20 bg-gray-900/50 rounded-md overflow-hidden relative">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
        {!chartData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}