import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Target, BarChart3 } from 'lucide-react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ScriptableContext,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TradeData {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  actualOutcome: string;
  profitLoss?: number;
  profitLossPercent?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  confidence: number;
  createdAt: string;
  completedAt?: string;
  isSuccessful?: boolean;
  successScore?: number;
  profitablePercentage?: number;
}

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  failureRate: number;
  totalProfitLoss: number;
  profitStrength: number; // Database-backed profit strength percentage
  sampleSize: number;     // Total sample size for database calculations
  window: string;         // Time window for calculations
}

interface TradePerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradePerformanceModal({ isOpen, onClose }: TradePerformanceModalProps) {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeData | null>(null);
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [selectedWindow, setSelectedWindow] = useState<string>('24h');

  useEffect(() => {
    if (isOpen) {
      fetchTradeData();
    }
  }, [isOpen, selectedWindow]);

  const fetchTradeData = async () => {
    setLoading(true);
    try {
      console.log(`📊 Fetching trade statistics for window: ${selectedWindow}`);
      
      // Fetch database-backed trade statistics
      const response = await fetch(`/api/trade-stats?window=${selectedWindow}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Trade stats loaded: Profit Strength ${data.profitStrength}%, Failure Rate ${data.failureRate}% (${data.sampleSize} trades)`);
        
        // Convert database statistics to component format
        const dbStats = {
          totalTrades: data.sampleSize,
          winningTrades: data.breakdown.tpHitTrades,
          losingTrades: data.breakdown.slHitTrades,
          winRate: data.profitStrength, // Use profit strength as the primary win rate
          avgProfit: data.profitStrength,
          avgLoss: data.failureRate,
          bestTrade: 100, // Max possible profit
          worstTrade: 0,  // Min possible profit
          failureRate: data.failureRate,
          totalProfitLoss: data.profitStrength - data.failureRate,
          profitStrength: data.profitStrength,
          sampleSize: data.sampleSize,
          window: data.window
        };
        
        setStats(dbStats);
        setTrades([]); // Focus on database statistics, not individual trade data
      } else {
        console.error('❌ Failed to fetch trade statistics:', data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching trade statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (tradeData: TradeData[]) => {
    const completedTrades = tradeData.filter(t => t.actualOutcome !== 'IN_PROGRESS');
    const winningTrades = completedTrades.filter(t => t.isSuccessful || (t.profitLossPercent && t.profitLossPercent > 0));
    const losingTrades = completedTrades.filter(t => !t.isSuccessful && (t.profitLossPercent && t.profitLossPercent <= 0));
    
    const profits = winningTrades.map(t => t.profitLossPercent || 0);
    const losses = losingTrades.map(t => t.profitLossPercent || 0);
    
    const stats: TradeStats = {
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgProfit: profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
      bestTrade: Math.max(...completedTrades.map(t => t.profitLossPercent || 0)),
      worstTrade: Math.min(...completedTrades.map(t => t.profitLossPercent || 0)),
      failureRate: completedTrades.length > 0 ? (losingTrades.length / completedTrades.length) * 100 : 0,
      totalProfitLoss: completedTrades.reduce((sum, t) => sum + (t.profitLossPercent || 0), 0)
    };
    
    setStats(stats);
  };

  const getFilteredTrades = () => {
    return trades.filter(trade => {
      const symbolMatch = filterSymbol === 'ALL' || trade.symbol === filterSymbol;
      const directionMatch = filterDirection === 'ALL' || trade.direction === filterDirection;
      return symbolMatch && directionMatch && trade.actualOutcome !== 'IN_PROGRESS';
    });
  };

  const getFailureRateChartData = () => {
    const filteredTrades = getFilteredTrades();
    const rollingWindow = 50; // Calculate failure rate over rolling 50 trades
    const data: number[] = [];
    const labels: string[] = [];

    for (let i = rollingWindow; i <= filteredTrades.length; i++) {
      const window = filteredTrades.slice(i - rollingWindow, i);
      const failures = window.filter(t => !t.isSuccessful || (t.profitLossPercent && t.profitLossPercent <= 0));
      const failureRate = (failures.length / window.length) * 100;
      
      data.push(failureRate);
      labels.push(`Trade ${i}`);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Failure Rate (%)',
          data,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.1,
        },
      ],
    };
  };

  const getProfitDistributionData = () => {
    const filteredTrades = getFilteredTrades();
    const profits = filteredTrades.map(t => t.profitLossPercent || 0);
    
    // Create histogram bins
    const bins = 20;
    const min = Math.min(...profits);
    const max = Math.max(...profits);
    const binSize = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    const labels = Array(bins).fill(0).map((_, i) => {
      const start = min + i * binSize;
      const end = start + binSize;
      return `${start.toFixed(1)}% to ${end.toFixed(1)}%`;
    });

    profits.forEach(profit => {
      const binIndex = Math.min(Math.floor((profit - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Number of Trades',
          data: histogram,
          backgroundColor: (context: ScriptableContext<'bar'>) => {
            const index = context.dataIndex;
            const value = min + index * binSize;
            return value >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
          },
          borderColor: (context: ScriptableContext<'bar'>) => {
            const index = context.dataIndex;
            const value = min + index * binSize;
            return value >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
          },
          borderWidth: 1,
        },
      ],
    };
  };

  const symbols = Array.from(new Set(trades.map(t => t.symbol)));

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Trade Performance Analytics',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[80vh]">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading trade performance data...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[80vh] sm:h-[85vh] overflow-hidden w-[95vw] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trade Performance Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="h-full overflow-auto">
          {/* Empty State */}
          {!stats || stats.totalTrades === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
              <div className="p-8 rounded-full bg-blue-500/10">
                <BarChart3 className="h-16 w-16 text-blue-400" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-white">Building Trade Performance History</h3>
                <p className="text-muted-foreground max-w-md">
                  The system tracks completed trading performance by analyzing actual trade outcomes, 
                  profit/loss calculations, and success metrics. Analytics will populate as trades complete.
                </p>
                <div className="bg-blue-950/30 border border-blue-600/30 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-blue-300 mb-2">Trade Performance Tracking:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 text-left">
                    <li>• System executes simulated trades based on ML signals</li>
                    <li>• Tracks entry/exit prices, stop-loss, and take-profit hits</li>
                    <li>• Calculates profit/loss percentages and success rates</li>
                    <li>• Performance charts show trading effectiveness over time</li>
                  </ul>
                </div>
              </div>
              <Button 
                onClick={onClose}
                className="btn-liquid px-6 py-2"
              >
                Close
              </Button>
            </div>
          ) : (
            <>
          {/* Time Window Selector */}
          <div className="mb-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedWindow === '24h' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWindow('24h')}
                className="text-xs"
              >
                24 Hours
              </Button>
              <Button
                variant={selectedWindow === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWindow('7d')}
                className="text-xs"
              >
                7 Days
              </Button>
              <Button
                variant={selectedWindow === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedWindow('all')}
                className="text-xs"
              >
                All Time
              </Button>
            </div>
          </div>

          {/* Database-Backed Trade Statistics */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    Profit Strength
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {stats.profitStrength ? stats.profitStrength.toFixed(1) : stats.winRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.winningTrades} TP hits out of {stats.totalTrades} trades
                  </p>
                  <p className="text-xs text-green-400/70 mt-1">
                    100%: always hits profit target. 0%: avoids losses but no profit
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Failure Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-400">
                    {stats.failureRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.losingTrades} SL hits out of {stats.totalTrades} trades
                  </p>
                  <p className="text-xs text-red-400/70 mt-1">
                    Database-backed stop loss hit rate
                  </p>
                  {stats.failureRate > 30 && (
                    <Badge variant="destructive" className="mt-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Elevated
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Sample Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">
                    {stats.sampleSize || stats.totalTrades}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total completed trades ({stats.window || selectedWindow})
                  </p>
                  <p className="text-xs text-blue-400/70 mt-1">
                    Live database calculations
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <label className="text-sm font-medium">Symbol:</label>
              <select 
                value={filterSymbol} 
                onChange={(e) => setFilterSymbol(e.target.value)}
                className="ml-2 px-3 py-1 border rounded-md bg-background"
              >
                <option value="ALL">All Symbols</option>
                {symbols.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Direction:</label>
              <select 
                value={filterDirection} 
                onChange={(e) => setFilterDirection(e.target.value)}
                className="ml-2 px-3 py-1 border rounded-md bg-background"
              >
                <option value="ALL">All Directions</option>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
          </div>

          {/* Charts */}
          <Tabs defaultValue="accuracy-timeline" className="space-y-4">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1">
              <TabsTrigger value="accuracy-timeline" className="text-xs sm:text-sm">Accuracy Timeline</TabsTrigger>
              <TabsTrigger value="forecast-distribution" className="text-xs sm:text-sm">Forecast Distribution</TabsTrigger>
              <TabsTrigger value="forecast-details" className="text-xs sm:text-sm">Forecast Details</TabsTrigger>
            </TabsList>

            <TabsContent value="accuracy-timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rolling Forecast Accuracy (50-Prediction Window)</CardTitle>
                  <CardDescription>
                    Shows the accuracy of ML predictions compared to actual market movements over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 sm:h-80 lg:h-96">
                    <Line data={getFailureRateChartData()} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecast-distribution" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Forecast Accuracy Distribution</CardTitle>
                  <CardDescription>
                    Histogram showing the distribution of prediction accuracy percentages across all forecasts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 sm:h-80 lg:h-96">
                    <Bar data={getProfitDistributionData()} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>

              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg Correct Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-green-600">
                        {stats.avgProfit.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg Incorrect Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-red-600">
                        {stats.avgLoss.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Best Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-green-600">
                        {stats.bestTrade.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Worst Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold text-red-600">
                        {stats.worstTrade.toFixed(1)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="forecast-details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Trades</CardTitle>
                  <CardDescription>
                    Click on any trade to view detailed analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 sm:max-h-80 lg:max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {getFilteredTrades().slice(0, 50).map((trade) => (
                        <div
                          key={trade.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 gap-2 sm:gap-0"
                          onClick={() => setSelectedTrade(trade)}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Badge variant={trade.direction === 'LONG' ? 'default' : 'secondary'} className="text-xs">
                              {trade.direction}
                            </Badge>
                            <span className="font-medium text-sm sm:text-base">{trade.symbol}</span>
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              ${trade.entryPrice.toFixed(2)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                            <span className="text-xs sm:text-sm">
                              {trade.confidence}% confidence
                            </span>
                            {trade.profitLossPercent && (
                              <span className={`font-bold text-xs sm:text-sm ${trade.profitLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trade.profitLossPercent >= 0 ? '+' : ''}{trade.profitLossPercent.toFixed(2)}%
                              </span>
                            )}
                            <Badge variant={trade.isSuccessful ? 'default' : 'destructive'} className="text-xs">
                              {trade.actualOutcome}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Actionable Warnings */}
          {stats && stats.failureRate > 30 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Low Forecast Accuracy Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">
                  The current prediction error rate of {stats.failureRate.toFixed(1)}% is above the recommended threshold of 30%. 
                  Consider reviewing model parameters and improving prediction algorithms based on recent forecast performance.
                </p>
              </CardContent>
            </Card>
          )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}