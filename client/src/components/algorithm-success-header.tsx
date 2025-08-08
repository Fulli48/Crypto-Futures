import { useQuery } from "@tanstack/react-query";
import { Brain, TrendingUp, TrendingDown, Info, Clock, Database, BarChart, Zap, BarChart3, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { ChartDataModal } from "./chart-data-modal";
import { LearningSystemModal } from "./learning-system-modal";
import { TradePerformanceModal } from "./TradePerformanceModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


interface AlgorithmSuccessMetrics {
  recentSuccessRate: number;
  baselineSuccessRate: number;
  smoothedSuccessRate: number;
  improvementPercent: number;
  totalTradesInBuffer: number;
  recentTrades: number;
  baselineTrades: number;
  timeThreshold: number;
  drawdownThreshold: number;
  breakdown: {
    netProfitTrades: number;
    timeInProfitTrades: number;
    bothCriteriaTrades: number;
  };
}

interface HourlyChangeData {
  currentRate: number;
  previousRate: number;
  change: number;
  changePercent: number;
}



interface AlgorithmSuccessHeaderProps {
  onOpenPerformanceModal?: () => void;
  onOpenForecastModal?: () => void;
}

export function AlgorithmSuccessHeader({ onOpenPerformanceModal, onOpenForecastModal }: AlgorithmSuccessHeaderProps = {}) {
  const [isChartDataModalOpen, setIsChartDataModalOpen] = useState(false);
  const [isSystemSettingsModalOpen, setIsSystemSettingsModalOpen] = useState(false);
  const [isInternalForecastModalOpen, setIsInternalForecastModalOpen] = useState(false);
  const [isInternalPerformanceModalOpen, setIsInternalPerformanceModalOpen] = useState(false);

  const { data: metrics, isLoading } = useQuery<AlgorithmSuccessMetrics>({
    queryKey: ['/api/learning/algorithm-success'],
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 2000,
  });

  const { data: hourlyChange } = useQuery<HourlyChangeData>({
    queryKey: ['/api/learning/hourly-change'],
    refetchInterval: 30000, // Update every 30 seconds (less frequent)
    staleTime: 20000,
  });



  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
        <div className="text-sm sm:text-lg text-white">
          Loading rolling window metrics...
        </div>
      </div>
    );
  }

  const getSuccessColor = (rate: number) => {
    if (rate >= 20) return 'text-green-400';
    if (rate >= 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getImprovementColor = (improvement: number) => {
    if (improvement > 0) return 'text-green-400';
    if (improvement < 0) return 'text-red-400';
    return 'text-gray-400';
  };



  return (
    <>
      {/* Centered brain icon at top */}
      <div className="flex justify-center mb-4 sm:mb-6">
        <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-green-600/30 to-blue-600/30 border-2 border-green-500/40 shadow-lg">
          <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-green-300" />
        </div>
      </div>
      
      {/* Algorithm Success Summary - Enhanced Mobile Centering */}
      <div className="flex flex-col items-center justify-center text-center px-2 sm:px-0 mx-auto max-w-md sm:max-w-lg lg:max-w-2xl">
        <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-3 text-center w-full">
          Algorithm Success Rate: <span className={getSuccessColor(metrics.recentSuccessRate)}>{metrics.recentSuccessRate.toFixed(1)}%</span>
        </div>
        <div className="text-sm sm:text-base text-slate-300 font-medium text-center w-full">
          Based on {metrics.recentTrades} recent trades in rolling window
        </div>
        {hourlyChange && (
          <div className={`flex items-center justify-center gap-1 text-xs sm:text-sm font-medium mt-2 ${getImprovementColor(hourlyChange.change)} w-full`}>
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            {hourlyChange.change > 0 ? '↑' : hourlyChange.change < 0 ? '↓' : '→'} 
            {Math.abs(hourlyChange.change).toFixed(1)}% change in last hour
          </div>
        )}
      </div>

      {/* Action Buttons - Enhanced Responsive Layout */}
      <div className="mt-6 sm:mt-8 px-2 sm:px-0 flex justify-center">
        {/* Mobile: 2x2 Grid, Desktop: Single Row with Perfect Centering */}
        <div className="grid grid-cols-2 gap-3 lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-4 max-w-md sm:max-w-lg lg:max-w-4xl w-full">
          <button
            onClick={() => setIsChartDataModalOpen(true)}
            className="flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 bg-gradient-to-r from-purple-600/25 to-purple-500/25 hover:from-purple-600/40 hover:to-purple-500/40 border border-purple-500/40 hover:border-purple-400/60 text-white font-semibold text-xs lg:text-sm rounded-xl transition-all duration-200 w-full lg:w-auto shadow-lg hover:shadow-purple-500/20"
          >
            <BarChart className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline lg:inline">Chart Data</span>
            <span className="md:hidden lg:hidden">Charts</span>
          </button>
          
          <button
            onClick={() => {
              if (onOpenForecastModal) {
                onOpenForecastModal();
              } else {
                setIsInternalForecastModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 bg-gradient-to-r from-orange-600/25 to-orange-500/25 hover:from-orange-600/40 hover:to-orange-500/40 border border-orange-500/40 hover:border-orange-400/60 text-white font-semibold text-xs lg:text-sm rounded-xl transition-all duration-200 w-full lg:w-auto shadow-lg hover:shadow-orange-500/20"
          >
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline lg:inline">Forecast</span>
            <span className="md:hidden lg:hidden">Learning</span>
          </button>

          <button
            onClick={() => {
              if (onOpenPerformanceModal) {
                onOpenPerformanceModal();
              } else {
                setIsInternalPerformanceModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 bg-gradient-to-r from-blue-600/25 to-blue-500/25 hover:from-blue-600/40 hover:to-blue-500/40 border border-blue-500/40 hover:border-blue-400/60 text-white font-semibold text-xs lg:text-sm rounded-xl transition-all duration-200 w-full lg:w-auto shadow-lg hover:shadow-blue-500/20"
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline lg:inline">Analysis</span>
            <span className="md:hidden lg:hidden">Stats</span>
          </button>

          <button
            onClick={() => setIsSystemSettingsModalOpen(true)}
            className="flex items-center justify-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 bg-gradient-to-r from-green-600/25 to-green-500/25 hover:from-green-600/40 hover:to-green-500/40 border border-green-500/40 hover:border-green-400/60 text-white font-semibold text-xs lg:text-sm rounded-xl transition-all duration-200 w-full lg:w-auto shadow-lg hover:shadow-green-500/20"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline lg:inline">Controls</span>
            <span className="md:hidden lg:hidden">Settings</span>
          </button>
        </div>
      </div>
      

      
      <ChartDataModal 
        isOpen={isChartDataModalOpen} 
        onClose={() => setIsChartDataModalOpen(false)} 
      />
      
      {/* Trading Controls Modal */}
      <Dialog open={isSystemSettingsModalOpen} onOpenChange={setIsSystemSettingsModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-400" />
              Trading Controls & System Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-green-400 mb-2">Learning System</h3>
                <p className="text-sm text-slate-300">Control ML training parameters and confidence thresholds</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-blue-400 mb-2">Risk Management</h3>
                <p className="text-sm text-slate-300">Adjust position sizing and stop-loss parameters</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-orange-400 mb-2">Alert Settings</h3>
                <p className="text-sm text-slate-300">Configure trade notifications and alerts</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-purple-400 mb-2">Data Refresh</h3>
                <p className="text-sm text-slate-300">Control data polling intervals and sources</p>
              </div>
            </div>
            <div className="text-center text-slate-400 text-sm">
              Advanced trading controls and system configuration options
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Internal Modals (fallback when props not provided) */}
      <LearningSystemModal 
        isOpen={isInternalForecastModalOpen} 
        onClose={() => setIsInternalForecastModalOpen(false)} 
      />
      
      <TradePerformanceModal 
        isOpen={isInternalPerformanceModalOpen} 
        onClose={() => setIsInternalPerformanceModalOpen(false)} 
      />

    </>
  );
}