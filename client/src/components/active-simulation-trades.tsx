import { useState, useEffect, useRef, memo, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Target, Activity, Clock, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { safeToFixed, safePrice } from "@/lib/safe-format";

interface ActiveTrade {
  id: number;
  symbol: string;
  signalType: 'LONG' | 'SHORT';
  simulationType: 'SHORT' | 'MEDIUM' | 'LONG';
  confidence: number;
  profitLikelihood: number;
  entryPrice: string;
  tpPrice: string;
  slPrice: string;
  currentPrice: string;
  progress: number;
  realTimePnl: string;
  profitable: boolean;
  highestProfit: number;
  lowestLoss: number;
  profitableMinutes: number;
  profitableSeconds: number;
  lossMinutes: number;
  lossSeconds: number;
  totalMinutes: number;
  totalSeconds: number;
  profitablePercentage: string;
  createdAt: string;
  remainingSeconds: number;
}

interface ActiveSimulationTradesProps {
  onExpandedChange?: (expanded: boolean) => void;
}

export const ActiveSimulationTrades = memo(function ActiveSimulationTrades({ onExpandedChange }: ActiveSimulationTradesProps = {}) {
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded for better mobile UX
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [lastActiveTradeIds, setLastActiveTradeIds] = useState<number[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch active trades function
  const fetchActiveTrades = async () => {
    try {
      console.log("Fetching active trades...");
      const response = await axios.get(`/api/active-trades?t=${Date.now()}`);
      const trades = response.data || [];
      console.log("Active trades response:", trades);
      console.log("ETHUSDT price check:", trades.find((t: ActiveTrade) => t.symbol === 'ETHUSDT')?.currentPrice);
      
      // Filter out any non-approved symbols (safety measure)
      const approvedSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
      const filteredTrades = trades.filter((trade: ActiveTrade) => 
        approvedSymbols.includes(trade.symbol)
      );
      
      // Log all current prices for debugging
      filteredTrades.forEach((trade: ActiveTrade) => {
        console.log(`${trade.symbol} current price:`, trade.currentPrice);
      });
      
      // Check for completed trades (trades that were active but are no longer in the list)
      const currentTradeIds = trades.map((t: ActiveTrade) => t.id);
      const completedIds = lastActiveTradeIds.filter(id => !currentTradeIds.includes(id));
      
      console.log("Trade completion detection:", {
        currentTradeIds,
        lastActiveTradeIds,
        completedIds,
        hasCompletedTrades: completedIds.length > 0
      });
      
      // Only update state if there are actual changes to prevent unnecessary re-renders
      const currentIds = activeTrades.map(t => t.id).sort().join(',');
      const newIds = filteredTrades.map((t: ActiveTrade) => t.id).sort().join(',');
      
      if (currentIds !== newIds || activeTrades.length === 0) {
        console.log("Trade array changed - updating state");
        setActiveTrades(filteredTrades);
        console.log("Active trades state updated:", trades.length, "trades");
        setRefreshKey(Date.now()); // Force component refresh
      } else {
        // Array structure same, just update existing trades in place
        setActiveTrades(prevTrades => {
          return prevTrades.map(prevTrade => {
            const updatedTrade = filteredTrades.find((t: ActiveTrade) => t.id === prevTrade.id);
            return updatedTrade || prevTrade;
          });
        });
        setRefreshKey(Date.now()); // Force component refresh for data updates
      }
      
      setLastActiveTradeIds(currentTradeIds);
    } catch (error) {
      console.error('Error fetching active trades:', error);
      setActiveTrades([]);
    }
  };



  // Fetch trade count for header badge always, detailed data only when expanded
  const fetchTradeCount = async () => {
    try {
      const response = await axios.get(`/api/active-trades?t=${Date.now()}`);
      const trades = response.data || [];
      
      // Always update the count for the header badge, but only when collapsed
      // (when expanded, fetchActiveTrades handles this)
      if (!isExpanded) {
        setActiveTrades(trades);
      }
    } catch (error) {
      console.error('Error fetching trade count:', error);
      if (!isExpanded) {
        setActiveTrades([]);
      }
    }
  };

  // Fetch active trades when component mounts and set up polling
  useEffect(() => {
    // Always fetch trade count for header badge
    fetchTradeCount();
    
    if (isExpanded) {
      fetchActiveTrades();
      // Set up polling for active trades - 10 seconds to avoid rate limits
      const interval = setInterval(() => {
        fetchActiveTrades();
      }, 10000); // 10 seconds to prevent 429 errors
      return () => clearInterval(interval);
    } else {
      // When collapsed, still poll for count updates but less frequently
      const countInterval = setInterval(() => {
        fetchTradeCount();
      }, 15000); // 15 seconds for count updates when collapsed
      return () => clearInterval(countInterval);
    }
  }, [isExpanded]);

  // Force refresh every 10 seconds when expanded to avoid rate limits
  useEffect(() => {
    if (isExpanded) {
      const refreshInterval = setInterval(() => {
        setRefreshKey(Date.now());
      }, 10000);
      return () => clearInterval(refreshInterval);
    }
  }, [isExpanded]);

  const handleExpandToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded) {
      fetchActiveTrades(); // Refresh when opening
    }
    onExpandedChange?.(newExpanded);
  };

  const formatTime = (minutes: number, seconds: number) => {
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formatRemainingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s left`;
    }
    return `${remainingSeconds}s left`;
  }

  const getDurationLabel = (simulationType: string) => {
    // All trades now use 20-minute duration regardless of simulationType
    return '20 min';
  };

  // Memoized individual trade component to prevent unnecessary re-renders
  const TradeCard = memo(({ trade }: { trade: ActiveTrade }) => {
    const remainingTime = useMemo(() => formatRemainingTime(trade.remainingSeconds), [trade.remainingSeconds]);
    const pnlColor = useMemo(() => trade.profitable ? 'text-green-400' : 'text-red-400', [trade.profitable]);
    const signalBadgeColor = useMemo(() => 
      trade.signalType === 'LONG' ? 'bg-green-700/30 text-green-300 border-green-600/50' : 'bg-red-700/30 text-red-300 border-red-600/50',
      [trade.signalType]
    );

    return (
      <Card className="bg-gray-800/50 border-gray-700/30 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg font-bold text-white">{trade.symbol}</CardTitle>
              <Badge variant="secondary" className={`${signalBadgeColor} text-xs px-2 py-0.5`}>
                {trade.signalType}
              </Badge>
              <Badge variant="secondary" className="bg-blue-700/30 text-blue-300 border-blue-600/50 text-xs px-2 py-0.5">
                {getDurationLabel(trade.simulationType)}
              </Badge>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${pnlColor}`}>
                ${trade.realTimePnl}
              </div>
              <div key={`remaining-time-${trade.id}-${trade.remainingSeconds}-${refreshKey}`} className="text-xs text-gray-400">
                {remainingTime}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Entry</div>
              <div className="text-white font-mono">{safePrice(parseFloat(trade.entryPrice))}</div>
            </div>
            <div>
              <div className="text-gray-400">Current</div>
              <div className="text-white font-mono font-bold">
                {safePrice(parseFloat(trade.currentPrice))}
              </div>
            </div>
            <div>
              <div className="text-gray-400">ML Confidence</div>
              <div className="text-blue-400 font-semibold">{trade.confidence}%</div>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-gray-400">Progress</span>
              <span key={`progress-text-${trade.id}-${trade.progress}-${refreshKey}`} className="text-white">
                {trade.progress}%
              </span>
            </div>
            <Progress 
              key={`progress-bar-${trade.id}-${trade.progress}-${refreshKey}`}
              value={trade.progress} 
              className="h-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <div className="text-gray-400">Take Profit</div>
              <div className="text-green-400 font-mono">{safePrice(parseFloat(trade.tpPrice))}</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-400">Stop Loss</div>
              <div className="text-red-400 font-mono">{safePrice(parseFloat(trade.slPrice))}</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-400">Profitable Time</div>
              <div className="text-white font-mono">
                {trade.profitableMinutes}m {trade.profitableSeconds}s
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-400">Loss Time</div>
              <div className="text-white font-mono">
                {trade.lossMinutes}m {trade.lossSeconds}s
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  });

  const getDurationColor = (simulationType: string) => {
    switch (simulationType) {
      case 'SHORT': return 'border-orange-500/30 bg-orange-900/20';
      case 'MEDIUM': return 'border-blue-500/30 bg-blue-900/20';
      case 'LONG': return 'border-green-500/30 bg-green-900/20';
      default: return 'border-gray-500/30 bg-gray-900/20';
    }
  };

  // Memoized stable sorting to prevent array recreation on every render
  const sortedTrades = useMemo(() => {
    return [...activeTrades].sort((a, b) => {
      // Primary sort: remaining time (ascending)
      if (a.remainingSeconds !== b.remainingSeconds) {
        return a.remainingSeconds - b.remainingSeconds;
      }
      // Secondary sort: trade ID for consistency
      return a.id - b.id;
    });
  }, [activeTrades]);

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-500/30 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-2 px-4 py-3 cursor-pointer hover:bg-purple-800/20 transition-colors" onClick={handleExpandToggle}>
        <CardTitle className="flex items-center justify-between text-white text-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="h-5 w-5 text-purple-400 animate-pulse" />
            <span className="text-base sm:text-lg">Active Trades</span>
            <Badge variant="secondary" className="bg-green-700/50 text-green-200 border-green-600/50 animate-pulse">
              {activeTrades.length} LIVE
            </Badge>
            {activeTrades.length > 0 && (
              <span className="text-xs text-green-400 hidden sm:inline">● Running Now</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTrades.length > 0 && !isExpanded && (
              <span className="text-xs text-purple-300 hidden sm:inline">Tap to view</span>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-purple-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-purple-400" />
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 pb-4">
          {activeTrades.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active simulation trades</p>
              <p className="text-sm">New trades will appear here automatically</p>
            </div>
          ) : (
            <ScrollArea className="h-[70vh] sm:h-96 max-h-[600px]" ref={scrollAreaRef}>
              <div className="space-y-2 sm:space-y-3">
                {sortedTrades.map((trade) => (
                  <div key={`trade-wrapper-${trade.id}`} className={`${getDurationColor(trade.simulationType)} border transition-all duration-200 rounded-lg overflow-hidden`}>
                    <TradeCard trade={trade} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      )}
    </Card>
  );
});

export default ActiveSimulationTrades;