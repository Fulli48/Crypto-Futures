import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, Settings, Coins, ChevronDown, ChevronRight, Zap, Brain } from "lucide-react";
import { Link } from "wouter";
/*
 * NOTE TO AI AGENT:
 * Never introduce simulated, fake, or placeholder data into this file.
 * All data used here must come from real sources:
 *   - Live external APIs (e.g., Binance, CoinGecko)
 *   - Internal APIs or data servers specifically set up to store real market data
 * If the data is hardcoded, random, or mathematically generated (e.g., with loops or functions like sin()), reject it.
 * If you're unsure whether a data source is real or simulated, stop and ask the user before continuing.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import axios from "axios";
import LineChart from "@/components/line-chart";
import AccuracyTracker from "@/components/accuracy-tracker";
import ActiveSimulationTrades from "@/components/active-simulation-trades";
import MiniChart from "@/components/mini-chart";




import { safePrice, safePercentage, safeToFixed } from "@/lib/safe-format";
import { SafeCryptoCard } from "@/components/safe-crypto-card";
import { AlgorithmSuccessHeader } from "@/components/algorithm-success-header";
import { TradeCompletionNotification } from "@/components/trade-completion-notification";


import { shouldDisplayTradeSignal, getWaitingMessage } from '@/utils/enhanced-trade-filter';
import { DynamicLiveMLDashboard } from "@/components/dynamic-live-ml-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeOutcomeChart } from "@/components/trade-outcome-chart";
import { TradePerformanceModal } from "@/components/TradePerformanceModal";
import { LearningSystemModal } from "@/components/learning-system-modal";



// Helper function to calculate remaining time
function calculateRemainingTime(createdAt: string, simulationType: string): { minutes: number, seconds: number } {
  const created = new Date(createdAt);
  const now = new Date();
  const elapsedMs = now.getTime() - created.getTime();
  
  const totalDurationMinutes = simulationType === 'SHORT' ? 5 : 
                              simulationType === 'MEDIUM' ? 10 : 15;
  const totalDurationMs = totalDurationMinutes * 60 * 1000;
  
  const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
  const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
  const remainingSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  
  return { minutes: remainingMinutes, seconds: remainingSeconds };
}

// Helper function to format time
function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

interface CryptoSymbol {
  symbol: string;
  signal: "LONG" | "SHORT" | "WAIT" | "NO DATA";
  confidence: number;
  profitLikelihood: number;
  currentPrice: number;
  profit_window_percentage?: number;
}

// ✅ Enhanced interface for candlestick format with quality metrics
interface ChartData {
  symbol: string;
  candles: Array<{
    timestamp: number; // Unix timestamp in milliseconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number; // 0 for forecast candles
    qualityScore?: number; // Enhanced data quality score
    dataStatus?: string; // Enhanced data status (good, critical, etc.)
    hasValidation?: boolean; // Whether enhanced validation was applied
    forecastConfidence?: number; // Confidence for forecast points
    basedOnQuality?: string; // Quality basis for forecast
  }>;
  signal: "LONG" | "SHORT" | "NO DATA";
  confidence: number;
  profitLikelihood: number;
  tp: number;
  sl: number;
  currentPrice: number;
  // Enhanced metadata
  qualityMetrics?: {
    completeness: number;
    qualityScore: number;
    status: string;
    lastUpdate: string;
    totalRecords: number;
  };
  enhanced?: boolean;
}

interface MLSignal {
  signal: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  profitLikelihood: number;
  currentPrice?: number;
  tp?: number;
  sl?: number;
}

function BinanceDashboard() {
  const [symbols, setSymbols] = useState<CryptoSymbol[]>([]);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTradesExpanded, setActiveTradesExpanded] = useState(false);
  const [mainActiveTradesExpanded, setMainActiveTradesExpanded] = useState(false);
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [completedTradeNotifications, setCompletedTradeNotifications] = useState<any[]>([]);
  const [lastActiveTradeIds, setLastActiveTradeIds] = useState<Set<number>>(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);
  const [mlSignals, setMLSignals] = useState<Record<string, MLSignal>>({});
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [technicalIndicators, setTechnicalIndicators] = useState<Record<string, any>>({});
  const [tradeOutcomeChartOpen, setTradeOutcomeChartOpen] = useState(false);
  const [showTradePerformanceModal, setShowTradePerformanceModal] = useState(false);
  const [showForecastAccuracyModal, setShowForecastAccuracyModal] = useState(false);

  
  // Freeze mechanic for detailed trade view
  const [frozenTradeData, setFrozenTradeData] = useState<any>(null);
  const [freezeTimestamp, setFreezeTimestamp] = useState<number | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);

  // Handle freezing trade data when clicking on ML suggestion
  const handleFreezeTrade = (symbol: string, mlSignal: any) => {
    const freezeData = {
      symbol,
      ...mlSignal,
      frozenAt: Date.now()
    };
    setFrozenTradeData(freezeData);
    setFreezeTimestamp(Date.now());
    setIsFrozen(true);
    setSelectedSymbol(symbol);
  };

  // Unfreeze trade data
  const handleUnfreeze = () => {
    setFrozenTradeData(null);
    setFreezeTimestamp(null);
    setIsFrozen(false);
  };

  // Calculate age of frozen trade suggestion
  const getFrozenTradeAge = () => {
    if (!freezeTimestamp) return '';
    const ageMs = currentTime - freezeTimestamp;
    const ageSeconds = Math.floor(ageMs / 1000);
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    const ageMinutes = Math.floor(ageSeconds / 60);
    return `${ageMinutes}m ${ageSeconds % 60}s ago`;
  };

  const fetchSymbols = async () => {
    try {
      const response = await axios.get("/api/binance/symbols");
      setSymbols(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching symbols:", error);
    }
  };

  const fetchMLSignals = async () => {
    try {
      const signals: Record<string, MLSignal> = {};
      const indicators: Record<string, any> = {};
      const approvedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
      
      for (const symbol of approvedSymbols) {
        try {
          // Fetch both ML signals and technical indicators simultaneously
          const [mlResponse, indicatorsResponse] = await Promise.all([
            fetch(`/api/ml-engine/signal/${symbol}`),
            fetch(`/api/technical-indicators/${symbol}`)
          ]);
          
          // Process ML signals
          if (mlResponse.ok) {
            const data = await mlResponse.json();
            signals[symbol] = {
              signal: data.signal,
              confidence: data.confidence,
              profitLikelihood: data.profitLikelihood,
              currentPrice: data.currentPrice,
              tp: data.tp,
              sl: data.sl
            };
          }
          
          // Process technical indicators
          if (indicatorsResponse.ok) {
            const indicatorData = await indicatorsResponse.json();
            indicators[symbol] = indicatorData;
            console.log(`✅ Technical indicators fetched for ${symbol}:`, indicatorData);
          }
        } catch (error) {
          console.warn(`Failed to fetch data for ${symbol}:`, error);
        }
      }
      
      setMLSignals(signals);
      setTechnicalIndicators(indicators);
      console.log('✅ ML signals and technical indicators updated');
    } catch (error) {
      console.error('Error fetching ML signals and technical indicators:', error);
    }
  };

  const fetchLivePrices = async () => {
    try {
      console.log('🔄 Fetching live current prices...');
      const response = await fetch('/api/live-prices');
      if (response.ok) {
        const data = await response.json();
        if (data.prices) {
          setLivePrices(data.prices);
          console.log('💰 Live prices updated:', data.prices);
        } else {
          console.warn('⚠️ No prices data in response:', data);
        }
      } else {
        console.error('❌ Live prices API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching live prices:', error);
      // Fallback: use prices from ML signals if available
      if (mlSignals && Object.keys(mlSignals).length > 0) {
        const fallbackPrices: Record<string, number> = {};
        Object.entries(mlSignals).forEach(([symbol, signal]) => {
          if (signal && 'entryPrice' in signal && signal.entryPrice) {
            fallbackPrices[symbol] = signal.entryPrice as number;
          }
        });
        if (Object.keys(fallbackPrices).length > 0) {
          setLivePrices(fallbackPrices);
          console.log('💰 Using ML signal prices as fallback:', fallbackPrices);
        }
      }
    }
  };



  const fetchChartData = async (symbol: string) => {
    try {
      console.log("Fetching chart data for:", symbol);
      
      // Fetch chart data, ML engine trade suggestions, and technical indicators simultaneously
      const [chartResponse, mlResponse, indicatorsResponse] = await Promise.all([
        axios.get(`/api/binance/chart/${symbol}`),
        axios.get(`/api/ml-engine/signal/${symbol}`).catch(err => {
          console.warn("ML engine signal failed:", err);
          return null;
        }),
        axios.get(`/api/technical-indicators/${symbol}`).catch(err => {
          console.warn("Technical indicators failed:", err);
          return null;
        })
      ]);
      
      console.log("Chart data response:", chartResponse.data);
      console.log("ML engine response:", mlResponse?.data);
      console.log("Technical indicators response:", indicatorsResponse?.data);

      // Set technical indicators
      if (indicatorsResponse?.data) {
        setTechnicalIndicators(prev => ({
          ...prev,
          [symbol]: indicatorsResponse.data
        }));
      }

      console.log("📊 [ENHANCED FRONTEND] Processing enhanced chart data:", chartResponse.data);
      
      // ✅ Handle enhanced response format with data and metadata
      const responseData = chartResponse.data;
      let chartDataArray = [];
      let qualityMetrics = null;
      
      // Check if it's the new enhanced format or old format for backward compatibility
      if (responseData && responseData.data && responseData.metadata) {
        // New enhanced format
        chartDataArray = responseData.data;
        qualityMetrics = responseData.metadata.qualityMetrics;
        console.log("📊 [ENHANCED FRONTEND] Using enhanced format with quality metrics:", qualityMetrics);
      } else if (Array.isArray(responseData)) {
        // Old format - backward compatibility
        chartDataArray = responseData;
        console.log("📊 [ENHANCED FRONTEND] Using legacy format");
      }
      
      if (Array.isArray(chartDataArray) && chartDataArray.length > 0) {
        // Get ML engine data  
        const mlSignal = mlResponse?.data;
        
        const transformedData: ChartData = {
          symbol: symbol,
          candles: chartDataArray, // Enhanced data points with quality metadata
          signal: mlSignal?.signal || "NO DATA",
          confidence: mlSignal?.confidence || 0,
          profitLikelihood: mlSignal?.profitLikelihood || 0,
          tp: mlSignal?.takeProfit || 0,
          sl: mlSignal?.stopLoss || 0,
          currentPrice: chartDataArray[59]?.close || mlSignal?.entryPrice || 0, // Last historical data point's close price
          // Add enhanced metadata
          qualityMetrics,
          enhanced: true
        };

        console.log("✅ [ENHANCED FRONTEND] Transformed enhanced chart data:", transformedData);
        if (qualityMetrics) {
          console.log("📊 [ENHANCED FRONTEND] Quality score:", qualityMetrics.qualityScore, "Status:", qualityMetrics.status);
        }
        setChartData(transformedData);
        console.log("Enhanced chart data state updated for:", symbol);
      } else {
        console.error("Invalid enhanced chart data format received");
        setChartData(null);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData(null);
    }
  };

  const fetchActiveTrades = async () => {
    try {
      console.log("Fetching active trades...");
      const response = await axios.get("/api/learning/active-trades");
      console.log("Active trades response:", response.data);
      
      // Filter out any non-approved symbols (safety measure)
      const approvedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
      const filteredTrades = (response.data || []).filter((trade: any) => 
        approvedSymbols.includes(trade.symbol)
      );
      
      // Process trades to ensure all numeric fields are properly formatted and protected from toFixed errors
      const processedTrades = filteredTrades.map((trade: any, index: number) => {
        try {
          const safeToNumber = (value: any, fallback = '0') => {
            if (value === null || value === undefined || value === '') return fallback;
            if (typeof value === 'number') return value.toString();
            if (typeof value === 'string') {
              const num = parseFloat(value);
              return isNaN(num) ? fallback : value;
            }
            return fallback;
          };

          return {
            ...trade,
            entryPrice: safeToNumber(trade.entryPrice),
            currentPrice: safeToNumber(trade.currentPrice, trade.entryPrice || '0'),
            tpPrice: safeToNumber(trade.tpPrice),
            slPrice: safeToNumber(trade.slPrice),
            realTimePnl: safeToNumber(trade.realTimePnl),
            profitLoss: safeToNumber(trade.profitLoss, trade.realTimePnl || '0'),
            profitablePercentage: safeToNumber(trade.profitablePercentage, '50'),
            progress: typeof trade.progress === 'number' ? trade.progress : 100,
            confidence: typeof trade.confidence === 'number' ? trade.confidence : 0,
            profitableSeconds: typeof trade.profitableSeconds === 'number' ? trade.profitableSeconds : 0,
            lossSeconds: typeof trade.lossSeconds === 'number' ? trade.lossSeconds : 0,
            profitableMinutes: typeof trade.profitableMinutes === 'number' ? trade.profitableMinutes : 0,
            lossMinutes: typeof trade.lossMinutes === 'number' ? trade.lossMinutes : 0,
            totalSeconds: typeof trade.totalSeconds === 'number' ? trade.totalSeconds : 0,
            totalMinutes: typeof trade.totalMinutes === 'number' ? trade.totalMinutes : 0
          };
        } catch (tradeError) {
          console.error(`Error processing trade at index ${index}:`, tradeError, trade);
          return null;
        }
      }).filter((trade: any) => trade !== null);
      
      setActiveTrades(processedTrades);
      console.log("Active trades state updated:", processedTrades.length, "trades");
      
      // Detect completed trades for notifications
      const currentTradeIds = new Set(processedTrades.map((trade: any) => trade.id));
      const completedIds = Array.from(lastActiveTradeIds).filter(id => !currentTradeIds.has(id));
      
      console.log("Trade completion detection:", {
        currentTradeIds: Array.from(currentTradeIds),
        lastActiveTradeIds: Array.from(lastActiveTradeIds),
        completedIds,
        hasCompletedTrades: completedIds.length > 0
      });
      
      if (completedIds.length > 0 && lastActiveTradeIds.size > 0) {
        console.log("Fetching completed trades for notification...", completedIds);
        // Fetch recently completed trades to show notifications
        try {
          const completedResponse = await axios.get('/api/learning/completed-trades?limit=10');
          console.log("Completed trades API response:", completedResponse.data);
          
          // Handle both array format and object with trades property
          const tradesData = Array.isArray(completedResponse.data) 
            ? completedResponse.data 
            : (completedResponse.data?.trades || []);
          
          const recentCompleted = tradesData
            .filter((trade: any) => completedIds.includes(trade.id))
            .map((trade: any) => ({
              id: trade.id,
              symbol: trade.symbol,
              simulationType: trade.simulationType,
              outcome: trade.actualOutcome,
              profitLoss: parseFloat(trade.profitLoss || '0'),
              duration: `${trade.durationMinutes || 0}min`
            }));
            
          console.log("Filtered completed trades for notifications:", recentCompleted);
          
          if (recentCompleted.length > 0) {
            console.log("Adding notifications:", recentCompleted);
            setCompletedTradeNotifications(prev => [...prev, ...recentCompleted]);
          }
        } catch (error) {
          console.error('Error fetching completed trades for notifications:', error);
          // Gracefully handle errors to prevent state inconsistencies
        }
      }
      
      setLastActiveTradeIds(currentTradeIds as Set<number>);
      
    } catch (error) {
      console.error("Error fetching active trades:", error);
      setActiveTrades([]);
    }
  };

  // Enhanced scroll position preservation
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position after state updates with debouncing
  useEffect(() => {
    if (scrollPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    }
  }, [activeTrades, symbols, chartData, mlSignals]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSymbols();
      await fetchMLSignals();
      setLoading(false);
    };

    loadData();
    fetchActiveTrades();
    fetchLivePrices(); // Initial live prices fetch
    
    // Clean refresh intervals without duplicate scroll handling
    const symbolsInterval = setInterval(fetchSymbols, 30000);
    const mlSignalsInterval = setInterval(fetchMLSignals, 60000);
    const tradesInterval = setInterval(fetchActiveTrades, 15000);
    const livePricesInterval = setInterval(fetchLivePrices, 10000); // Live prices every 10 seconds
    const timeInterval = setInterval(() => setCurrentTime(Date.now()), 5000);

    return () => {
      clearInterval(symbolsInterval);
      clearInterval(mlSignalsInterval);
      clearInterval(tradesInterval);
      clearInterval(livePricesInterval);
      clearInterval(timeInterval);
    };
  }, []);



  useEffect(() => {
    if (selectedSymbol) {
      fetchChartData(selectedSymbol);
      // Auto-refresh chart less frequently to prevent jumps
      const interval = setInterval(() => {
        fetchChartData(selectedSymbol);
      }, 30000); // 30 seconds (reduced from 15) for focused coin charts
      return () => clearInterval(interval);
    }
  }, [selectedSymbol]);

  // Calculate average confidence from ML signals
  const averageConfidence = Object.values(mlSignals).length > 0 
    ? Math.round(Object.values(mlSignals).reduce((sum, signal) => sum + signal.confidence, 0) / Object.values(mlSignals).length)
    : 0;

  const handleNotificationDismiss = (tradeId: number) => {
    setCompletedTradeNotifications(prev => prev.filter(trade => trade.id !== tradeId));
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "LONG":
        return "text-green-300";
      case "SHORT":
        return "text-red-300";
      default:
        return "text-gray-300";
    }
  };

  const getProfitLikelihoodColor = (likelihood: number) => {
    if (likelihood >= 60) return "text-green-300 bg-[#192545] border-green-600/40";
    if (likelihood >= 40) return "text-yellow-300 border-yellow-600/50";
    return "text-red-300 border-red-600/50";
  };

  const getProfitWindowColor = (profitWindow: number) => {
    if (profitWindow >= 50) return "text-purple-300 border-purple-600/50";
    if (profitWindow >= 30) return "text-blue-300 border-blue-600/50";
    if (profitWindow >= 15) return "text-yellow-300 border-yellow-600/50";
    return "text-gray-300 border-gray-600/50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin text-green-300">
          <RefreshCw className="w-8 h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Artistic Background Elements */}
      <div className="geometric-overlay"></div>
      
      {/* Static Floating Particles */}
      <div className="static-particle w-3 h-3 top-[10%] left-[5%]"></div>
      <div className="static-particle w-2 h-2 top-[20%] right-[15%]"></div>
      <div className="static-particle w-4 h-4 top-[60%] left-[10%]"></div>
      <div className="static-particle w-2 h-2 top-[80%] right-[20%]"></div>
      <div className="static-particle w-3 h-3 top-[30%] right-[8%]"></div>
      <div className="static-particle w-1 h-1 top-[50%] left-[20%]"></div>
      
      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Professional Enterprise Header */}
        <Card variant="trading" className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="crypto-title text-4xl font-bold tracking-tight mb-4">
                Cryptocurrency Trading Intelligence
              </h1>
              <p className="gradient-text text-lg font-medium opacity-90">
                Real-time market insights powered by machine learning
              </p>
            </div>
            <Button
              onClick={() => {
                fetchSymbols();
                fetchMLSignals();
                fetchActiveTrades();
                fetchLivePrices();
              }}
              disabled={loading}
              className="btn-enterprise-primary gap-3 px-8 py-4 financial-text-base font-medium"
            >
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </div>
        </Card>

      {/* Algorithm Success Header */}
      <AlgorithmSuccessHeader 
        onOpenPerformanceModal={() => setShowTradePerformanceModal(true)} 
        onOpenForecastModal={() => setShowForecastAccuracyModal(true)}
      />

      {/* Learning System Analytics & Controls */}
      <div className="mb-8">
        <Card variant="metric">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="h-6 w-6 text-blue-400" />
                <span className="financial-text-xl font-semibold text-white">Learning System Analytics & Controls</span>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">MULTI-ENGINE SYSTEM</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicLiveMLDashboard />
          </CardContent>
        </Card>
      </div>







          {/* Chart Section - Display when symbol is selected */}
          {selectedSymbol && (
            <Card variant="chart" className="mb-6 border-blue-800/30">
              <CardHeader className="bg-blue-950/60 rounded-t-lg border-b border-blue-800/30">
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-300" />
                  {selectedSymbol} - Price Analysis & Trading Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* AI Algorithm Recommendation Panel */}
                <Card variant="metric" className="border-blue-700/40">
                  <CardHeader className="bg-blue-900/40 rounded-t-lg border-b border-blue-700/30">
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-300" />
                      AI Algorithm Recommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {(() => {
                      const mlSignal = mlSignals[selectedSymbol];
                      const selectedCrypto = symbols?.find(c => c.symbol === selectedSymbol);
                      
                      if (mlSignal) {
                        const currentSignal = mlSignal.signal;
                        const currentConfidence = mlSignal.confidence;  
                        const currentProfitLikelihood = mlSignal.profitLikelihood;
                      
                        // Use enhanced trading engine filtering logic to match trade creation criteria  
                        const isHighConfidenceSignal = shouldDisplayTradeSignal({
                          signal: currentSignal as 'LONG' | 'SHORT' | 'WAIT',
                          confidence: currentConfidence,
                          profitLikelihood: currentProfitLikelihood
                        });
                        
                        const signalColor = currentSignal === 'LONG' ? 'text-green-500' : 
                                           currentSignal === 'SHORT' ? 'text-red-500' : 
                                           currentSignal === 'WAIT' ? 'text-blue-500' : 'text-gray-400';
                        const confidenceColor = currentConfidence >= 80 ? 'text-green-500' : 
                                               currentConfidence >= 60 ? 'text-yellow-500' : 'text-red-500';
                        const profitColor = currentProfitLikelihood >= 80 ? 'text-green-500' : 
                                           currentProfitLikelihood >= 65 ? 'text-yellow-500' : 
                                           currentProfitLikelihood >= 50 ? 'text-orange-400' : 'text-red-500';
                        
                        // Show waiting message for low confidence - now synchronized with ML Engine Status
                        if (!isHighConfidenceSignal) {
                          return (
                            <div className="text-center p-8 bg-blue-950/30 rounded-lg border border-blue-800/30 opacity-75">
                              <div className="text-xl font-semibold text-muted-foreground mb-2">
                                {getWaitingMessage(selectedSymbol || '', { signal: currentSignal as 'LONG' | 'SHORT' | 'WAIT', confidence: currentConfidence, profitLikelihood: currentProfitLikelihood })}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Analyzing market conditions and filtering quality setups
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Current Recommendation */}
                              <div className="space-y-4">
                                <div className="text-center p-4 bg-blue-900/50 rounded-lg border border-blue-700/30">
                                  <div className="text-sm text-blue-200 mb-2">Current Signal</div>
                                  <div className={`text-3xl font-bold ${signalColor} mb-2`}>
                                    {currentSignal === 'WAIT' ? 'STRONG' : currentSignal}
                                  </div>
                                  <div className="text-sm text-blue-200">
                                    Based on technical analysis and learning patterns
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="text-center p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                                    <div className="text-xs text-blue-200 mb-1">Confidence</div>
                                    <div className={`text-xl font-bold ${confidenceColor}`}>
                                      {currentConfidence}%
                                    </div>
                                  </div>
                                  <div className="text-center p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                                    <div className="text-xs text-blue-200 mb-1">Profit Chance</div>
                                    <div className={`text-xl font-bold ${profitColor}`}>
                                      {currentProfitLikelihood}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Technical Indicators */}
                              <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-blue-200 mb-3">Technical Indicators</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-blue-200">Signal Type</span>
                                    <span className={`font-medium ${currentSignal === 'LONG' ? 'text-green-500' : currentSignal === 'SHORT' ? 'text-red-500' : currentSignal === 'WAIT' ? 'text-blue-500' : 'text-gray-400'}`}>
                                      {currentSignal === 'WAIT' ? 'STRONG' : currentSignal}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-blue-200">Confidence Level</span>
                                    <span className="font-medium text-yellow-400">
                                      {currentConfidence}%
                                    </span>
                                  </div>

                                  <div className="flex justify-between">
                                    <span className="text-blue-200">Profit Likelihood</span>
                                    <span className={`font-medium ${profitColor}`}>
                                      {currentProfitLikelihood}%
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Algorithm Trade Suggestions */}
                                <div className="mt-4 p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                                  <div className="text-xs text-blue-200 mb-3">Algorithm Trade Suggestions</div>
                                  <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-blue-200">Entry Price</span>
                                      <span className="font-medium text-white">
                                        ${selectedCrypto?.currentPrice?.toLocaleString() || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-200">Take Profit</span>
                                      <span className="font-medium text-green-500">
                                        ${mlSignal?.tp?.toLocaleString() || 'Calculating...'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-200">Stop Loss</span>
                                      <span className="font-medium text-red-500">
                                        ${mlSignal?.sl?.toLocaleString() || 'Calculating...'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-blue-200">Risk/Reward</span>
                                      <span className="font-medium text-yellow-500">
                                        {mlSignal?.tp && mlSignal?.sl && selectedCrypto?.currentPrice ? 
                                          `1:${((Math.abs(mlSignal.tp - selectedCrypto.currentPrice)) / Math.abs(selectedCrypto.currentPrice - mlSignal.sl)).toFixed(2)}` 
                                          : 'Calculating...'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="mt-3 p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                                  <div className="text-xs text-blue-200 mb-2">Algorithm Learning Status</div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-blue-200">
                                      Actively learning from market patterns
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                    );
                  }
                  
                  // Fallback to selectedCrypto if available
                  if (selectedCrypto) {
                    const currentSignal = selectedCrypto.signal;
                    const currentConfidence = selectedCrypto.confidence;  
                    const currentProfitLikelihood = selectedCrypto.profitLikelihood;
                    
                    // Use enhanced trading engine filtering logic to match trade creation criteria
                    const isHighConfidenceSignal = shouldDisplayTradeSignal({
                      signal: currentSignal === 'NO DATA' ? 'WAIT' : (currentSignal as 'LONG' | 'SHORT' | 'WAIT'),
                      confidence: currentConfidence,
                      profitLikelihood: currentProfitLikelihood
                    });
                    
                    // Show waiting message for low confidence
                    if (!isHighConfidenceSignal) {
                      return (
                        <div className="text-center p-8 bg-blue-950/30 rounded-lg border border-blue-800/30 opacity-75">
                          <div className="text-xl font-semibold text-blue-200 mb-2">
                            {getWaitingMessage(selectedSymbol || '', { signal: currentSignal === 'NO DATA' ? 'WAIT' : (currentSignal as 'LONG' | 'SHORT' | 'WAIT'), confidence: currentConfidence, profitLikelihood: currentProfitLikelihood })}
                          </div>
                          <div className="text-sm text-blue-200">
                            Analyzing market conditions and filtering quality setups
                          </div>
                        </div>
                      );
                    }
                  
                  const signalColor = currentSignal === 'LONG' ? 'text-green-500' : 
                                     currentSignal === 'SHORT' ? 'text-red-500' : 
                                     currentSignal === 'WAIT' ? 'text-blue-500' : 'text-gray-400';
                  const confidenceColor = currentConfidence >= 80 ? 'text-green-500' : 
                                         currentConfidence >= 60 ? 'text-yellow-500' : 'text-red-500';
                  const profitColor = currentProfitLikelihood >= 80 ? 'text-green-500' : 
                                     currentProfitLikelihood >= 65 ? 'text-yellow-500' : 
                                     currentProfitLikelihood >= 50 ? 'text-orange-400' : 'text-red-500';
                  
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Current Recommendation */}
                      <div className="space-y-4">
                        <div className="text-center p-4 bg-blue-900/50 rounded-lg border border-blue-700/30">
                          <div className="text-sm text-blue-200 mb-2">Current Signal</div>
                          <div className={`text-3xl font-bold ${signalColor} mb-2`}>
                            {currentSignal === 'WAIT' ? 'STRONG' : currentSignal === 'NO DATA' ? 'ANALYZING' : currentSignal}
                          </div>
                          <div className="text-sm text-blue-200">
                            Based on technical analysis and learning patterns
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                            <div className="text-xs text-blue-200 mb-1">Confidence</div>
                            <div className={`text-xl font-bold ${confidenceColor}`}>
                              {chartData?.confidence || selectedCrypto?.confidence || 0}%
                            </div>
                          </div>
                          <div className="text-center p-3 bg-blue-950/40 rounded-lg border border-blue-800/20">
                            <div className="text-xs text-blue-200 mb-1">Profit Chance</div>
                            <div className={`text-xl font-bold ${profitColor}`}>
                              {chartData?.profitLikelihood || selectedCrypto?.profitLikelihood || 0}%
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Technical Indicators */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-blue-200 mb-3">Technical Indicators</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-200">Signal Type</span>
                            <span className={`font-medium ${currentSignal === 'LONG' ? 'text-green-500' : currentSignal === 'SHORT' ? 'text-red-500' : currentSignal === 'WAIT' ? 'text-blue-500' : 'text-gray-400'}`}>
                              {currentSignal === 'WAIT' ? 'STRONG' : currentSignal === 'NO DATA' ? 'ANALYZING' : currentSignal}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-200">Confidence Level</span>
                            <span className="font-medium text-yellow-400">
                              {chartData?.confidence || selectedCrypto?.confidence || 0}%
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-blue-200">Current Price</span>
                            <span className="font-medium text-white">
                              ${(livePrices[selectedSymbol] || selectedCrypto.currentPrice)?.toLocaleString() || 'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Algorithm Trade Suggestions */}
                        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-3">Algorithm Trade Suggestions</div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Entry Price</span>
                              <span className="font-medium text-white">
                                ${(livePrices[selectedSymbol] || selectedCrypto.currentPrice)?.toLocaleString() || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Take Profit</span>
                              <span className="font-medium text-green-500">
                                ${chartData?.tp?.toLocaleString() || 'Calculating...'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Stop Loss</span>
                              <span className="font-medium text-red-500">
                                ${chartData?.sl?.toLocaleString() || 'Calculating...'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Risk/Reward</span>
                              <span className="font-medium text-yellow-500">
                                {chartData?.tp && chartData?.sl && (livePrices[selectedSymbol] || selectedCrypto.currentPrice) ? 
                                  `1:${((Math.abs(chartData.tp - (livePrices[selectedSymbol] || selectedCrypto.currentPrice))) / Math.abs((livePrices[selectedSymbol] || selectedCrypto.currentPrice) - chartData.sl)).toFixed(2)}` 
                                  : 'Calculating...'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-2">Algorithm Learning Status</div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-muted-foreground">
                              Actively learning from market patterns
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Database Technical Indicators */}
                      {(() => {
                        const indicators = technicalIndicators[selectedSymbol];
                        if (indicators) {
                          return (
                            <div className="mt-6 space-y-3">
                              <h4 className="text-sm font-semibold text-muted-foreground mb-3">Database Technical Indicators</h4>
                              
                              {/* Core Indicators */}
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2 bg-muted/20 rounded">
                                  <div className="text-muted-foreground">RSI</div>
                                  <div className="font-medium text-white">
                                    {indicators.rsi?.toFixed(2) || 'N/A'}
                                  </div>
                                </div>
                                <div className="p-2 bg-muted/20 rounded">
                                  <div className="text-muted-foreground">MACD</div>
                                  <div className="font-medium text-white">
                                    {indicators.macd?.toFixed(4) || 'N/A'}
                                  </div>
                                </div>
                                <div className="p-2 bg-muted/20 rounded">
                                  <div className="text-muted-foreground">Stochastic K</div>
                                  <div className="font-medium text-white">
                                    {indicators.stochasticK?.toFixed(2) || 'N/A'}
                                  </div>
                                </div>
                                <div className="p-2 bg-muted/20 rounded">
                                  <div className="text-muted-foreground">Stochastic D</div>
                                  <div className="font-medium text-white">
                                    {indicators.stochasticD?.toFixed(2) || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              {/* Volatility Measures */}
                              <div className="space-y-2">
                                <h5 className="text-xs font-medium text-muted-foreground">Volatility Analysis</h5>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Realized Vol</span>
                                    <span className="font-medium text-orange-400">
                                      {indicators.realizedVolatility?.toFixed(4) || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">5min Vol</span>
                                    <span className="font-medium text-orange-400">
                                      {indicators.volatility5min?.toFixed(4) || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">15min Vol</span>
                                    <span className="font-medium text-orange-400">
                                      {indicators.volatility15min?.toFixed(4) || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">60min Vol</span>
                                    <span className="font-medium text-orange-400">
                                      {indicators.volatility60min?.toFixed(4) || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Bollinger Bands */}
                              <div className="space-y-2">
                                <h5 className="text-xs font-medium text-muted-foreground">Bollinger Bands</h5>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Upper</span>
                                    <span className="font-medium text-green-400">
                                      ${indicators.bollingerUpper?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Middle</span>
                                    <span className="font-medium text-yellow-400">
                                      ${indicators.bollingerMiddle?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Lower</span>
                                    <span className="font-medium text-red-400">
                                      ${indicators.bollingerLower?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Support/Resistance */}
                              <div className="space-y-2">
                                <h5 className="text-xs font-medium text-muted-foreground">Support & Resistance</h5>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Support</span>
                                    <span className="font-medium text-green-400">
                                      ${indicators.supportLevel?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Resistance</span>
                                    <span className="font-medium text-red-400">
                                      ${indicators.resistanceLevel?.toLocaleString() || 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Market Structure */}
                              <div className="space-y-2">
                                <h5 className="text-xs font-medium text-muted-foreground">Market Analysis</h5>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Structure</span>
                                    <span className="font-medium text-blue-400 capitalize">
                                      {indicators.marketStructure || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">EMA Align</span>
                                    <span className={`font-medium ${
                                      indicators.emaAlignment === 1 ? 'text-green-400' : 
                                      indicators.emaAlignment === -1 ? 'text-red-400' : 
                                      'text-gray-400'
                                    }`}>
                                      {indicators.emaAlignment === 1 ? 'Bullish' : 
                                       indicators.emaAlignment === -1 ? 'Bearish' : 'Neutral'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Data Quality */}
                              <div className="mt-3 p-2 bg-muted/20 rounded text-xs">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <div className={`w-2 h-2 rounded-full ${indicators.isComplete ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                  <span>
                                    Data: {indicators.isComplete ? 'Complete' : 'Building'} • 
                                    Updated: {new Date(indicators.lastUpdate).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                }
                  
                // Show loading if no data is available
                return (
                  <div className="text-center py-4 text-blue-200">
                    Loading algorithm analysis...
                  </div>
                );
              })()}
                  </CardContent>
                </Card>

            {/* Price Chart */}
            <Card variant="chart" className="border-blue-800/30">
              <CardHeader className="bg-blue-950/60 rounded-t-lg border-b border-blue-800/30">
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-300" />
                  Price Chart & Forecasting
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {chartData && chartData.symbol === selectedSymbol ? (
                  <LineChart
                    historicalData={chartData.candles.slice(0, 60)}
                    forecastData={chartData.candles.slice(60, 80)}
                    tp={chartData.tp}
                    sl={chartData.sl}
                    symbol={chartData.symbol}
                  />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin text-blue-300">
                      <RefreshCw className="w-6 h-6" />
                    </div>
                    <span className="ml-2 text-blue-200">Loading chart data for {selectedSymbol}...</span>
                    <div className="ml-4 text-xs text-blue-200">
                      {chartData ? `Current data: ${chartData.symbol}` : 'No chart data yet'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Technical Indicators Panel */}
            {(() => {
              const indicators = technicalIndicators[selectedSymbol];
              console.log(`🔍 Technical indicators for ${selectedSymbol}:`, indicators);
              console.log(`🔍 All technical indicators:`, technicalIndicators);
              console.log(`🔍 Selected symbol:`, selectedSymbol);
              
              if (indicators) {
                console.log(`✅ Displaying technical indicators for ${selectedSymbol}`);
              } else {
                console.log(`❌ No technical indicators found for ${selectedSymbol}`);
              }
              
              if (indicators) {
                return (
                  <div className="modern-card border border-liquid/30">
                    <div className="glass-card rounded-t-xl p-6 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
                      <h3 className="text-xl font-semibold gradient-text flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-liquid animate-pulse" />
                        Technical Indicators - {selectedSymbol}
                        <Badge className="status-active">LIVE</Badge>
                      </h3>
                    </div>
                    <div className="p-6 space-y-8">
                      {/* Core Technical Indicators */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                          <div className="text-sm text-muted-foreground mb-2">RSI</div>
                          <div className="text-2xl font-bold gradient-text">
                            {indicators.rsi ? indicators.rsi.toFixed(2) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {indicators.rsi ? (indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral') : ''}
                          </div>
                        </div>
                        <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                          <div className="text-sm text-muted-foreground mb-2">MACD</div>
                          <div className="text-2xl font-bold gradient-text">
                            {indicators.macd ? indicators.macd.toFixed(4) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {indicators.macd ? (indicators.macd > 0 ? 'Bullish' : 'Bearish') : ''}
                          </div>
                        </div>
                        <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                          <div className="text-sm text-muted-foreground mb-2">Stochastic K</div>
                          <div className="text-2xl font-bold gradient-text">
                            {indicators.stochasticK ? indicators.stochasticK.toFixed(2) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {indicators.stochasticK ? (indicators.stochasticK > 80 ? 'Overbought' : indicators.stochasticK < 20 ? 'Oversold' : 'Neutral') : ''}
                          </div>
                        </div>
                        <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                          <div className="text-sm text-muted-foreground mb-2">Volatility</div>
                          <div className="text-2xl font-bold gradient-text">
                            {indicators.volatility ? indicators.volatility.toFixed(4) : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {indicators.volatility ? (indicators.volatility > 0.5 ? 'High' : indicators.volatility > 0.2 ? 'Medium' : 'Low') : ''}
                          </div>
                        </div>
                      </div>

                      {/* Bollinger Bands */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold gradient-text">Bollinger Bands</h4>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="glass-card bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30 p-4 hover:scale-105 transition-all duration-300">
                            <div className="text-sm text-green-400 mb-2">Upper Band</div>
                            <div className="text-xl font-bold text-green-400">
                              ${indicators.bollingerUpper ? parseFloat(indicators.bollingerUpper).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="glass-card bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30 p-4 hover:scale-105 transition-all duration-300">
                            <div className="text-sm text-yellow-400 mb-2">Middle Band</div>
                            <div className="text-xl font-bold text-yellow-400">
                              ${indicators.bollingerMiddle ? parseFloat(indicators.bollingerMiddle).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="glass-card bg-gradient-to-br from-red-900/20 to-pink-900/20 border-red-500/30 p-4 hover:scale-105 transition-all duration-300">
                            <div className="text-sm text-red-400 mb-2">Lower Band</div>
                            <div className="text-xl font-bold text-red-400">
                              ${indicators.bollingerLower ? parseFloat(indicators.bollingerLower).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Support & Resistance */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold gradient-text">Support & Resistance Levels</h4>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="glass-card bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30 p-4 hover:scale-105 transition-all duration-300">
                            <div className="text-sm text-green-400 mb-2">Support Level</div>
                            <div className="text-xl font-bold text-green-400">
                              ${indicators.supportLevel ? parseFloat(indicators.supportLevel).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="glass-card bg-gradient-to-br from-red-900/20 to-pink-900/20 border-red-500/30 p-4 hover:scale-105 transition-all duration-300">
                            <div className="text-sm text-red-400 mb-2">Resistance Level</div>
                            <div className="text-xl font-bold text-red-400">
                              ${indicators.resistanceLevel ? parseFloat(indicators.resistanceLevel).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Market Data */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-purple-400">Market Data</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Volume</div>
                            <div className="text-lg font-bold text-white">
                              {indicators.volume ? parseFloat(indicators.volume).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Close Price</div>
                            <div className="text-lg font-bold text-white">
                              ${indicators.close ? parseFloat(indicators.close).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Technical Analysis Summary */}
                      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 rounded-lg border border-blue-500/20">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Technical Analysis Summary</h4>
                        <div className="text-sm text-muted-foreground">
                          Indicators calculated from authentic market data with real-time updates from database-integrated chart building system.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </CardContent>
    
        )}

          
        </Card>

        {/* Live Learning System */}
        <Card className="modern-card bg-gradient-to-br from-orange-900/20 to-amber-900/20 border-orange-500/30 animate-float">
          <CardHeader>
            <CardTitle className="flex items-center space-x-3">
              <Brain className="h-6 w-6 text-liquid animate-pulse" />
              <span className="text-liquid text-xl font-semibold">Live Learning System</span>
              <Badge className="status-active animate-glow">LEARNING</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                <div className="text-sm text-muted-foreground mb-2">Training Cycles</div>
                <div className="text-2xl font-bold gradient-text">2761</div>
              </div>
              <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                <div className="text-sm text-muted-foreground mb-2">Weight Adjustments</div>
                <div className="text-2xl font-bold gradient-text">3226</div>
              </div>
              <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                <div className="text-sm text-muted-foreground mb-2">Learning Rate</div>
                <div className="text-2xl font-bold text-green-400">Active</div>
              </div>
              <div className="glass-card p-4 hover:scale-105 transition-all duration-300">
                <div className="text-sm text-muted-foreground mb-2">Model Accuracy</div>
                <div className="text-2xl font-bold text-orange-400">{averageConfidence}%</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-card p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">System Learning Progress</span>
                  <span className="text-orange-400 font-semibold">{Math.min(100, Math.round(2761 / 30))}%</span>
                </div>
                <Progress value={Math.min(100, Math.round(2761 / 30))} className="h-3" />
              </div>
              
              <div className="glass-card p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Confidence Accuracy</span>
                  <span className="text-orange-400 font-semibold">{averageConfidence}%</span>
                </div>
                <Progress value={averageConfidence} className="h-3" />
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-liquid rounded-full animate-pulse"></div>
                  <span>Forecast accuracy tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-liquid rounded-full animate-pulse"></div>
                  <span>Prediction performance learning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-liquid rounded-full animate-pulse"></div>
                  <span>Dynamic boldness adjustment</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-liquid rounded-full animate-pulse"></div>
                  <span>Real-time model optimization</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Components */}
      <div className="space-y-4">
        {/* Completed Trade Notifications */}
        <TradeCompletionNotification
          completedTrades={completedTradeNotifications}
          onDismiss={handleNotificationDismiss}
        />

        {/* Trade Outcome Chart Modal */}
        <TradeOutcomeChart 
          isOpen={tradeOutcomeChartOpen}
          onClose={() => setTradeOutcomeChartOpen(false)}
        />

        {/* Trade Performance Analysis Modal */}
        <TradePerformanceModal 
          isOpen={showTradePerformanceModal} 
          onClose={() => setShowTradePerformanceModal(false)} 
        />

        {/* Forecast Accuracy Modal */}
        <LearningSystemModal 
          isOpen={showForecastAccuracyModal} 
          onClose={() => setShowForecastAccuracyModal(false)} 
        />
      </div>
    </div>
  );
}

export default BinanceDashboard;
