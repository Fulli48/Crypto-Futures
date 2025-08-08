import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Zap, Brain, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartDataModal } from './chart-data-modal';
import { LearningSystemModal } from './learning-system-modal';
import axios from 'axios';

interface IntelligenceStats {
  profitStrength: number;
  failureRate: number;
  recentChange: number;
  failedForecasts: number;
  totalForecasts: number;
}

export const CryptocurrencyIntelligenceHeader = ({ onShowTradePerformanceModal, onShowModelHealthModal }: { onShowTradePerformanceModal?: () => void, onShowModelHealthModal?: () => void }) => {
  const [stats, setStats] = useState<IntelligenceStats>({ 
    profitStrength: 0, 
    failureRate: 0,
    recentChange: 0,
    failedForecasts: 0,
    totalForecasts: 0
  });
  const [loading, setLoading] = useState(true);
  const [isChartDataModalOpen, setIsChartDataModalOpen] = useState(false);
  const [isLearningSystemModalOpen, setIsLearningSystemModalOpen] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('📊 Fetching database-backed trade statistics for header...');
        
        // Use the new database-backed trade statistics endpoint (last 100 trades)
        const [statsResponse, changeResponse] = await Promise.all([
          axios.get('/api/trade-stats'),
          axios.get('/api/learning/hourly-change').catch(() => ({ data: { hourlyChange: 0 } }))
        ]);
        
        if (statsResponse.data && statsResponse.data.success) {
          console.log('✅ Header stats loaded from database:', statsResponse.data);
          
          // Calculate failed forecasts (SL_HIT + NO_PROFIT)
          const failedForecasts = (statsResponse.data.breakdown?.slHitTrades || 0) + (statsResponse.data.breakdown?.noProfitTrades || 0);
          const totalForecasts = statsResponse.data.sampleSize || 0;
          
          setStats({
            profitStrength: statsResponse.data.profitStrength || 0,
            failureRate: statsResponse.data.failureRate || 0,
            recentChange: changeResponse.data?.hourlyChange || 0,
            failedForecasts: failedForecasts, // Failed trades (SL_HIT + NO_PROFIT)
            totalForecasts: totalForecasts
          });
        } else {
          console.error('❌ Failed to fetch header stats:', statsResponse.data.error);
          // Keep zeros if API fails - no synthetic data
        }
      } catch (error) {
        console.error('❌ Error fetching database-backed intelligence stats:', error);
        // Keep zeros if API fails - no synthetic data
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Update every 30 seconds for more responsive updates
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleViewChart = () => {
    setIsChartDataModalOpen(true);
  };

  const handleLearningSystem = () => {
    setIsLearningSystemModalOpen(true);
  };

  const handleModelHealth = () => {
    if (onShowModelHealthModal) {
      onShowModelHealthModal();
    }
  };

  return (
    <div className="section-container" style={{maxWidth: '800px', margin: '0 auto 1.5rem auto'}}>
      {/* Header Section */}
      <div className="header-section">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center bg-gradient-to-r from-blue-400 via-blue-300 to-blue-500 bg-clip-text text-transparent leading-tight">
          Cryptocurrency Trading Intelligence
        </h1>
        <p className="subtext text-base sm:text-lg text-center mt-3 text-slate-300 font-medium tracking-wide">
          Real-time market insights powered by machine learning
        </p>
      </div>

      {/* Horizontal Stats Section with Brain - Perfect Mobile Centering */}
      <div className="horizontal-stats-section stats-container-override flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 mt-6 sm:mt-8 px-4">
        <div className="stat-block left-stat text-center min-w-0 sm:flex-1 stat-block-override">
          <div className="stat-title text-sm sm:text-base text-slate-400 font-semibold tracking-wide">
            Expected Profit<br className="hidden sm:block" /><span className="sm:hidden"> </span>Strength
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info 
                    className="h-4 w-4 text-slate-400 hover:text-blue-400 cursor-pointer inline-block ml-2 transition-colors duration-200" 
                    data-testid="info-profit-strength"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm font-medium">100%: always hits the highest profit level possible. 0%: avoid losses, but doesn't produce profit. Green = strong profit potential, Red = low profit potential.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={`stat-value profit-strength text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
            loading ? 'text-gray-400' : 
            stats.profitStrength >= 70 ? 'text-green-400' : 
            stats.profitStrength >= 40 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {loading ? '...' : `${stats.profitStrength.toFixed(1)}%`}
          </div>
          <div className="stat-desc text-sm text-slate-400 mt-1 font-medium">
            {loading ? '...' : `Recent change: ${stats.recentChange > 0 ? '+' : ''}${stats.recentChange?.toFixed(1) || '0.0'}%`}
          </div>
        </div>



        <div className="stat-block right-stat text-center min-w-0 sm:flex-1 stat-block-override">
          <div className="stat-title text-sm sm:text-base text-slate-400 font-semibold tracking-wide">
            Trade Failure<br className="hidden sm:block" /><span className="sm:hidden"> </span>Rate
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info 
                    className="h-4 w-4 text-slate-400 hover:text-blue-400 cursor-pointer inline-block ml-2 transition-colors duration-200" 
                    data-testid="info-failure-rate"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm font-medium">Historical analysis of unsuccessful trade predictions and outcomes. Green = low failure rate (good), Red = high failure rate (poor).</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={`stat-value failure-rate text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
            loading ? 'text-gray-400' : 
            stats.failureRate <= 10 ? 'text-green-400' : 
            stats.failureRate <= 30 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {loading ? '...' : `${stats.failureRate.toFixed(1)}%`}
          </div>
          <div className="stat-desc text-sm text-slate-400 mt-1 font-medium">
            {loading ? '...' : `${stats.failedForecasts || 0} failed of ${stats.totalForecasts || 0} trades`}
          </div>
        </div>
      </div>

      {/* Button Row - Perfect Mobile Centering */}
      <div className="button-row flex flex-col sm:flex-row gap-4 sm:gap-6 mt-8 justify-center items-center px-4">
        <button 
          onClick={handleViewChart}
          className="intelligence-button flex items-center justify-center bg-gradient-to-r from-blue-600/25 to-blue-500/25 hover:from-blue-600/40 hover:to-blue-500/40 border border-blue-500/40 hover:border-blue-400/60 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 w-full sm:w-auto shadow-lg hover:shadow-blue-500/20"
          data-testid="button-view-chart"
        >
          <BarChart3 className="w-4 h-4 mr-3" />
          <span className="hidden sm:inline">View Chart Data</span>
          <span className="sm:hidden">Charts</span>
        </button>
        <button 
          onClick={handleLearningSystem}
          className="intelligence-button flex items-center justify-center bg-gradient-to-r from-orange-600/25 to-orange-500/25 hover:from-orange-600/40 hover:to-orange-500/40 border border-orange-500/40 hover:border-orange-400/60 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 w-full sm:w-auto shadow-lg hover:shadow-orange-500/20"
          data-testid="button-learning-system"
        >
          <Zap className="w-4 h-4 mr-3" />
          <span className="hidden sm:inline">Learning System</span>
          <span className="sm:hidden">Learning</span>
        </button>
        <button 
          onClick={handleModelHealth}
          className="intelligence-button flex items-center justify-center bg-gradient-to-r from-purple-600/25 to-purple-500/25 hover:from-purple-600/40 hover:to-purple-500/40 border border-purple-500/40 hover:border-purple-400/60 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 w-full sm:w-auto shadow-lg hover:shadow-purple-500/20"
          data-testid="button-model-health"
        >
          <Brain className="w-4 h-4 mr-3" />
          <span className="hidden sm:inline">Model Health</span>
          <span className="sm:hidden">Health</span>
        </button>
        {onShowTradePerformanceModal && (
          <button 
            onClick={onShowTradePerformanceModal}
            className="intelligence-button flex items-center justify-center bg-gradient-to-r from-green-600/25 to-green-500/25 hover:from-green-600/40 hover:to-green-500/40 border border-green-500/40 hover:border-green-400/60 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 w-full sm:w-auto shadow-lg hover:shadow-green-500/20"
            data-testid="button-performance-analysis"
          >
            <BarChart3 className="w-4 h-4 mr-3" />
            <span className="hidden sm:inline">Performance Analysis</span>
            <span className="sm:hidden">Analysis</span>
          </button>
        )}
      </div>

      <style>{`
        .header-section h1 {
          font-size: 1.8rem;
          color: #5c8aff;
          font-weight: 700;
          margin: 0 0 0.25rem 0;
          line-height: 1.2;
        }

        .subtext {
          color: #90a4d4;
          font-size: 1rem;
          margin: 0 0 1rem 0;
          line-height: 1.4;
        }

        .section-container .horizontal-stats-section {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 1rem;
          gap: 1rem;
          width: 100%;
          position: relative;
          padding: 1rem 2rem;
          min-height: 130px;
        }

        .section-container .stat-block {
          flex: 1;
          text-align: center;
          padding: 0.5rem;
          min-width: 140px;
          max-width: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 0 1rem;
        }

        .section-container .brain-center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
        }

        .section-container .brain-center:hover {
          transform: scale(1.1);
          color: rgba(255, 255, 255, 1);
          border-color: rgba(92, 138, 255, 0.4);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          line-height: 1;
        }

        /* Dynamic color classes are now applied inline based on values */

        .stat-title {
          font-weight: 700;
          color: #ffffff;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          line-height: 1.2;
        }

        .stat-desc {
          font-size: 0.8rem;
          color: #a8b3d9;
          line-height: 1.3;
          margin-top: 0.5rem;
        }

        .section-container .button-row {
          display: flex !important;
          flex-direction: row !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 1rem !important;
          flex-wrap: nowrap !important;
          width: 100% !important;
          margin-top: 0.5rem !important;
        }

        .section-container .button-row > .intelligence-button {
          flex: 0 0 auto !important;
          display: inline-flex !important;
        }

        @media (max-width: 600px) {
          .section-container .button-row {
            flex-wrap: wrap !important;
          }
        }

        .intelligence-button {
          background: linear-gradient(135deg, hsl(214, 15%, 18%) 0%, hsl(214, 13%, 15%) 100%) !important;
          color: white !important;
          border: 1px solid hsl(214, 17%, 25%) !important;
          border-radius: 999px !important;
          padding: 0.33rem 0.8rem !important;
          font-size: 0.85rem !important;
          font-weight: 600 !important;
          text-align: center !important;
          height: auto !important;
          min-width: 94px !important;
          max-width: none !important;
          width: auto !important;
          flex: 0 0 auto !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .intelligence-button:hover {
          background: linear-gradient(135deg, hsl(214, 17%, 22%) 0%, hsl(214, 15%, 19%) 100%) !important;
          border-color: hsl(214, 17%, 35%) !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
          transform: translateY(-2px);
        }

        .intelligence-button:active {
          transform: translateY(0);
        }

        /* Mobile Responsive */
        @media (max-width: 600px) {
          .section-container {
            padding: 1.5rem;
            margin: 0 1rem 1.5rem 1rem;
          }

          .header-section h1 {
            font-size: 1.5rem;
          }

          .subtext {
            font-size: 0.9rem;
          }

          .horizontal-stats-section {
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
          }

          .stat-block {
            max-width: 100%;
            min-width: auto;
          }

          .brain-center {
            order: 2;
            margin: 0.5rem 0;
          }

          .button-row {
            flex-direction: column;
          }

          .intelligence-button {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .intelligence-container {
            padding: 1rem;
          }

          .stat-value {
            font-size: 1.6rem;
          }

          .brain-icon {
            font-size: 1.8rem;
            width: 50px;
            height: 50px;
          }
        }
      `}</style>
      
      <ChartDataModal 
        isOpen={isChartDataModalOpen} 
        onClose={() => setIsChartDataModalOpen(false)} 
      />
      
      <LearningSystemModal 
        isOpen={isLearningSystemModalOpen} 
        onClose={() => setIsLearningSystemModalOpen(false)} 
      />
    </div>
  );
};