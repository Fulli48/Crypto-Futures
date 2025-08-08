import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, Brain, AlertTriangle, CheckCircle, Clock, Info, HelpCircle, X } from 'lucide-react';
import { format } from 'date-fns';

interface ModelHealthData {
  timestamp: Date;
  featureWeights: Record<string, number>;
  recentTradeOutcomes: any[];
  confidenceThresholds: any;
  modelAccuracyByType: any[];
  regimeChangeAlerts: any[];
  rollingMetrics: {
    winRate: any[];
    avgProfit: any[];
    featureWeightEvolution: any[];
  };
  systemHealth: {
    totalTrades: number;
    activeModels: number;
    lastModelReset: Date | null;
    dataQualityScore: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

// Tooltip information for each section
const TOOLTIP_INFO = {
  totalTrades: {
    title: "Total Trades",
    description: "The total number of trades executed by the ML system. This includes all completed trades (both successful and unsuccessful) that the system has processed for learning and optimization."
  },
  activeModels: {
    title: "Active Models", 
    description: "Number of machine learning models currently running and generating trade signals. These include ensemble methods like Random Forest, Neural Networks, and Logistic Regression working together."
  },
  dataQuality: {
    title: "Data Quality Score",
    description: "A percentage indicating the reliability and completeness of market data feeding into the ML models. Higher scores mean more accurate and complete data for better predictions."
  },
  lastReset: {
    title: "Last Model Reset",
    description: "When the ML models were last reset or retrained. Models are periodically reset to prevent overfitting and adapt to changing market conditions."
  },
  featureWeights: {
    title: "Feature Weights",
    description: "Current importance values for each technical indicator used by the ML models. Higher weights indicate features that have more influence on trade decisions."
  },
  confidenceThresholds: {
    title: "Confidence Thresholds",
    description: "Minimum confidence levels required for different types of trade signals. The system adaptively adjusts these thresholds based on recent performance."
  },
  modelAccuracy: {
    title: "Model Accuracy by Type",
    description: "Performance breakdown showing how accurately each ML model type predicts successful trades over the last 24 hours. Measured as percentage of correct predictions."
  },
  recentTrades: {
    title: "Recent Trade Outcomes",
    description: "Latest completed trades showing actual results. TP_HIT means take-profit was reached, SL_HIT means stop-loss was triggered, showing real performance data."
  },
  rollingWinRate: {
    title: "Rolling Win Rate",
    description: "24-hour moving average of successful trades. Shows trending performance over time to identify if the system is improving or declining."
  },
  featureEvolution: {
    title: "Feature Weight Evolution", 
    description: "How the importance of different technical indicators changes over time as the ML system learns and adapts to market conditions."
  },
  regimeAlerts: {
    title: "Regime Change Alerts",
    description: "System-detected significant changes in market conditions that may affect model performance. Helps identify when models need adjustment."
  }
};

export function ModelHealthDashboard({ onClose }: { onClose?: () => void }) {
  const [healthData, setHealthData] = useState<ModelHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/model-health/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch model health data');
      }
      
      const result = await response.json();
      console.log('📊 Model Health Dashboard API Response:', result);
      
      if (result.success) {
        const healthData = {
          ...result.data,
          timestamp: new Date(result.data.timestamp)
        };
        console.log('📊 Setting health data:', healthData);
        console.log('📊 Model accuracy data:', healthData.modelAccuracyByType);
        
        setHealthData(healthData);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error fetching model health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealthData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close tooltip when pressing escape - backdrop click handled directly
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTooltip(null);
      }
    };

    if (activeTooltip) {
      document.addEventListener('keydown', handleEscape);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [activeTooltip]);

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 animate-spin" />
          <span>Loading model health data...</span>
        </div>
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error loading model health dashboard: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!healthData) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No model health data available
        </AlertDescription>
      </Alert>
    );
  }

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  // Tooltip component with unrestricted positioning
  const InfoTooltip = ({ tooltipKey, className = "" }: { tooltipKey: keyof typeof TOOLTIP_INFO, className?: string }) => {
    const info = TOOLTIP_INFO[tooltipKey];
    const isActive = activeTooltip === tooltipKey;
    
    return (
      <>
        <button
          onClick={() => setActiveTooltip(isActive ? null : tooltipKey)}
          className={`ml-2 text-gray-400 hover:text-blue-400 transition-colors ${className}`}
          data-testid={`tooltip-${tooltipKey}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        
        {isActive && (
          <>
            {/* Full screen overlay backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
              onClick={() => setActiveTooltip(null)}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {/* Tooltip content */}
            <div 
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] w-[90vw] max-w-md"
              style={{ position: 'fixed' }}
            >
              <div className="bg-gray-900/98 backdrop-blur-md border border-gray-600 rounded-xl shadow-2xl p-4 animate-in fade-in-0 zoom-in-95 duration-200">
                <div className="text-sm">
                  <div className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <span>{info.title}</span>
                  </div>
                  <div className="text-gray-300 leading-relaxed text-sm">{info.description}</div>
                </div>
                <button
                  onClick={() => setActiveTooltip(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  };
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  return (
    <div className="space-y-6 p-4 sm:p-6 min-h-screen bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-cyan-900/20 relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Model Health Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Real-time monitoring of ML model performance and system resilience
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 bg-gray-800/50 hover:bg-gray-700/50 rounded-full p-2 z-10"
            aria-label="Close Modal"
          >
            <X className="h-6 w-6" />
          </button>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Last updated: {format(lastUpdate, 'HH:mm:ss')}</span>
          </div>
          <Badge variant={error ? 'destructive' : 'default'} className="w-fit">
            {error ? 'Connection Issues' : 'Live'}
          </Badge>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-black/20 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              Total Trades
              <InfoTooltip tooltipKey="totalTrades" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1">
              {healthData.systemHealth.totalTrades.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="h-3 w-3 mr-1" />
              Active Learning
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              Active Models
              <InfoTooltip tooltipKey="activeModels" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1">
              {healthData.systemHealth.activeModels}
            </div>
            <div className="flex items-center text-xs text-blue-400">
              <Brain className="h-3 w-3 mr-1" />
              ML Engines
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              Data Quality
              <InfoTooltip tooltipKey="dataQuality" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-white mb-1">
              {healthData.systemHealth.dataQualityScore}%
            </div>
            <Progress 
              value={healthData.systemHealth.dataQualityScore} 
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
              Last Reset
              <InfoTooltip tooltipKey="lastReset" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-white mb-1">
              {healthData.systemHealth.lastModelReset 
                ? format(new Date(healthData.systemHealth.lastModelReset), 'MMM dd, HH:mm')
                : 'Never'
              }
            </div>
            <div className="flex items-center text-xs text-gray-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Stable
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Weights and Confidence Thresholds */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Current Feature Weights
              <InfoTooltip tooltipKey="featureWeights" />
            </CardTitle>
            <CardDescription>Real-time ML feature importance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(healthData.featureWeights).map(([feature, weight], index) => (
                <div key={feature} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{feature}</span>
                    <span className="text-white font-mono">{formatPercentage(weight)}</span>
                  </div>
                  <Progress 
                    value={weight * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Confidence Thresholds
              <InfoTooltip tooltipKey="confidenceThresholds" />
            </CardTitle>
            <CardDescription>Adaptive threshold management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-900/20">
                <span className="text-gray-300">Current Confidence</span>
                <span className="text-white font-mono text-lg">
                  {healthData.confidenceThresholds.current?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-900/20">
                <span className="text-gray-300">Minimum Threshold</span>
                <span className="text-white font-mono text-lg">
                  {healthData.confidenceThresholds.minimum?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-900/20">
                <span className="text-gray-300">Adaptive Threshold</span>
                <span className="text-white font-mono text-lg">
                  {healthData.confidenceThresholds.adaptive?.toFixed(1) || '0.0'}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Accuracy and Recent Trades */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Model Accuracy by Type
              <InfoTooltip tooltipKey="modelAccuracy" />
            </CardTitle>
            <CardDescription>24-hour performance breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {healthData.modelAccuracyByType && healthData.modelAccuracyByType.length > 0 ? (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={healthData.modelAccuracyByType} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="model" 
                      stroke="#9ca3af"
                      fontSize={12}
                      interval={0}
                      angle={-5}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                      formatter={(value, name) => [`${value}%`, 'Accuracy']}
                      labelStyle={{ color: '#ffffff' }}
                    />
                    <Bar 
                      dataKey="accuracy" 
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      strokeWidth={0}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
                  <div className="text-gray-300 font-medium mb-2">Collecting Model Data</div>
                  <div className="text-sm text-gray-500">
                    Model accuracy metrics will appear here as the system accumulates more trading data over time.
                  </div>
                  <div className="text-xs text-blue-400 mt-2">
                    ⏳ Building historical performance records...
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Recent Trade Outcomes
              <InfoTooltip tooltipKey="recentTrades" />
            </CardTitle>
            <CardDescription>Last {healthData.recentTradeOutcomes.length} completed trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {healthData.recentTradeOutcomes.slice(0, 10).map((trade, index) => (
                <div 
                  key={trade.id} 
                  className="flex items-center justify-between p-2 rounded bg-gray-800/40"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={
                      trade.actualOutcome === 'TP_HIT' ? 'default' :
                      trade.actualOutcome === 'SL_HIT' ? 'destructive' : 'secondary'
                    }>
                      {trade.symbol}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {trade.signalType}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-mono ${
                      parseFloat(trade.profitLoss) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(parseFloat(trade.profitLoss))}
                    </div>
                    <div className="text-xs text-gray-400">
                      {trade.confidence}% conf
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rolling Performance Metrics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Rolling Win Rate
              <InfoTooltip tooltipKey="rollingWinRate" />
            </CardTitle>
            <CardDescription>24-hour trend analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {healthData.rollingMetrics && healthData.rollingMetrics.winRate && healthData.rollingMetrics.winRate.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={healthData.rollingMetrics.winRate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Win Rate']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    fill="#10b98120"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
                  <div className="text-gray-300 font-medium mb-2">Building Performance History</div>
                  <div className="text-sm text-gray-500">
                    Rolling win rate trends will display as the system accumulates more trading performance data.
                  </div>
                  <div className="text-xs text-blue-400 mt-2">
                    ⏳ Collecting performance metrics...
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              Feature Weight Evolution
              <InfoTooltip tooltipKey="featureEvolution" />
            </CardTitle>
            <CardDescription>ML learning adaptation over time</CardDescription>
          </CardHeader>
          <CardContent>
            {healthData.rollingMetrics && healthData.rollingMetrics.featureWeightEvolution && healthData.rollingMetrics.featureWeightEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={healthData.rollingMetrics.featureWeightEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    domain={[0, 0.3]}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                  />
                  <Legend />
                  {Object.keys(healthData.featureWeights).slice(0, 5).map((feature, index) => (
                    <Line 
                      key={feature}
                      type="monotone" 
                      dataKey={feature} 
                      stroke={COLORS[index]} 
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
                  <div className="text-gray-300 font-medium mb-2">Learning Algorithm Initialization</div>
                  <div className="text-sm text-gray-500">
                    Feature weight evolution charts will appear as the ML system learns from trading outcomes.
                  </div>
                  <div className="text-xs text-blue-400 mt-2">
                    ⏳ Training models and adjusting weights...
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Regime Change Alerts */}
      {healthData.regimeChangeAlerts.length > 0 && (
        <Card className="bg-black/20 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Regime Change Alerts
              <InfoTooltip tooltipKey="regimeAlerts" />
            </CardTitle>
            <CardDescription>Recent market regime changes detected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthData.regimeChangeAlerts.map((alert, index) => (
                <Alert 
                  key={index}
                  className={`border-l-4 ${
                    alert.severity === 'high' ? 'border-red-500 bg-red-900/20' : 
                    'border-yellow-500 bg-yellow-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">
                        {alert.symbol} - {alert.operation}
                      </div>
                      <AlertDescription className="text-gray-300">
                        {alert.message}
                      </AlertDescription>
                    </div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(alert.timestamp), 'HH:mm:ss')}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}