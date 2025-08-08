import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, TrendingUp, TrendingDown, Pause, AlertTriangle, Target, Shield, DollarSign, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TechnicalSnapshot {
  rsi: number;
  macd: number;
  macdSignal: number;
  stochasticK: number;
  stochasticD: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
}

interface TradeSuggestion {
  id: number;
  tradeId: string;
  symbol: string;
  timestamp: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: string;
  takeProfitPrice: string | null;
  stopLossPrice: string | null;
  positionSize: number | null;
  forecastReturn: number;
  pathSlope: number;
  confidence: number;
  technicalSnapshot: TechnicalSnapshot;
  reason: string;
  warnings: string[];
  riskRewardRatio: number | null;
  status: string;
  createdAt: string;
}

interface GenerateAllResponse {
  success: boolean;
  data: Array<{
    symbol: string;
    success: boolean;
    suggestion?: TradeSuggestion;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface PendingSuggestionsResponse {
  success: boolean;
  data: TradeSuggestion[];
  count: number;
  timestamp: string;
}

const DirectionIcon = ({ direction }: { direction: string }) => {
  switch (direction) {
    case 'BUY':
    case 'LONG':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'SELL':
    case 'SHORT':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'WAIT':
      return <Pause className="h-4 w-4 text-yellow-500" />;
    default:
      return <Pause className="h-4 w-4 text-gray-500" />;
  }
};

const DirectionBadge = ({ direction }: { direction: string }) => {
  const colors = {
    BUY: 'bg-green-500/10 text-green-500 border-green-500/20',
    LONG: 'bg-green-500/10 text-green-500 border-green-500/20',
    SELL: 'bg-red-500/10 text-red-500 border-red-500/20',
    SHORT: 'bg-red-500/10 text-red-500 border-red-500/20',
    WAIT: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  };

  return (
    <Badge variant="outline" className={colors[direction as keyof typeof colors] || 'bg-gray-500/10 text-gray-500'}>
      <DirectionIcon direction={direction} />
      <span className="ml-1">{direction}</span>
    </Badge>
  );
};

const ConfidenceBar = ({ confidence, direction }: { confidence: number; direction?: string }) => {
  // Handle both decimal (0.9 = 90%) and integer (90 = 90%) formats
  const percentage = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
  const color = percentage >= 75 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  
  // For WAIT signals, show analysis status instead of confidence
  if (direction === 'WAIT') {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>Analysis Status</span>
          <span className="font-medium text-yellow-500">Analyzing</span>
        </div>
        <Progress value={25} className="h-2 bg-yellow-500/20" />
        <div className="text-xs text-muted-foreground">
          System is evaluating market conditions
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Confidence</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
};

const TechnicalIndicators = ({ technical }: { technical: TechnicalSnapshot | undefined }) => {
  const formatValue = (value: number | null | undefined, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  // Handle undefined technical data
  if (!technical) {
    return (
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">RSI</span>
            <span className="font-mono">N/A</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MACD</span>
            <span className="font-mono">N/A</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stoch K</span>
            <span className="font-mono">N/A</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stoch D</span>
            <span className="font-mono">N/A</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">RSI</span>
          <span className="font-mono">{formatValue(technical.rsi, 2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">MACD</span>
          <span className="font-mono">{formatValue(technical.macd, 4)}</span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stoch K</span>
          <span className="font-mono">{formatValue(technical.stochasticK, 2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stoch D</span>
          <span className="font-mono">{formatValue(technical.stochasticD, 2)}</span>
        </div>
      </div>
    </div>
  );
};

const SuggestionCard = ({ suggestion }: { suggestion: TradeSuggestion }) => {
  const formatPrice = (price: string | null) => {
    if (!price) return 'N/A';
    return parseFloat(price).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  };

  const timeAgo = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();
    
    if (isNaN(time)) return 'Invalid time';
    
    const diff = Math.floor((now - time) / 1000);
    
    if (diff < 0) return 'Future';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle className="text-xl font-bold text-white">{suggestion.symbol}</CardTitle>
            <DirectionBadge direction={suggestion.direction} />
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-400 font-medium">
            <Clock className="h-4 w-4" />
            <span>{timeAgo(suggestion.timestamp)}</span>
          </div>
        </div>
        <CardDescription className="text-sm text-slate-300 mt-2 leading-relaxed">{suggestion.reason}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ConfidenceBar confidence={suggestion.confidence} direction={suggestion.direction} />
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-center space-x-1 text-xs font-medium">
              <DollarSign className="h-3 w-3" />
              <span>Entry Price</span>
            </div>
            <div className="font-mono text-xs bg-muted p-2 rounded">
              ${formatPrice(suggestion.entryPrice)}
            </div>
          </div>
          
          {suggestion.direction !== 'WAIT' && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1 text-xs font-medium">
                <Target className="h-3 w-3" />
                <span>Take Profit</span>
              </div>
              <div className="font-mono text-xs bg-green-500/10 text-green-600 p-2 rounded">
                ${formatPrice(suggestion.takeProfitPrice)}
              </div>
            </div>
          )}
        </div>
        
        {suggestion.direction !== 'WAIT' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-1 text-xs font-medium">
                <Shield className="h-3 w-3" />
                <span>Stop Loss</span>
              </div>
              <div className="font-mono text-xs bg-red-500/10 text-red-600 p-2 rounded">
                ${formatPrice(suggestion.stopLossPrice)}
              </div>
            </div>
            
            {suggestion.riskRewardRatio && (
              <div className="space-y-2">
                <div className="text-xs font-medium">Risk/Reward</div>
                <div className="font-mono text-xs bg-muted p-2 rounded">
                  1:{suggestion.riskRewardRatio?.toFixed(2) || 'N/A'}
                </div>
              </div>
            )}
          </div>
        )}
        
        {(suggestion.warnings?.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center space-x-1 text-sm font-medium text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Warnings</span>
            </div>
            <div className="space-y-1">
              {suggestion.warnings.map((warning, index) => (
                <div key={index} className="text-xs bg-yellow-500/10 text-yellow-600 p-2 rounded">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <Separator />
        
        <div className="space-y-2">
          <div className="text-sm font-medium">Technical Indicators</div>
          <TechnicalIndicators technical={suggestion.technicalSnapshot} />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <span>Forecast Return: </span>
            <span className={`font-mono ${(suggestion.forecastReturn || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {suggestion.forecastReturn ? (suggestion.forecastReturn * 100).toFixed(3) : '0.000'}%
            </span>
          </div>
          <div>
            <span>Path Slope: </span>
            <span className="font-mono">{suggestion.pathSlope ? suggestion.pathSlope.toFixed(2) : '0.00'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Active Trade Card Component for displaying active trade simulations
const ActiveTradeCard = ({ trade }: { trade: any }) => {
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  };

  const formatPnL = (value: string): string => {
    const num = parseFloat(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'text-red-500';
    if (progress < 50) return 'text-orange-500';
    if (progress < 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Card className="border-slate-600/40 bg-slate-800/40 backdrop-blur-sm">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="font-bold text-sm sm:text-base">{trade.symbol}</div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              trade.signalType === 'LONG' 
                ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                : 'bg-red-600/20 text-red-400 border border-red-500/30'
            }`}>
              {trade.signalType}
            </div>
          </div>
          <div className={`text-xs font-medium ${getProgressColor(trade.progress)}`}>
            {trade.progress}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Entry</div>
            <div className="font-mono">${formatCurrency(parseFloat(trade.entryPrice))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current</div>
            <div className="font-mono">${formatCurrency(parseFloat(trade.currentPrice))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Take Profit</div>
            <div className="font-mono">${formatCurrency(parseFloat(trade.tpPrice))}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Stop Loss</div>
            <div className="font-mono">${formatCurrency(parseFloat(trade.slPrice))}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">P&L</span>
            <span className={`text-xs font-mono ${
              trade.profitable ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPnL(trade.realTimePnl)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Remaining</span>
            <span className="text-xs font-mono">{formatTime(trade.remainingSeconds || 0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <span className="text-xs font-mono">{trade.confidence}%</span>
          </div>
        </div>

        <div className="w-full bg-slate-700/50 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(trade.progress).replace('text-', 'bg-')}`}
            style={{ width: `${Math.min(trade.progress, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default function TradeSuggestions() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('live');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch active trades with 30-second auto-refresh
  const { data: activeTradesData, isLoading: activeTradesLoading } = useQuery<any>({
    queryKey: ['/api/trades/active'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
  });

  // Generate all suggestions mutation
  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/trade-suggestions/generate-all', {
        method: 'POST',
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trade-suggestions/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trades/active'] });
      setLastRefresh(new Date());
    },
  });

  const handleGenerateAll = () => {
    generateAllMutation.mutate();
  };

  const generateAllData = generateAllMutation.data as GenerateAllResponse | undefined;

  // Auto-refresh functionality
  useEffect(() => {
    // Generate suggestions on component mount/restart
    console.log('🚀 AI Trade Suggestions component mounted - generating fresh suggestions');
    handleGenerateAll();

    // Set up 5-minute auto-refresh interval
    const autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing trade suggestions (5-minute interval)');
      handleGenerateAll();
      // Also refresh active trades
      queryClient.invalidateQueries({ queryKey: ['/api/trades/active'] });
    }, 300000); // 5 minutes = 300,000ms

    // Cleanup interval on component unmount
    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, []); // Empty dependency array ensures this runs only on mount

  // Format last refresh time for display
  const formatLastRefresh = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };
  const liveSuggestions = generateAllData?.data || [];
  const successfulSuggestions = liveSuggestions.filter((item: any) => item.success && item.suggestion);
  const failedSuggestions = liveSuggestions.filter((item: any) => !item.success);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-slate-300 text-base font-medium">AI-powered trading recommendations based on ML forecasts</p>
          <div className="text-sm text-slate-400">
            <span>Last updated: {formatLastRefresh(lastRefresh)}</span>
            <span className="mx-2">•</span>
            <span>Auto-refresh: Every 5 minutes</span>
          </div>
        </div>
        <Button
          onClick={handleGenerateAll}
          disabled={generateAllMutation.isPending}
          className="flex items-center justify-center space-x-3 bg-gradient-to-r from-purple-600/25 to-blue-600/25 hover:from-purple-600/40 hover:to-blue-600/40 border border-purple-500/40 hover:border-purple-400/60 px-6 py-3 text-white font-semibold rounded-xl transition-all duration-200 w-full md:w-auto shadow-lg hover:shadow-purple-500/20"
        >
          <RefreshCw className={`h-4 w-4 ${generateAllMutation.isPending ? 'animate-spin' : ''}`} />
          <span>Generate New Suggestions</span>
        </Button>
      </div>

      <div className="w-full space-y-4">

        {generateAllMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Generating trade suggestions...</span>
            </div>
          </div>
        )}

        {successfulSuggestions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {successfulSuggestions.map((item: any) => (
              <SuggestionCard key={item.suggestion.tradeId} suggestion={item.suggestion} />
            ))}
          </div>
        )}

        {failedSuggestions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-red-600">Failed Generations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {failedSuggestions.map((item: any) => (
                <Card key={item.symbol} className="border-red-200">
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-sm sm:text-base">{item.symbol}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-red-600 mt-1">{item.error}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!generateAllData && !generateAllMutation.isPending && (
          <div className="text-center py-8 text-muted-foreground">
            Click "Generate New Suggestions" to get the latest AI-powered trade recommendations
          </div>
        )}
      </div>
    </div>
  );
}