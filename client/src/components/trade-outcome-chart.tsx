/**
 * Trade Outcome Chart Component
 * Interactive modal for analyzing trade performance and failure rates
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
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
  TimeScale
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface TradeOutcome {
  signal_id: string;
  symbol: string;
  timestamp: string;
  entry_price: number;
  exit_price: number;
  realized_pnl_percent: number;
  realized_pnl: number;
  max_favorable_excursion: number;
  max_adverse_excursion: number;
  hit_stop_loss: boolean;
  trade_direction: 'LONG' | 'SHORT';
  confidence_score: number;
  risk_reward_ratio: number;
  warnings: string[];
  forecast_path: number[];
  actual_path: number[];
}

interface TradeStats {
  total_trades: number;
  win_rate: number;
  avg_profit: number;
  avg_loss: number;
  best_trade: number;
  worst_trade: number;
  avg_hit_rate_tp: number;
  avg_hit_rate_sl: number;
  failure_rate: number;
}

interface TradeOutcomeChartProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TradeOutcomeChart({ isOpen, onClose }: TradeOutcomeChartProps) {
  const [trades, setTrades] = useState<TradeOutcome[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<TradeOutcome | null>(null);

  const symbols = ['ALL', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];

  useEffect(() => {
    if (isOpen) {
      fetchTradeData();
    }
  }, [isOpen]);

  const fetchTradeData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 [TRADE OUTCOME CHART] Fetching real trade data...');
      
      const response = await fetch('/api/trade-outcomes');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trade data');
      }
      
      console.log(`📊 [TRADE OUTCOME CHART] Received ${result.data.trades.length} trades`);
      
      // Transform the data to match our interface
      const transformedTrades: TradeOutcome[] = result.data.trades.map((trade: any) => ({
        signal_id: trade.signal_id?.toString() || '',
        symbol: trade.symbol || '',
        timestamp: trade.timestamp || '',
        entry_price: Number(trade.entry_price) || 0,
        exit_price: Number(trade.exit_price) || Number(trade.entry_price) || 0,
        realized_pnl_percent: Number(trade.realized_pnl_percent) || 0,
        realized_pnl: Number(trade.realized_pnl) || 0,
        max_favorable_excursion: Number(trade.max_favorable_excursion) || 0,
        max_adverse_excursion: Number(trade.max_adverse_excursion) || 0,
        hit_stop_loss: Boolean(trade.hit_stop_loss),
        trade_direction: (trade.trade_direction || 'WAIT') as 'LONG' | 'SHORT',
        confidence_score: Number(trade.confidence_score) || 0,
        risk_reward_ratio: Number(trade.risk_reward_ratio) || 1,
        warnings: Array.isArray(trade.warnings) ? trade.warnings : [],
        forecast_path: Array.isArray(trade.forecast_path) ? trade.forecast_path : [],
        actual_path: Array.isArray(trade.actual_path) ? trade.actual_path : []
      }));

      // Apply filters
      const filteredTrades = transformedTrades.filter(trade => {
        const symbolMatch = filterSymbol === 'ALL' || trade.symbol === filterSymbol;
        const directionMatch = filterDirection === 'ALL' || trade.trade_direction === filterDirection;
        return symbolMatch && directionMatch;
      });

      setTrades(filteredTrades);
      setStats(result.data.stats);
      
      console.log(`📊 [TRADE OUTCOME CHART] Successfully loaded ${filteredTrades.length} trades with ${result.data.stats.win_rate.toFixed(1)}% win rate`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load trade data';
      setError(errorMessage);
      console.error('❌ [TRADE OUTCOME CHART] Error fetching trade data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTradeData();
    }
  }, [filterSymbol, filterDirection]);

  const getFailureRateChartData = () => {
    const last500Trades = trades.slice(0, 500);
    console.log(`📊 [INDIVIDUAL TRADE CHART] Processing ${last500Trades.length} trades for individual point analysis`);
    
    if (last500Trades.length === 0) {
      console.log(`⚠️ [INDIVIDUAL TRADE CHART] No trades available for analysis`);
      return {
        labels: ['No Data'],
        datasets: [
          {
            label: 'Trade Performance',
            data: [0],
            backgroundColor: 'rgba(107, 114, 128, 0.7)',
            borderColor: 'rgb(107, 114, 128)',
            borderWidth: 1
          }
        ]
      };
    }
    
    // Group trades into batches of 25 for cleaner visualization
    const batchSize = 25;
    const batches = [];
    
    for (let i = 0; i < last500Trades.length; i += batchSize) {
      const batchTrades = last500Trades.slice(i, i + batchSize);
      const successfulTrades = batchTrades.filter(trade => 
        !trade.hit_stop_loss && trade.realized_pnl_percent >= 0
      ).length;
      const successRate = (successfulTrades / batchTrades.length) * 100;
      
      // Calculate average profit for the batch
      const avgProfit = batchTrades.reduce((sum, trade) => 
        sum + (trade.realized_pnl_percent || 0), 0) / batchTrades.length;
      
      batches.push({
        batchNumber: Math.floor(i / batchSize) + 1,
        successRate: successRate,
        avgProfit: avgProfit,
        tradeCount: batchTrades.length
      });
    }

    console.log(`📊 [INDIVIDUAL TRADE CHART] Generated ${batches.length} trade batches`);

    return {
      labels: batches.map(batch => `Batch ${batch.batchNumber}`),
      datasets: [
        {
          label: 'Success Rate (%)',
          data: batches.map(batch => batch.successRate),
          backgroundColor: batches.map(batch => 
            batch.successRate >= 50 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
          ),
          borderColor: batches.map(batch => 
            batch.successRate >= 50 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    };
  };

  const getProfitDistributionData = () => {
    const bins = [-10, -5, -2, -1, 0, 1, 2, 5, 10, 20];
    const distribution = bins.map((bin, i) => {
      const nextBin = bins[i + 1] || Infinity;
      const count = trades.filter(t => t.realized_pnl_percent >= bin && t.realized_pnl_percent < nextBin).length;
      return count;
    });

    return {
      labels: bins.map((bin, i) => {
        const nextBin = bins[i + 1];
        return nextBin ? `${bin}% to ${nextBin}%` : `${bin}%+`;
      }),
      datasets: [
        {
          label: 'Number of Trades',
          data: distribution,
          backgroundColor: distribution.map((_, i) => 
            bins[i] >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderColor: distribution.map((_, i) => 
            bins[i] >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 1
        }
      ]
    };
  };

  const getForecastRealizationData = () => {
    if (!selectedTrade) return null;

    const timeLabels = Array.from({ length: 20 }, (_, i) => `${i + 1}min`);

    return {
      labels: timeLabels,
      datasets: [
        {
          label: 'Forecasted Path',
          data: selectedTrade.forecast_path,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          pointRadius: 2
        },
        {
          label: 'Actual Path',
          data: selectedTrade.actual_path,
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          tension: 0.4,
          pointRadius: 2
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 7,
        borderWidth: 2
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#ffffff', // White text for legend
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
          title: function(context: any) {
            const dataIndex = context[0].dataIndex;
            return `Batch ${dataIndex + 1} (25 trades)`;
          },
          label: function(context: any) {
            const value = context.parsed.y;
            const performance = value >= 50 ? 'Strong Performance' : 'Needs Improvement';
            const icon = value >= 50 ? '🟢' : '🔴';
            return `${icon} ${performance}: ${value.toFixed(1)}% Success Rate`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#ffffff', // White text for x-axis
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)' // Light grid lines
        }
      },
      y: {
        display: true,
        beginAtZero: false,
        ticks: {
          color: '#ffffff',
          font: {
            size: 11
          },
          callback: function(value: any) {
            return value + '%';
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)',
          drawBorder: false
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 [&>button]:text-white [&>button]:hover:text-gray-300">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-white" />
            Trade Performance Analysis
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
            <Button 
              onClick={fetchTradeData} 
              variant="outline" 
              size="sm" 
              className="mt-2 border-red-500/30 text-red-400 hover:bg-red-900/20"
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && stats && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-4">
              <Select value={filterSymbol} onValueChange={setFilterSymbol}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="All Symbols" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {symbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol} className="text-white hover:bg-gray-700">{symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDirection} onValueChange={setFilterDirection}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="All Directions" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="ALL" className="text-white hover:bg-gray-700">All Directions</SelectItem>
                  <SelectItem value="LONG" className="text-white hover:bg-gray-700">LONG Only</SelectItem>
                  <SelectItem value="SHORT" className="text-white hover:bg-gray-700">SHORT Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Total Trades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.total_trades}</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {(stats.win_rate || 0).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Avg Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    +{(stats.avg_profit || 0).toFixed(2)}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-300">Failure Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-400">
                    {(stats.failure_rate || 0).toFixed(1)}%
                  </div>
                  {(stats.failure_rate || 0) > 30 && (
                    <Badge variant="destructive" className="mt-1 bg-red-900/30 text-red-400 border-red-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Elevated
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="failure-rate" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="failure-rate">Success Rate Batches</TabsTrigger>
                <TabsTrigger value="profit-distribution">Profit Distribution</TabsTrigger>
                <TabsTrigger value="forecast-realization">Forecast Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="failure-rate" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Trade Performance Batches</CardTitle>
                    <CardDescription className="text-gray-400">
                      Success rate analysis grouped into batches of 25 trades for clearer trend visualization
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-xs text-gray-400">
                      Analyzing {Math.min(trades.length, 500)} trades • Each bar represents success rate of 25 consecutive trades
                    </div>
                    <div className="h-80">
                      <Bar data={getFailureRateChartData()} options={chartOptions} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profit-distribution" className="mt-4">
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Profit/Loss Distribution</CardTitle>
                    <CardDescription className="text-gray-400">
                      Distribution of trade outcomes by P&L percentage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <Bar data={getProfitDistributionData()} options={chartOptions} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="forecast-realization" className="mt-4">
                <div className="space-y-4">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white">Select a Trade for Forecast Analysis</CardTitle>
                      <CardDescription className="text-gray-400">
                        Click on a trade to see its 20-minute forecast vs actual path
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                        {trades.slice(0, 12).map((trade) => (
                          <Button
                            key={trade.signal_id}
                            variant={selectedTrade?.signal_id === trade.signal_id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTrade(trade)}
                            className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                          >
                            {trade.symbol} {trade.trade_direction} {(trade.realized_pnl_percent || 0).toFixed(1)}%
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedTrade && (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">
                          {selectedTrade.symbol} {selectedTrade.trade_direction} - 
                          {(selectedTrade.realized_pnl_percent || 0).toFixed(2)}% P&L
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          Entry: ${(selectedTrade.entry_price || 0).toFixed(4)} | 
                          Exit: ${(selectedTrade.exit_price || 0).toFixed(4)} | 
                          Confidence: {(selectedTrade.confidence_score || 0).toFixed(1)}%
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <Line data={getForecastRealizationData()!} options={chartOptions} />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}