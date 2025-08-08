import { useState, useEffect } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Activity, Target, BarChart3, DollarSign, Settings, Coins, ChevronDown, ChevronRight, Zap, Brain, AlertTriangle } from "lucide-react";
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

import { TradeCompletionNotification } from "@/components/trade-completion-notification";


import { shouldDisplayTradeSignal, getWaitingMessage } from '@/utils/enhanced-trade-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradeOutcomeChart } from "@/components/trade-outcome-chart";
import { CryptocurrencyIntelligenceHeader } from "@/components/cryptocurrency-intelligence-header";
import { AITradeSuggestionsCard } from "@/components/ai-trade-suggestions-card";
import { ModelHealthDashboard } from "@/components/ModelHealthDashboard";
import { TradePerformanceModal } from "@/components/TradePerformanceModal";


// Helper function to calculate remaining time
function calculateRemainingTime(createdAt: string, durationMinutes: number = 20): { minutes: number, seconds: number } {
  const created = new Date(createdAt);
  const now = new Date();
  const elapsedMs = now.getTime() - created.getTime();
  
  // Use the actual durationMinutes from the trade (defaults to 20 minutes)
  const totalDurationMs = durationMinutes * 60 * 1000;
  
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

// ✅ Updated interface for unified candlestick format (80 total: 60 historical + 20 forecast)
interface ChartData {
  symbol: string;
  candles: Array<{
    timestamp: number; // Unix timestamp in milliseconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number; // 0 for forecast candles
  }>;
  signal: "LONG" | "SHORT" | "NO DATA";
  confidence: number;
  profitLikelihood: number;
  tp: number;
  sl: number;
  currentPrice: number;
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
  const [showModelHealthModal, setShowModelHealthModal] = useState(false);

  
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
      // Add timeout for symbols API
      const response = await axios.get("/api/binance/symbols", { timeout: 10000 });
      setSymbols(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching symbols:", error);
      // Set fallback empty state to prevent crashes
      setSymbols([]);
    }
  };

  const fetchMLSignals = async () => {
    try {
      const signals: Record<string, MLSignal> = {};
      const indicators: Record<string, any> = {};
      const approvedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
      
      for (const symbol of approvedSymbols) {
        try {
          // Create promises with timeout handling
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          
          // Fetch both ML signals and technical indicators with timeout
          const [mlResponse, indicatorsResponse] = await Promise.all([
            Promise.race([
              fetch(`/api/ml-engine/signal/${symbol}`),
              timeoutPromise
            ]) as Promise<Response>,
            Promise.race([
              fetch(`/api/technical-indicators/${symbol}`),
              timeoutPromise
            ]) as Promise<Response>
          ]);
          
          // Process ML signals with timeout protection
          if (mlResponse && mlResponse.ok) {
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
          
          // Process technical indicators with timeout protection
          if (indicatorsResponse && indicatorsResponse.ok) {
            const indicatorData = await indicatorsResponse.json();
            indicators[symbol] = indicatorData;
            console.log(`✅ Technical indicators fetched for ${symbol}:`, indicatorData);
          }
        } catch (error) {
          console.warn(`Failed to fetch data for ${symbol} (timeout or error):`, error);
          // Set fallback signal for this symbol
          signals[symbol] = {
            signal: 'WAIT',
            confidence: 0,
            profitLikelihood: 0,
            currentPrice: 0,
            tp: 0,
            sl: 0
          };
        }
      }
      
      setMLSignals(signals);
      setTechnicalIndicators(indicators);
      console.log('✅ ML signals and technical indicators updated');
    } catch (error) {
      console.error('Error fetching ML signals and technical indicators:', error);
      // Set fallback empty states to prevent crashes
      setMLSignals({});
      setTechnicalIndicators({});
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

      console.log("📊 [FRONTEND] Processing unified line chart data:", chartResponse.data);
      
      // ✅ Handle unified array of 80 data points (60 historical + 20 forecast)
      if (Array.isArray(chartResponse.data) && chartResponse.data.length > 0) {
        // Get ML engine data  
        const mlSignal = mlResponse?.data;
        
        const transformedData: ChartData = {
          symbol: symbol,
          candles: chartResponse.data, // Direct array of 80 data points
          signal: mlSignal?.signal || "NO DATA",
          confidence: mlSignal?.confidence || 0,
          profitLikelihood: mlSignal?.profitLikelihood || 0,
          tp: mlSignal?.takeProfit || 0,
          sl: mlSignal?.stopLoss || 0,
          currentPrice: chartResponse.data[59]?.close || mlSignal?.entryPrice || 0, // Last historical data point's close price
        };

        console.log("✅ [FRONTEND] Transformed chart data with ML engine data:", transformedData);
        setChartData(transformedData);
        console.log("Chart data state updated for:", symbol);
      } else {
        console.error("Invalid chart data format received");
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
      try {
        // Add overall timeout for loading
        await Promise.race([
          Promise.all([fetchSymbols(), fetchMLSignals()]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Overall loading timeout')), 15000)
          )
        ]);
      } catch (error) {
        console.error('Dashboard loading error:', error);
        // Continue with fallback states
      } finally {
        setLoading(false);
      }
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-black">
        <div className="text-center">
          <div className="animate-spin text-blue-300 mb-4">
            <RefreshCw className="w-8 h-8 mx-auto" />
          </div>
          <div className="text-white text-lg">Loading Trading Dashboard...</div>
          <div className="text-blue-300 text-sm mt-2">Connecting to ML systems and market data</div>
        </div>
      </div>
    );
  }

  // Add error boundary for any critical failures
  if (!symbols && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-black">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <AlertTriangle className="w-8 h-8 mx-auto" />
          </div>
          <div className="text-white text-lg">Dashboard Loading Error</div>
          <div className="text-red-300 text-sm mt-2">Unable to connect to trading systems</div>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 relative">
      {/* Professional subtle grid pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px] sm:bg-[size:60px_60px] lg:bg-[size:80px_80px]"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-black/20"></div>

      
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 relative z-10 max-w-full overflow-x-hidden">
        {/* Professional Enterprise Header */}
        <CryptocurrencyIntelligenceHeader 
          onShowTradePerformanceModal={() => setShowTradePerformanceModal(true)}
          onShowModelHealthModal={() => setShowModelHealthModal(true)}
        />

        {/* AI Trade Suggestions Card */}
        <AITradeSuggestionsCard />

        {/* Active Simulation Trades */}
        <ActiveSimulationTrades 
          onExpandedChange={setMainActiveTradesExpanded} 
        />






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


      </div>
      
      {/* Trade Outcome Chart Modal - 500 Latest Trades */}
      <TradeOutcomeChart 
        isOpen={tradeOutcomeChartOpen}
        onClose={() => setTradeOutcomeChartOpen(false)} 
      />

      {/* Database-backed Trade Performance Modal */}
      <TradePerformanceModal 
        isOpen={showTradePerformanceModal} 
        onClose={() => setShowTradePerformanceModal(false)} 
      />

      {/* Model Health Dashboard Modal */}
      {showModelHealthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <ModelHealthDashboard onClose={() => setShowModelHealthModal(false)} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default BinanceDashboard;
