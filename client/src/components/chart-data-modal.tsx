import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { X, RefreshCw, TrendingUp, TrendingDown, Clock, Database, Activity, Settings, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ChartDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChartDataPoint {
  id: number;
  symbol: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  rsi: number;
  macd: number;
  stochasticK: number;
  stochasticD: number;
  bollingerUpper: string;
  bollingerLower: string;
  realizedVolatility: number;
  fundingRate: string | null;
  openInterest: string | null;
  // TRADE AMOUNT FIELDS - Added missing fields
  tradeCount: number;
  buyVolume: string;
  sellVolume: string;
  avgTradeSize: string;
  largestTrade: string;
  isComplete: boolean;
  hasMissingData: boolean;
  dataSourceCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RSIWorkerStatus {
  workerStatus: {
    running: boolean;
    processing: boolean;
    interval: number;
    batchSize: number;
    symbols: string[];
    lastCycleStats: {
      processed: number;
      updated: number;
      timestamp: string;
    };
  };
  rsiDataQuality: Array<{
    symbol: string;
    totalRecords: number;
    validRsiRecords: number;
    needsUpdateRecords: number;
    rsiQualityPercent: number;
  }>;
  timestamp: string;
}

interface MLTrainingStatus {
  success: boolean;
  overall: {
    totalSamples: number;
    readySamples: number;
    inputCompleteness: number;
    targetCompleteness: number;
    dataWindowStart: string;
    dataWindowEnd: string;
    readinessRate: number;
  };
  bySymbol: Array<{
    symbol: string;
    totalSamples: number;
    readySamples: number;
    inputCompleteness: number;
    targetCompleteness: number;
    avgVolatility: number;
    dataWindowStart: string | null;
    dataWindowEnd: string | null;
    readinessRate: number;
  }>;
  batches: {
    total: number;
    pending: number;
    completed: number;
  };
  samplerConfig: {
    windowSize: number;
    inputLength: number;
    targetLength: number;
    samplingInterval: number;
    minSamplesForBatch: number;
  };
  lastUpdated: string;
}

interface MLInfrastructureStatus {
  infrastructureSetup: boolean;
  totalSequences: number;
  modelArchitectures: {
    lstm: { parameters: number; layers: number };
    gru: { parameters: number; layers: number };
    xgboost: { modelCount: number };
    randomForest: { modelCount: number };
  };
  trainingPlan: {
    estimatedHours: number;
    memoryRequirement: number;
    phases: number;
  };
  dependenciesInstalled: boolean;
  ready: boolean;
}

interface EnhancedChartDataOverview {
  success: boolean;
  overview: Array<{
    symbol: string;
    qualityScore: number;
    dataPoints: number;
    gaps: number;
    backtestReady: boolean;
  }>;
  timestamp: string;
}

interface EnhancedQualityMetrics {
  success: boolean;
  symbol: string;
  qualityMetrics: {
    averageQualityScore: number;
    totalDataPoints: number;
    backtestReadyPercentage: number;
    sourceDistribution: Record<string, number>;
    gapCount: number;
    lastUpdated: string;
  };
  timestamp: string;
}

interface ChartDataQualityStats {
  success: boolean;
  timestamp: string;
  systemOverview: {
    totalRecords: number;
    totalCompleteRecords: number;
    totalWithTradeData: number;
    totalWithVolume: number;
    totalMissingTradeData: number;
    systemOverallQualityPercent: number;
    systemTradeDataQualityPercent: number;
    needsTradeDataWorker: boolean;
  };
  symbolStats: Array<{
    symbol: string;
    totalRecords: number;
    recordsWithVolume: number;
    recordsWithTradeData: number;
    completeRecords: number;
    dataCompletenessPercent: number;
    tradeDataCompletenessPercent: number;
    overallQualityPercent: number;
    avgTradeCount: number;
    avgBuyVolume: number;
    missingTradeDataCount: number;
    needsTradeDataFix: boolean;
    error?: string;
  }>;
}

type SortField = keyof ChartDataPoint;
type SortDirection = 'asc' | 'desc';

export function ChartDataModal({ isOpen, onClose }: ChartDataModalProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  
  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState({
    mlTrainingStatic: false,
    mlTraining: false,
    rsiWorker: false,
    dataQuality: false,
    mlForecast: false,
    enhancedData: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    console.log(`Toggling section: ${section}`, 'from:', expandedSections[section], 'to:', !expandedSections[section]);
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [section]: !prev[section]
      };
      console.log('New expanded sections state:', newState);
      return newState;
    });
  };

  const { data: chartData = [], isLoading, error, refetch } = useQuery<ChartDataPoint[]>({
    queryKey: ['chart-data', selectedSymbol],
    queryFn: async () => {
      const url = selectedSymbol === 'all' 
        ? '/api/chart-data' 
        : `/api/chart-data?symbol=${selectedSymbol}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: rsiWorkerStatus, isLoading: isLoadingWorkerStatus } = useQuery<RSIWorkerStatus>({
    queryKey: ['rsi-worker-status'],
    queryFn: async () => {
      const response = await fetch('/api/rsi-worker-status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time status
  });

  const { data: qualityStats, isLoading: isLoadingQuality } = useQuery<ChartDataQualityStats>({
    queryKey: ['chart-data-quality'],
    queryFn: async () => {
      const response = await fetch('/api/chart-data/quality');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 8000, // Refresh every 8 seconds for quality monitoring
  });

  const { data: mlTrainingData, isLoading: mlTrainingLoading } = useQuery<MLTrainingStatus>({
    queryKey: ['ml-training-status'],
    queryFn: async () => {
      const response = await fetch('/api/ml-training-status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 10000, // Refresh every 10 seconds for ML training monitoring
  });

  // Enhanced Chart Data queries
  const { data: enhancedOverview, isLoading: isLoadingEnhancedOverview } = useQuery<EnhancedChartDataOverview>({
    queryKey: ['enhanced-chart-data-overview'],
    queryFn: async () => {
      const response = await fetch('/api/enhanced-chart-data/overview');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: selectedSymbolQuality, isLoading: isLoadingSymbolQuality } = useQuery<EnhancedQualityMetrics>({
    queryKey: ['enhanced-quality-metrics', selectedSymbol],
    queryFn: async () => {
      if (selectedSymbol === 'all') return null;
      const response = await fetch(`/api/enhanced-chart-data/quality/${selectedSymbol}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    enabled: isOpen && selectedSymbol !== 'all',
    refetchInterval: 12000, // Refresh every 12 seconds
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatValue = (value: any, field: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (field) {
      case 'timestamp':
      case 'createdAt':
      case 'updatedAt':
        return new Date(value).toLocaleString();
      case 'open':
      case 'high':
      case 'low':
      case 'close':
        return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
      case 'volume':
      case 'buyVolume':
      case 'sellVolume':
        // Fix trade volume display - ensure proper number formatting
        return value && (parseFloat(value) > 0 || value === 0) ? parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
      case 'avgTradeSize':
      case 'largestTrade':
        // Fix trade size display - handle string and number values properly
        return value && (parseFloat(value) > 0 || value === 0) ? parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 6 }) : 'N/A';
      case 'tradeCount':
        // Fix trade count display - handle both string and number values
        return (value !== null && value !== undefined && value !== '') ? parseInt(value).toLocaleString() : '0';
      case 'rsi':
      case 'macd':
      case 'stochasticK':
      case 'stochasticD':
      case 'realizedVolatility':
        return value.toFixed(4);
      case 'bollingerUpper':
      case 'bollingerLower':
        return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
      case 'fundingRate':
        return value ? `${(parseFloat(value) * 100).toFixed(6)}%` : 'N/A';
      case 'openInterest':
        return value ? `$${parseFloat(value).toLocaleString()}` : 'N/A';
      default:
        return String(value);
    }
  };

  const getDataQualityBadge = (point: ChartDataPoint) => {
    if (point.hasMissingData) {
      return <Badge variant="destructive" className="text-xs">Missing Data</Badge>;
    }
    if (!point.isComplete) {
      return <Badge variant="secondary" className="text-xs">Incomplete</Badge>;
    }
    return <Badge variant="default" className="text-xs bg-green-600">Complete</Badge>;
  };

  const getActivityLevelIndicator = (point: ChartDataPoint): { status: 'excellent' | 'good' | 'low' | 'minimal'; label: string; description: string; color: string } => {
    const volume = parseFloat(point.volume || '0');
    const tradeCount = parseInt(point.tradeCount?.toString() || '0');
    
    if (volume > 100 && tradeCount > 10) {
      return { 
        status: 'excellent', 
        label: 'High Activity', 
        description: 'Normal trading volume and activity', 
        color: 'bg-green-600 text-white' 
      };
    } else if (volume > 10 && tradeCount > 1) {
      return { 
        status: 'good', 
        label: 'Moderate Activity', 
        description: 'Decent trading volume and activity', 
        color: 'bg-blue-600 text-white' 
      };
    } else if (volume > 0.1 && tradeCount >= 1) {
      return { 
        status: 'low', 
        label: 'Low Activity', 
        description: 'Limited trading activity period - authentic low-volume data', 
        color: 'bg-yellow-600 text-white' 
      };
    } else {
      return { 
        status: 'minimal', 
        label: 'Minimal Activity', 
        description: 'Very low or no trading during this period - authentic market conditions', 
        color: 'bg-orange-600 text-white' 
      };
    }
  };

  const sortedData = [...chartData].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    let comparison = 0;
    if (aValue != null && bValue != null) {
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
    }
    
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const symbols = Array.from(new Set(chartData.map(point => point.symbol)));

  const filteredData = selectedSymbol === 'all' 
    ? sortedData 
    : sortedData.filter(point => point.symbol === selectedSymbol);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-full w-[95vw] sm:w-[90vw] lg:w-[85vw] xl:max-w-7xl h-[85vh] sm:h-[90vh] bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 flex flex-col p-0 [&>button]:hidden"
      >
        <DialogHeader className="flex flex-row items-center justify-between p-6 pb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Chart Data Monitor
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="border-gray-600 hover:bg-gray-700"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-auto px-6 space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg flex-shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300">Symbol:</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="all">All Symbols</option>
                {symbols.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>{filteredData.length} data points</span>
              </div>
            </div>
          </div>

          {/* ML Infrastructure Status */}
          <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">ML Training Infrastructure</span>
                <Button
                  onClick={() => toggleSection('mlTrainingStatic')}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                >
                  {expandedSections.mlTrainingStatic ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-400">Ready</span>
                </div>
              </div>
            </div>
            
            {expandedSections.mlTrainingStatic && (
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-800/50 rounded p-3 border border-gray-700/50">
                <div className="text-xs font-medium text-purple-400 mb-1">Training Data</div>
                <div className="text-lg font-bold text-white">1,562</div>
                <div className="text-xs text-gray-400">Sequences Ready</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3 border border-gray-700/50">
                <div className="text-xs font-medium text-blue-400 mb-1">Models</div>
                <div className="text-lg font-bold text-white">44</div>
                <div className="text-xs text-gray-400">LSTM + GRU + Ensemble</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3 border border-gray-700/50">
                <div className="text-xs font-medium text-orange-400 mb-1">Training Time</div>
                <div className="text-lg font-bold text-white">4.25h</div>
                <div className="text-xs text-gray-400">Estimated Duration</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-3 border border-gray-700/50">
                <div className="text-xs font-medium text-green-400 mb-1">Memory</div>
                <div className="text-lg font-bold text-white">2.0 GB</div>
                <div className="text-xs text-gray-400">Peak Requirement</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                <div className="text-xs font-medium text-blue-400 mb-1">BTCUSDT</div>
                <div className="text-sm text-white font-medium">461 sequences</div>
                <div className="text-xs text-gray-400">σ: 0.46</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                <div className="text-xs font-medium text-blue-400 mb-1">ETHUSDT</div>
                <div className="text-sm text-white font-medium">461 sequences</div>
                <div className="text-xs text-gray-400">σ: 0.52</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                <div className="text-xs font-medium text-blue-400 mb-1">SOLUSDT</div>
                <div className="text-sm text-white font-medium">461 sequences</div>
                <div className="text-xs text-gray-400">σ: 0.72</div>
              </div>
              
              <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                <div className="text-xs font-medium text-blue-400 mb-1">XRPUSDT</div>
                <div className="text-sm text-white font-medium">179 sequences</div>
                <div className="text-xs text-gray-400">σ: 0.82</div>
              </div>
            </div>
            
            <div className="mt-3 p-2 bg-purple-900/20 rounded border border-purple-500/30">
              <div className="text-xs text-purple-300 mb-1">Production Training Ready:</div>
              <div className="text-sm text-white">
                • Deep Learning: LSTM (285K params) + GRU (215K params)
              </div>
              <div className="text-sm text-white">
                • Ensemble: 20 XGBoost + 20 Random Forest models
              </div>
              <div className="text-sm text-white">
                • Input: 120-minute windows → Output: 20-minute predictions
              </div>
              <div className="text-xs text-purple-400 mt-1">
                Execute: python model_registry/production_trainer.py
              </div>
            </div>
            </div>
            )}

          {/* ML Forecast Infrastructure */}
          <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-white">ML Forecast Infrastructure</span>
                <Button
                  onClick={() => toggleSection('mlForecast')}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                >
                  {expandedSections.mlForecast ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-400">Ready</span>
                </div>
              </div>
            </div>

            {expandedSections.mlForecast && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs font-medium text-green-400 mb-1">Forecast API</div>
                  <div className="text-sm text-white font-medium">/api/forecasts</div>
                  <div className="text-xs text-gray-400">Next 20-min predictions</div>
                </div>
                
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs font-medium text-green-400 mb-1">Chart Integration</div>
                  <div className="text-sm text-white font-medium">Overlay Ready</div>
                  <div className="text-xs text-gray-400">Confidence bands</div>
                </div>
                
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs font-medium text-green-400 mb-1">Sanity Filtering</div>
                  <div className="text-sm text-white font-medium">3× Volatility</div>
                  <div className="text-xs text-gray-400">Post-processing</div>
                </div>
                
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs font-medium text-green-400 mb-1">Audit System</div>
                  <div className="text-sm text-white font-medium">Accuracy Tracking</div>
                  <div className="text-xs text-gray-400">Performance review</div>
                </div>
              </div>
              
              <div className="mt-3 p-2 bg-green-900/20 rounded border border-green-500/30">
                <div className="text-xs text-green-300 mb-1">Forecast Features:</div>
                <div className="text-sm text-white">
                  • Real-time ML inference with 20-minute prediction horizon
                </div>
                <div className="text-sm text-white">
                  • Comprehensive sanity filtering and post-processing validation
                </div>
                <div className="text-sm text-white">
                  • Chart integration with confidence visualization
                </div>
                <div className="text-sm text-white">
                  • Audit functionality for forecast accuracy review
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Enhanced Chart Data System */}
          {!isLoadingEnhancedOverview && enhancedOverview && (
            <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">Enhanced Chart Data System</span>
                  <Button
                    onClick={() => toggleSection('enhancedData')}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                  >
                    {expandedSections.enhancedData ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const overview = enhancedOverview?.symbols || [];
                    if (overview.length === 0) {
                      return (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-xs text-red-400">No Data</span>
                        </div>
                      );
                    }
                    
                    const avgQuality = overview.reduce((sum, item) => sum + item.quality, 0) / overview.length;
                    const backtestReadyCount = overview.filter(item => item.quality >= 95).length;
                    
                    return avgQuality >= 80 ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-400">Excellent Quality</span>
                      </div>
                    ) : avgQuality >= 60 ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-400">Good Quality</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-red-400">Needs Improvement</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {expandedSections.enhancedData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {(enhancedOverview?.symbols || []).map((symbolData) => (
                      <div key={symbolData.symbol} className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                        <div className="text-xs font-medium text-purple-400 mb-2">{symbolData.symbol}</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Quality:</span>
                            <span className={`text-xs font-medium ${
                              (symbolData.quality || 0) >= 90 ? 'text-green-400' :
                              (symbolData.quality || 0) >= 70 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {(symbolData.quality || 0).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={symbolData.quality || 0} 
                            className="h-1 bg-gray-700"
                          />
                          <div className="text-xs text-gray-500">
                            {(symbolData.completeness || 0).toLocaleString()} points
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className={`${(symbolData.gaps?.length || 0) === 0 ? 'text-green-400' : 'text-orange-400'}`}>
                              {symbolData.gaps?.length || 0} gaps
                            </span>
                            <span className={`${symbolData.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                              {symbolData.status === 'healthy' ? '✓ Ready' : '✗ Not Ready'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Symbol-specific quality details */}
                  {!isLoadingSymbolQuality && selectedSymbolQuality && selectedSymbol !== 'all' && (
                    <div className="mt-4 p-3 bg-purple-900/20 rounded border border-purple-500/30">
                      <div className="text-xs text-purple-300 mb-2">Enhanced Details for {selectedSymbol}:</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-white">Quality Score: {selectedSymbolQuality.qualityMetrics.averageQualityScore.toFixed(1)}%</div>
                        <div className="text-white">Backtest Ready: {selectedSymbolQuality.qualityMetrics.backtestReadyPercentage.toFixed(1)}%</div>
                        <div className="text-white">Total Points: {selectedSymbolQuality.qualityMetrics.totalDataPoints.toLocaleString()}</div>
                        <div className="text-white">Gaps: {selectedSymbolQuality.qualityMetrics.gapCount}</div>
                      </div>
                      <div className="mt-2 text-xs text-purple-300">
                        Last Updated: {new Date(selectedSymbolQuality.qualityMetrics.lastUpdated).toLocaleString()}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3 p-2 bg-purple-900/20 rounded border border-purple-500/30">
                    <div className="text-xs text-purple-300 mb-1">Enhanced Features:</div>
                    <div className="text-sm text-white">
                      • Gap detection and automated backfill
                    </div>
                    <div className="text-sm text-white">
                      • Quality scoring with source tracking
                    </div>
                    <div className="text-sm text-white">
                      • Data integrity validation
                    </div>
                    <div className="text-sm text-white">
                      • ML forecast engine integration
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RSI Worker Status */}
          {!isLoadingWorkerStatus && rsiWorkerStatus && (
            <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">RSI Worker Status</span>
                  <Button
                    onClick={() => toggleSection('rsiWorker')}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                  >
                    {expandedSections.rsiWorker ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    // Check if RSI calculations are working by examining data quality
                    const dataQuality = rsiWorkerStatus?.rsiDataQuality || [];
                    if (dataQuality.length === 0) {
                      return (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-xs text-red-400">No Data</span>
                        </div>
                      );
                    }
                    
                    const avgQuality = dataQuality.reduce((sum, item) => sum + (item.rsiQualityPercent || 0), 0) / dataQuality.length;
                    const isRsiActive = avgQuality >= 70; // Consider active if average quality is 70% or higher
                    
                    return isRsiActive ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-400">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-400">Low Quality</span>
                      </div>
                    );
                  })()}
                  {rsiWorkerStatus.workerStatus.processing && (
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                      <span className="text-xs text-blue-400">Processing</span>
                    </div>
                  )}
                </div>
              </div>
              
              {expandedSections.rsiWorker && (
              <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {rsiWorkerStatus.rsiDataQuality.map((symbolData) => (
                  <div key={symbolData.symbol} className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                    <div className="text-xs font-medium text-blue-400 mb-1">{symbolData.symbol}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Quality:</span>
                        <span className={`text-xs font-medium ${
                          symbolData.rsiQualityPercent >= 90 ? 'text-green-400' :
                          symbolData.rsiQualityPercent >= 70 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {symbolData.rsiQualityPercent}%
                        </span>
                      </div>
                      <Progress 
                        value={symbolData.rsiQualityPercent} 
                        className="h-1 bg-gray-700"
                      />
                      <div className="text-xs text-gray-500">
                        {symbolData.validRsiRecords}/{symbolData.totalRecords} valid
                      </div>
                      {symbolData.needsUpdateRecords > 0 && (
                        <div className="text-xs text-orange-400">
                          {symbolData.needsUpdateRecords} need update
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>Worker runs every {rsiWorkerStatus.workerStatus.interval / 1000}s, batch size: {rsiWorkerStatus.workerStatus.batchSize}</span>
                <span>Last updated: {new Date(rsiWorkerStatus.timestamp).toLocaleTimeString()}</span>
              </div>
              </>
              )}
            </div>
          )}

          {/* ML Training Status */}
          {!mlTrainingLoading && mlTrainingData && (
            <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-white">ML Training Infrastructure</span>
                  <Button
                    onClick={() => toggleSection('mlTraining')}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                  >
                    {expandedSections.mlTraining ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-400">
                    {mlTrainingData.overall.totalSamples} Training Samples
                  </span>
                </div>
              </div>
              
              {expandedSections.mlTraining && (
              <>
              {/* Overall Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Total Samples</div>
                  <div className="text-lg font-bold text-white">{mlTrainingData.overall.totalSamples}</div>
                  <div className="text-xs text-green-400">{mlTrainingData.overall.readinessRate}% Ready</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Input Data</div>
                  <div className="text-lg font-bold text-white">{mlTrainingData.overall.inputCompleteness}%</div>
                  <div className="text-xs text-blue-400">120-row sequences</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Target Data</div>
                  <div className="text-lg font-bold text-white">{mlTrainingData.overall.targetCompleteness}%</div>
                  <div className="text-xs text-blue-400">20-row predictions</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                  <div className="text-xs text-gray-400 mb-1">Data Window</div>
                  <div className="text-sm font-medium text-white">
                    {new Date(mlTrainingData.overall.dataWindowStart).toLocaleDateString()} -
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(mlTrainingData.overall.dataWindowEnd).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Per-Symbol Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {mlTrainingData.bySymbol.map((symbolData) => (
                  <div key={symbolData.symbol} className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                    <div className="text-xs font-medium text-blue-400 mb-1">{symbolData.symbol}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Samples:</span>
                        <span className="text-xs font-medium text-white">
                          {symbolData.totalSamples}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Ready:</span>
                        <span className={`text-xs font-medium ${
                          symbolData.readinessRate >= 100 ? 'text-green-400' :
                          symbolData.readinessRate >= 80 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {symbolData.readinessRate}%
                        </span>
                      </div>
                      <Progress 
                        value={symbolData.readinessRate} 
                        className="h-1 bg-gray-700"
                      />
                      <div className="text-xs text-purple-400">
                        Volatility: {symbolData.avgVolatility.toFixed(3)}
                      </div>
                      {symbolData.dataWindowStart && symbolData.dataWindowEnd && (
                        <div className="text-xs text-gray-500">
                          {new Date(symbolData.dataWindowStart).toLocaleDateString()} -<br/>
                          {new Date(symbolData.dataWindowEnd).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>Window: {mlTrainingData.samplerConfig.windowSize} min | Input: {mlTrainingData.samplerConfig.inputLength} | Target: {mlTrainingData.samplerConfig.targetLength}</span>
                <span>Last updated: {new Date(mlTrainingData.lastUpdated).toLocaleTimeString()}</span>
              </div>
              </>
              )}
            </div>
          )}

          {/* Trade Data Quality Assessment */}
          {!isLoadingQuality && qualityStats && qualityStats.systemOverview && (
            <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">Trade Data Quality Assessment</span>
                  <Button
                    onClick={() => toggleSection('dataQuality')}
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto"
                  >
                    {expandedSections.dataQuality ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <span>System Quality: </span>
                    <span className={`font-medium ${
                      (qualityStats.systemOverview.systemOverallQualityPercent || 0) >= 90 ? 'text-green-400' :
                      (qualityStats.systemOverview.systemOverallQualityPercent || 0) >= 70 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {qualityStats.systemOverview.systemOverallQualityPercent || 0}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Trade Data: </span>
                    <span className={`font-medium ${
                      (qualityStats.systemOverview.systemTradeDataQualityPercent || 0) >= 90 ? 'text-green-400' :
                      (qualityStats.systemOverview.systemTradeDataQualityPercent || 0) >= 70 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {qualityStats.systemOverview.systemTradeDataQualityPercent || 0}%
                    </span>
                  </div>
                  {qualityStats.systemOverview.needsTradeDataWorker && (
                    <div className="flex items-center gap-1 text-orange-400">
                      <AlertCircle className="w-3 h-3" />
                      <span>Worker Needed</span>
                    </div>
                  )}
                </div>
              </div>
              
              {expandedSections.dataQuality && (
              <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {qualityStats.symbolStats.map((symbolData) => (
                  <div key={symbolData.symbol} className="bg-gray-800/50 rounded p-2 border border-gray-700/50">
                    <div className="text-xs font-medium text-purple-400 mb-1">{symbolData.symbol}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Overall:</span>
                        <span className={`text-xs font-medium ${
                          symbolData.overallQualityPercent >= 90 ? 'text-green-400' :
                          symbolData.overallQualityPercent >= 70 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {symbolData.overallQualityPercent}%
                        </span>
                      </div>
                      <Progress 
                        value={symbolData.overallQualityPercent} 
                        className="h-1 bg-gray-700"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">Trade Data:</span>
                        <span className={`text-xs font-medium ${
                          symbolData.tradeDataCompletenessPercent >= 90 ? 'text-green-400' :
                          symbolData.tradeDataCompletenessPercent >= 70 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {symbolData.tradeDataCompletenessPercent}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {symbolData.recordsWithTradeData}/{symbolData.recordsWithVolume} records
                      </div>
                      {symbolData.missingTradeDataCount > 0 && (
                        <div className="text-xs text-orange-400">
                          {symbolData.missingTradeDataCount.toLocaleString()} missing
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Avg: {symbolData.avgTradeCount} trades/min
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  Total: {qualityStats.systemOverview.totalRecords.toLocaleString()} records | 
                  Complete: {qualityStats.systemOverview.totalCompleteRecords.toLocaleString()} | 
                  Missing Trade Data: {qualityStats.systemOverview.totalMissingTradeData.toLocaleString()}
                </span>
                <span>Last updated: {new Date(qualityStats.timestamp).toLocaleTimeString()}</span>
              </div>
              </>
              )}
            </div>
          )}

          {/* Data Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Loading chart data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">
              Error loading chart data: {error.message}
            </div>
          ) : (
            <div className="border border-gray-700/50 rounded-lg overflow-auto">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <table 
                  className="text-xs sm:text-sm border-collapse w-full min-w-max"
                  style={{ 
                    minWidth: 'max-content',
                    display: 'table'
                  }}
                >
                  <thead className="bg-gray-800/80 sticky top-0 z-10">
                    <tr>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[50px] sm:min-w-[60px]">Symbol</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[80px] sm:min-w-[100px]">Timestamp</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">Open</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">High</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">Low</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">Close</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[70px] sm:min-w-[80px]">Volume</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[45px] sm:min-w-[50px]">Trades</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[70px] sm:min-w-[80px]">Buy Vol</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[70px] sm:min-w-[80px]">Sell Vol</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[70px] sm:min-w-[80px]">Avg Size</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[70px] sm:min-w-[80px]">Largest</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[50px] sm:min-w-[60px]">RSI</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">MACD</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[50px] sm:min-w-[60px]">Stoch K</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[50px] sm:min-w-[60px]">Stoch D</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">BB Upper</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">BB Lower</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[60px] sm:min-w-[70px]">Volatility</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[50px] sm:min-w-[60px]">Quality</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-700/50 min-w-[80px] sm:min-w-[90px]">Activity</th>
                      <th className="px-1 sm:px-2 py-1 sm:py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-[80px] sm:min-w-[90px]">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900/50">
                    {filteredData.map((point: ChartDataPoint) => (
                      <tr key={point.id} className="hover:bg-gray-800/30 transition-colors border-b border-gray-700/30">
                        <td className="px-1 sm:px-2 py-1 sm:py-2 font-medium text-blue-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{point.symbol}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-gray-300 font-mono text-xs whitespace-nowrap border-r border-gray-700/30">{formatValue(point.timestamp, 'timestamp')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-green-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.open, 'open')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-red-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.high, 'high')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-blue-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.low, 'low')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-white font-medium whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.close, 'close')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-gray-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.volume, 'volume')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-gray-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.tradeCount, 'tradeCount')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-green-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.buyVolume, 'buyVolume')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-red-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.sellVolume, 'sellVolume')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-blue-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.avgTradeSize, 'avgTradeSize')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-orange-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.largestTrade, 'largestTrade')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-yellow-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.rsi, 'rsi')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-cyan-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.macd, 'macd')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-green-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.stochasticK, 'rsi')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-green-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.stochasticD, 'rsi')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-orange-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.bollingerUpper, 'close')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-orange-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.bollingerLower, 'close')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-purple-400 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{formatValue(point.realizedVolatility, 'realizedVolatility')}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">{getDataQualityBadge(point)}</td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 whitespace-nowrap border-r border-gray-700/30 text-xs sm:text-sm">
                          <Badge className={`text-xs ${getActivityLevelIndicator(point).color}`} title={getActivityLevelIndicator(point).description}>
                            {getActivityLevelIndicator(point).label}
                          </Badge>
                        </td>
                        <td className="px-1 sm:px-2 py-1 sm:py-2 text-gray-400 text-xs whitespace-nowrap">{formatValue(point.updatedAt, 'updatedAt')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}