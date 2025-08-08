import { useState, useEffect } from 'react';
// Card components removed - using section-container styling
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Clock, TrendingUp, TrendingDown, Zap, BarChart3, Info, Brain } from 'lucide-react';
import { LiveLearningMetrics } from './live-learning-metrics';
import TradeSuggestions from './TradeSuggestions';


interface ForecastBasedSignal {
  symbol: string;
  recommendedAction: 'LONG' | 'SHORT' | 'WAIT';
  forecastConfidence: number;
  priceTarget: number;
  riskAssessment: 'Low' | 'Medium' | 'High';
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  timeHorizon: string;
  analysis: string;
}

interface SystemStatus {
  isRunning: boolean;
  lastUpdate: string;
  approvedSymbols: string[];
  updateInterval: number;
  health: {
    symbolUpdates: Record<string, number>;
    unhealthySymbols: string[];
    dataCompleteness: number;
  };
  dataCompleteness: Record<string, number>;
}

export function DynamicLiveMLDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [forecastSignals, setForecastSignals] = useState<ForecastBasedSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fixed order for consistent display
  const SYMBOL_ORDER = ['ADAUSDT', 'BTCUSDT', 'ETHUSDT', 'HBARUSDT', 'SOLUSDT', 'XRPUSDT'];

  const fetchSystemData = async () => {
    try {
      setError(null);
      
      // Fetch system status
      const statusResponse = await fetch('/api/dynamic-live-ml/status');
      if (!statusResponse.ok) {
        throw new Error('Failed to fetch system status');
      }
      const statusData = await statusResponse.json();
      setSystemStatus(statusData.status);

      // Fetch forecast signals
      const signalsResponse = await fetch('/api/dynamic-live-ml/signals');
      if (!signalsResponse.ok) {
        throw new Error('Failed to fetch forecast signals');
      }
      const signalsData = await signalsResponse.json();
      
      // Sort signals by symbol order
      const sortedSignals = signalsData.signals.sort((a: ForecastBasedSignal, b: ForecastBasedSignal) => 
        a.symbol.localeCompare(b.symbol)
      );
      
      setForecastSignals(sortedSignals);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching system data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchSystemData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-green-500" />
            <span className="text-base sm:text-lg font-semibold text-white">Dynamic Live ML System</span>
          </div>
          <Badge variant="secondary" className="bg-green-500/20 text-green-600 self-start sm:self-center text-xs">LOADING</Badge>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center py-6 sm:py-8 gap-2">
          <div className="animate-spin text-green-500">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="text-sm sm:text-base text-muted-foreground text-center">Loading forecast system...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            <span className="text-base sm:text-lg font-semibold text-white">Dynamic Live ML System</span>
          </div>
          <Badge variant="destructive" className="self-start sm:self-center text-xs">ERROR</Badge>
        </div>
        <div className="text-center py-6 sm:py-8 px-4">
          <p className="text-red-500 mb-3 sm:mb-4 text-sm sm:text-base">Failed to load forecast system</p>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">{error}</p>
          <Button onClick={fetchSystemData} className="w-full sm:w-auto text-sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-green-500" />
          <span className="text-base sm:text-lg font-semibold text-white">Dynamic Live ML System</span>
          <Badge variant="secondary" className="bg-green-500/20 text-green-600 text-xs">LIVE</Badge>
        </div>
        {systemStatus?.isRunning && (
          <Badge variant="outline" className="text-green-600 self-start sm:self-center text-xs">
            {forecastSignals.length} Active Forecasts
          </Badge>
        )}
      </div>
      {/* Learning System Metrics - Enhanced with Real-Time Data */}
      {systemStatus && (
        <div className="section-container">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Live Learning System</h3>
          </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <LiveLearningMetrics />
            </div>
            
            {/* Traditional System Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="stat-card p-3 sm:p-4 bg-slate-800/50 rounded-lg">
                <div className={`text-lg sm:text-xl font-bold mb-1 ${systemStatus.isRunning ? 'text-green-500' : 'text-red-500'}`}>
                  {systemStatus.isRunning ? 'ACTIVE' : 'STOPPED'}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">System Status</div>
              </div>
              <div className="stat-card p-3 sm:p-4 bg-slate-800/50 rounded-lg">
                <div className="text-lg sm:text-xl font-bold text-blue-500 mb-1">
                  {systemStatus.approvedSymbols?.length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Tracked Symbols</div>
              </div>
              <div className="stat-card p-3 sm:p-4 bg-slate-800/50 rounded-lg sm:col-span-2 lg:col-span-1">
                <div className="text-lg sm:text-xl font-bold text-purple-500 mb-1">
                  {forecastSignals.length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Forecast Signals</div>
              </div>
            </div>
          </div>
        )}





      {/* AI Trade Suggestions Section */}
      <div className="section-container">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 animate-pulse" />
            <h3 className="text-base sm:text-lg font-semibold text-white">AI Trade Suggestions</h3>
          </div>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 self-start sm:self-center text-xs">ML POWERED</Badge>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            AI-powered trading recommendations based on 20-minute forecasts with confidence scoring and comprehensive risk analysis.
          </p>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
          <TradeSuggestions />
        </div>
      </div>
    </div>
  );
}