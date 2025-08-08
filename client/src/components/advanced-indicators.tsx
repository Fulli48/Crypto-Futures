import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TrendingUp, TrendingDown, Activity, BarChart3, Target, Zap } from 'lucide-react';

interface AdvancedIndicatorsProps {
  indicators: any;
  signal: 'LONG' | 'SHORT' | 'ANALYZING';
}

export default function AdvancedIndicators({ indicators, signal }: AdvancedIndicatorsProps) {
  // Debug: Log what we're receiving
  console.log('📊 Advanced Indicators Component Rendering:', { 
    indicators, 
    hasIndicators: !!indicators,
    indicatorKeys: indicators ? Object.keys(indicators) : [],
    signal: signal,
    rsi: indicators?.rsi,
    macd: indicators?.macd,
    stochasticK: indicators?.stochasticK
  });
  
  if (!indicators) {
    console.log('🚫 Advanced Indicators: No indicators data provided, not rendering');
    return (
      <div className="bg-gray-800 p-4 rounded-lg border">
        <p className="text-gray-400">Loading technical indicators...</p>
      </div>
    );
  }

  // Helper functions for formatting and colors
  const getIndicatorColor = (value: number, bullish: number, bearish: number) => {
    if (value <= bearish) return 'text-red-400';
    if (value >= bullish) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'LONG': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'SHORT': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'BULL': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'BEAR': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatValue = (value: number, decimals = 2) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  return (
    <Card className="bg-gray-900/90 border border-gray-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Advanced Technical Indicators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="momentum" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
            <TabsTrigger value="momentum">Momentum</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="volatility">Volatility</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
          </TabsList>

          <TabsContent value="momentum" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* RSI */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">RSI (14)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getIndicatorColor(indicators.rsi, 70, 30)}`}>
                    {formatValue(indicators.rsi)}
                  </span>
                  <Badge className={indicators.rsi > 70 ? 'bg-red-500/20 text-red-400' : 
                                   indicators.rsi < 30 ? 'bg-green-500/20 text-green-400' : 
                                   'bg-gray-500/20 text-gray-400'}>
                    {indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral'}
                  </Badge>
                </div>
                <Progress value={indicators.rsi} className="h-2 bg-gray-800" />
              </div>

              {/* Williams %R */}
              {indicators.williamsR && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-gray-400">Williams %R</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${getIndicatorColor(indicators.williamsR, -20, -80)}`}>
                      {formatValue(indicators.williamsR)}
                    </span>
                    <Badge className={indicators.williamsR > -20 ? 'bg-red-500/20 text-red-400' : 
                                     indicators.williamsR < -80 ? 'bg-green-500/20 text-green-400' : 
                                     'bg-gray-500/20 text-gray-400'}>
                      {indicators.williamsR > -20 ? 'Overbought' : indicators.williamsR < -80 ? 'Oversold' : 'Neutral'}
                    </Badge>
                  </div>
                  <Progress value={Math.abs(indicators.williamsR)} className="h-2 bg-gray-800" />
                </div>
              )}

              {/* Stochastic */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Stochastic</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getIndicatorColor(indicators.stochasticK || indicators.stoch, 80, 20)}`}>
                    {formatValue(indicators.stochasticK || indicators.stoch)}
                  </span>
                  <Badge className={(indicators.stochasticK || indicators.stoch) > 80 ? 'bg-red-500/20 text-red-400' : 
                                   (indicators.stochasticK || indicators.stoch) < 20 ? 'bg-green-500/20 text-green-400' : 
                                   'bg-gray-500/20 text-gray-400'}>
                    {(indicators.stochasticK || indicators.stoch) > 80 ? 'Overbought' : (indicators.stochasticK || indicators.stoch) < 20 ? 'Oversold' : 'Neutral'}
                  </Badge>
                </div>
                <Progress value={indicators.stochasticK || indicators.stoch} className="h-2 bg-gray-800" />
                {indicators.stochasticD && (
                  <div className="text-xs text-gray-500">
                    %D: {formatValue(indicators.stochasticD)}
                  </div>
                )}
              </div>

              {/* CCI */}
              {indicators.cci && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-gray-400">CCI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${getIndicatorColor(Math.abs(indicators.cci), 100, 100)}`}>
                      {formatValue(indicators.cci)}
                    </span>
                    <Badge className={Math.abs(indicators.cci) > 100 ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-500/20 text-gray-400'}>
                      {indicators.cci > 100 ? 'Strong Bull' : indicators.cci < -100 ? 'Strong Bear' : 'Range'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trend" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* MACD */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">MACD</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Line</span>
                    <span className={(indicators.macd?.macd || indicators.macd || 0) > 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatValue(indicators.macd?.macd || indicators.macd, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Signal</span>
                    <span className="text-gray-300">{formatValue(indicators.macd?.signal || indicators.macdSignal, 4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Histogram</span>
                    <span className={(indicators.macd?.histogram || indicators.macdHistogram || 0) > 0 ? 'text-green-400' : 'text-red-400'}>
                      {formatValue(indicators.macd?.histogram || indicators.macdHistogram, 4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parabolic SAR */}
              {indicators.psar && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Parabolic SAR</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getSignalColor(indicators.psar.trend)}>
                      {indicators.psar.trend}
                    </Badge>
                    <span className="text-sm text-gray-300">{formatValue(indicators.psar.sar, 6)}</span>
                  </div>
                </div>
              )}

              {/* Aroon */}
              {indicators.aroon && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400">Aroon</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Up</span>
                      <span className="text-green-400">{formatValue(indicators.aroon.aroonUp)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Down</span>
                      <span className="text-red-400">{formatValue(indicators.aroon.aroonDown)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Oscillator</span>
                      <span className={indicators.aroon.oscillator > 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatValue(indicators.aroon.oscillator)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* EMA Alignment */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-400">EMA Alignment</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">EMA 9</span>
                    <span className="text-blue-400">{formatValue(indicators.ema9, 4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">EMA 21</span>
                    <span className="text-purple-400">{formatValue(indicators.ema21, 4)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">EMA 50</span>
                    <span className="text-orange-400">{formatValue(indicators.ema50, 4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="volatility" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Bollinger Bands */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Bollinger Bands</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Upper</span>
                    <span className="text-green-400">{formatValue(parseFloat(indicators.bollingerUpper) || 0, 6)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Middle</span>
                    <span className="text-blue-400">{formatValue(parseFloat(indicators.bollingerMiddle) || 0, 6)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Lower</span>
                    <span className="text-red-400">{formatValue(parseFloat(indicators.bollingerLower) || 0, 6)}</span>
                  </div>
                </div>
              </div>

              {/* Bollinger Bands Position */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">BB Position</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-300">
                    {formatValue((indicators.bbPosition || 0.5) * 100)}%
                  </span>
                  <Badge className={(indicators.bbPosition || 0.5) > 0.8 ? 'bg-red-500/20 text-red-400' : 
                                   (indicators.bbPosition || 0.5) < 0.2 ? 'bg-green-500/20 text-green-400' : 
                                   'bg-gray-500/20 text-gray-400'}>
                    {(indicators.bbPosition || 0.5) > 0.8 ? 'Upper' : (indicators.bbPosition || 0.5) < 0.2 ? 'Lower' : 'Middle'}
                  </Badge>
                </div>
                <Progress value={(indicators.bbPosition || 0.5) * 100} className="h-2 bg-gray-800" />
              </div>

              {/* ATR */}
              {indicators.atr_advanced && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-400">ATR (Volatility)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-orange-400">
                      {formatValue(indicators.atr_advanced, 6)}
                    </span>
                    <Badge className="bg-orange-500/20 text-orange-400">
                      {indicators.volatilityMultiplier > 1.1 ? 'High' : 
                       indicators.volatilityMultiplier < 0.9 ? 'Low' : 'Normal'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Rate of Change */}
              {indicators.roc && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-gray-400">Rate of Change</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${indicators.roc > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatValue(indicators.roc)}%
                    </span>
                    <Badge className={Math.abs(indicators.roc) > 2 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}>
                      {Math.abs(indicators.roc) > 2 ? 'Strong' : 'Weak'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Momentum */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-gray-400">5-Period Momentum</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${indicators.momentum5 > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatValue(indicators.momentum5)}%
                  </span>
                  <Badge className={Math.abs(indicators.momentum5) > 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}>
                    {Math.abs(indicators.momentum5) > 1 ? 'Strong' : 'Weak'}
                  </Badge>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="volume" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* VWAP */}
              {indicators.vwap && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-400">VWAP</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-green-400">
                      {formatValue(indicators.vwap, 6)}
                    </span>
                  </div>
                </div>
              )}

              {/* MFI */}
              {indicators.mfi && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Money Flow Index</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${getIndicatorColor(indicators.mfi, 80, 20)}`}>
                      {formatValue(indicators.mfi)}
                    </span>
                    <Badge className={indicators.mfi > 80 ? 'bg-red-500/20 text-red-400' : 
                                     indicators.mfi < 20 ? 'bg-green-500/20 text-green-400' : 
                                     'bg-gray-500/20 text-gray-400'}>
                      {indicators.mfi > 80 ? 'Overbought' : indicators.mfi < 20 ? 'Oversold' : 'Neutral'}
                    </Badge>
                  </div>
                  <Progress value={indicators.mfi} className="h-2 bg-gray-800" />
                </div>
              )}

              {/* Ichimoku Cloud */}
              {indicators.ichimoku && (
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm text-gray-400">Ichimoku Cloud</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tenkan-sen</span>
                      <span className="text-blue-400">{formatValue(indicators.ichimoku.tenkanSen, 4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Kijun-sen</span>
                      <span className="text-purple-400">{formatValue(indicators.ichimoku.kijunSen, 4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Senkou A</span>
                      <span className="text-green-400">{formatValue(indicators.ichimoku.senkouSpanA, 4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Senkou B</span>
                      <span className="text-orange-400">{formatValue(indicators.ichimoku.senkouSpanB, 4)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}