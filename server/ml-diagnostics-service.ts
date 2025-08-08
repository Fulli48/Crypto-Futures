/**
 * COMPREHENSIVE ML DIAGNOSTICS SERVICE
 * 
 * Advanced monitoring and diagnostics system for all ML components:
 * - Feature weight tracking and analysis
 * - Model accuracy logging and trends
 * - Regime change detection for performance metrics
 * - Error tracking with full context
 * - Real-time performance monitoring
 */

import { db } from './db';
import { mlDiagnostics, tradeSimulations } from '@shared/schema';
import { desc, eq, and, gte, sql } from 'drizzle-orm';

export interface DiagnosticEntry {
  component: 'MLTradeSignalEngine' | 'SelfImprovingMLEngine' | 'TradeCompletionMonitor';
  diagnosticType: 'training_cycle' | 'regime_change' | 'error_alert' | 'performance_update';
  featureWeights?: Record<string, number>;
  topFeatures?: Array<{ name: string; weight: number; importance: number }>;
  bottomFeatures?: Array<{ name: string; weight: number; importance: number }>;
  weightChanges?: Record<string, { old: number; new: number; change: number }>;
  modelAccuracy?: number;
  inSampleAccuracy?: number;
  outOfSampleAccuracy?: number;
  confidenceThreshold?: number;
  profitThreshold?: number;
  rollingWinRate?: number;
  rollingMeanPnL?: number;
  rollingMaxDrawdown?: number;
  sampleSize?: number;
  regimeChangeDetected?: boolean;
  regimeType?: 'win_rate_drop' | 'pnl_decline' | 'drawdown_spike' | 'recovery';
  regimeThreshold?: number;
  regimeValue?: number;
  consecutiveRegimePeriods?: number;
  errorType?: 'weight_bound_hit' | 'data_anomaly' | 'calculation_error' | 'api_failure';
  errorMessage?: string;
  errorSeverity?: 'low' | 'medium' | 'high' | 'critical';
  stackTrace?: string;
  symbol?: string;
  tradesAnalyzed?: number;
  contextData?: Record<string, any>;
}

export interface RegimeDetectionConfig {
  winRateThreshold: number; // e.g., 0.4 (40% win rate minimum)
  pnlThreshold: number; // e.g., -2.0 (2% average loss threshold)
  drawdownThreshold: number; // e.g., 5.0 (5% maximum drawdown)
  consecutivePeriodsRequired: number; // e.g., 3 (3 consecutive periods to confirm regime)
  rollingWindowSize: number; // e.g., 20 (trades to analyze)
}

export class MLDiagnosticsService {
  private regimeConfig: RegimeDetectionConfig = {
    winRateThreshold: 0.35, // 35% minimum win rate
    pnlThreshold: -1.5, // -1.5% average P&L threshold
    drawdownThreshold: 4.0, // 4% maximum drawdown threshold
    consecutivePeriodsRequired: 2, // 2 consecutive periods to confirm
    rollingWindowSize: 25 // Analyze last 25 trades
  };

  private lastRegimeState: Map<string, any> = new Map();

  /**
   * Log comprehensive diagnostics entry to database and console
   */
  async logDiagnostic(entry: DiagnosticEntry): Promise<void> {
    try {
      // Enhanced console logging with timestamps and formatting
      const timestamp = new Date().toISOString();
      const prefix = this.getLogPrefix(entry.component, entry.diagnosticType);
      
      console.log(`${prefix} [${timestamp}] ${entry.component} - ${entry.diagnosticType.toUpperCase()}`);
      
      if (entry.featureWeights) {
        console.log(`${prefix} Feature weights: ${JSON.stringify(entry.featureWeights, null, 2)}`);
      }
      
      if (entry.topFeatures) {
        console.log(`${prefix} Top 5 features:`, entry.topFeatures.map(f => `${f.name}: ${f.weight.toFixed(3)} (${f.importance.toFixed(1)}%)`));
      }
      
      if (entry.modelAccuracy !== undefined) {
        console.log(`${prefix} Model accuracy: ${(entry.modelAccuracy * 100).toFixed(1)}%`);
      }
      
      if (entry.regimeChangeDetected) {
        console.log(`🚨 ${prefix} REGIME CHANGE DETECTED: ${entry.regimeType} - Value: ${entry.regimeValue}, Threshold: ${entry.regimeThreshold}`);
      }
      
      if (entry.errorMessage) {
        const severity = entry.errorSeverity?.toUpperCase() || 'UNKNOWN';
        console.log(`❌ ${prefix} [${severity}] ${entry.errorType}: ${entry.errorMessage}`);
        if (entry.stackTrace) {
          console.log(`${prefix} Stack trace: ${entry.stackTrace}`);
        }
      }

      // Store to database
      await db.insert(mlDiagnostics).values({
        component: entry.component,
        diagnosticType: entry.diagnosticType,
        featureWeights: entry.featureWeights || null,
        topFeatures: entry.topFeatures || null,
        bottomFeatures: entry.bottomFeatures || null,
        weightChanges: entry.weightChanges || null,
        modelAccuracy: entry.modelAccuracy || null,
        inSampleAccuracy: entry.inSampleAccuracy || null,
        outOfSampleAccuracy: entry.outOfSampleAccuracy || null,
        confidenceThreshold: entry.confidenceThreshold || null,
        profitThreshold: entry.profitThreshold || null,
        rollingWinRate: entry.rollingWinRate || null,
        rollingMeanPnL: entry.rollingMeanPnL ? entry.rollingMeanPnL.toString() : null,
        rollingMaxDrawdown: entry.rollingMaxDrawdown ? entry.rollingMaxDrawdown.toString() : null,
        sampleSize: entry.sampleSize || null,
        regimeChangeDetected: entry.regimeChangeDetected || false,
        regimeType: entry.regimeType || null,
        regimeThreshold: entry.regimeThreshold || null,
        regimeValue: entry.regimeValue || null,
        consecutiveRegimePeriods: entry.consecutiveRegimePeriods || 0,
        errorType: entry.errorType || null,
        errorMessage: entry.errorMessage || null,
        errorSeverity: entry.errorSeverity || null,
        stackTrace: entry.stackTrace || null,
        symbol: entry.symbol || null,
        tradesAnalyzed: entry.tradesAnalyzed || null,
        contextData: entry.contextData || null,
      });

    } catch (error) {
      console.error('❌ [ML DIAGNOSTICS] Failed to log diagnostic entry:', error);
    }
  }

  /**
   * Log training cycle completion with feature analysis
   */
  async logTrainingCycle(
    component: DiagnosticEntry['component'],
    featureWeights: Record<string, number>,
    modelAccuracy: number,
    tradesAnalyzed: number,
    previousWeights?: Record<string, number>
  ): Promise<void> {
    // Calculate feature importance and identify top/bottom performers
    const weightEntries = Object.entries(featureWeights);
    const totalWeight = weightEntries.reduce((sum, [, weight]) => sum + Math.abs(weight), 0);
    
    const featuresWithImportance = weightEntries.map(([name, weight]) => ({
      name,
      weight,
      importance: totalWeight > 0 ? (Math.abs(weight) / totalWeight) * 100 : 0
    }));
    
    // Sort by importance (descending)
    featuresWithImportance.sort((a, b) => b.importance - a.importance);
    
    const topFeatures = featuresWithImportance.slice(0, 5);
    const bottomFeatures = featuresWithImportance.slice(-5).reverse();
    
    // Calculate weight changes if previous weights provided
    let weightChanges: Record<string, { old: number; new: number; change: number }> | undefined;
    if (previousWeights) {
      weightChanges = {};
      for (const [indicator, newWeight] of Object.entries(featureWeights)) {
        const oldWeight = previousWeights[indicator] || 0;
        const change = ((newWeight - oldWeight) / Math.abs(oldWeight || 1)) * 100;
        if (Math.abs(change) > 1) { // Only track significant changes > 1%
          weightChanges[indicator] = { old: oldWeight, new: newWeight, change };
        }
      }
    }

    await this.logDiagnostic({
      component,
      diagnosticType: 'training_cycle',
      featureWeights,
      topFeatures,
      bottomFeatures,
      weightChanges,
      modelAccuracy,
      tradesAnalyzed,
      contextData: {
        totalFeatures: weightEntries.length,
        averageWeight: totalWeight / weightEntries.length,
        trainingTimestamp: Date.now()
      }
    });
  }

  /**
   * Analyze performance metrics and detect regime changes
   */
  async analyzePerformanceRegime(
    component: DiagnosticEntry['component'],
    symbol?: string
  ): Promise<void> {
    try {
      // Get recent completed trades for analysis
      const recentTrades = await db
        .select()
        .from(tradeSimulations)
        .where(
          and(
            symbol ? eq(tradeSimulations.symbol, symbol) : sql`1=1`,
            eq(tradeSimulations.actualOutcome, 'TP_HIT')
              .or(eq(tradeSimulations.actualOutcome, 'SL_HIT'))
              .or(eq(tradeSimulations.actualOutcome, 'EXPIRED'))
          )
        )
        .orderBy(desc(tradeSimulations.createdAt))
        .limit(this.regimeConfig.rollingWindowSize);

      if (recentTrades.length < 10) {
        console.log(`⚠️ [ML DIAGNOSTICS] Insufficient trades (${recentTrades.length}) for regime analysis`);
        return;
      }

      // Calculate rolling performance metrics
      const successfulTrades = recentTrades.filter(trade => {
        if (trade.isSuccessful === true) return true;
        if (trade.isSuccessful === false) return false;
        return parseFloat(trade.successScore?.toString() || '0') > 0;
      });

      const winRate = successfulTrades.length / recentTrades.length;
      
      const totalPnL = recentTrades.reduce((sum, trade) => 
        sum + parseFloat(trade.profitLoss?.toString() || '0'), 0
      );
      const meanPnL = totalPnL / recentTrades.length;
      
      const maxDrawdown = Math.max(...recentTrades.map(trade => 
        Math.abs(parseFloat(trade.maxDrawdown?.toString() || '0'))
      ));

      // Check for regime changes
      const regimeKey = symbol || 'global';
      const lastState = this.lastRegimeState.get(regimeKey) || {
        consecutiveWinRateDrop: 0,
        consecutivePnLDecline: 0,
        consecutiveDrawdownSpike: 0
      };

      let regimeChangeDetected = false;
      let regimeType: DiagnosticEntry['regimeType'];
      let regimeThreshold: number;
      let regimeValue: number;
      let consecutiveRegimePeriods = 0;

      // Check win rate regime
      if (winRate < this.regimeConfig.winRateThreshold) {
        lastState.consecutiveWinRateDrop++;
        if (lastState.consecutiveWinRateDrop >= this.regimeConfig.consecutivePeriodsRequired) {
          regimeChangeDetected = true;
          regimeType = 'win_rate_drop';
          regimeThreshold = this.regimeConfig.winRateThreshold;
          regimeValue = winRate;
          consecutiveRegimePeriods = lastState.consecutiveWinRateDrop;
        }
      } else {
        lastState.consecutiveWinRateDrop = 0;
      }

      // Check P&L regime
      if (meanPnL < this.regimeConfig.pnlThreshold) {
        lastState.consecutivePnLDecline++;
        if (lastState.consecutivePnLDecline >= this.regimeConfig.consecutivePeriodsRequired && !regimeChangeDetected) {
          regimeChangeDetected = true;
          regimeType = 'pnl_decline';
          regimeThreshold = this.regimeConfig.pnlThreshold;
          regimeValue = meanPnL;
          consecutiveRegimePeriods = lastState.consecutivePnLDecline;
        }
      } else {
        lastState.consecutivePnLDecline = 0;
      }

      // Check drawdown regime
      if (maxDrawdown > this.regimeConfig.drawdownThreshold) {
        lastState.consecutiveDrawdownSpike++;
        if (lastState.consecutiveDrawdownSpike >= this.regimeConfig.consecutivePeriodsRequired && !regimeChangeDetected) {
          regimeChangeDetected = true;
          regimeType = 'drawdown_spike';
          regimeThreshold = this.regimeConfig.drawdownThreshold;
          regimeValue = maxDrawdown;
          consecutiveRegimePeriods = lastState.consecutiveDrawdownSpike;
        }
      } else {
        lastState.consecutiveDrawdownSpike = 0;
      }

      // Update state
      this.lastRegimeState.set(regimeKey, lastState);

      // Log performance update
      await this.logDiagnostic({
        component,
        diagnosticType: regimeChangeDetected ? 'regime_change' : 'performance_update',
        rollingWinRate: winRate,
        rollingMeanPnL: meanPnL,
        rollingMaxDrawdown: maxDrawdown,
        sampleSize: recentTrades.length,
        regimeChangeDetected,
        regimeType,
        regimeThreshold,
        regimeValue,
        consecutiveRegimePeriods,
        symbol,
        tradesAnalyzed: recentTrades.length,
        contextData: {
          successfulTrades: successfulTrades.length,
          totalTrades: recentTrades.length,
          analysisTimestamp: Date.now(),
          thresholds: this.regimeConfig
        }
      });

    } catch (error) {
      await this.logError(component, 'calculation_error', 'regime_analysis', 'medium', 
        `Performance regime analysis failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Log errors with full context and severity
   */
  async logError(
    component: DiagnosticEntry['component'],
    errorType: DiagnosticEntry['errorType'],
    context: string,
    severity: DiagnosticEntry['errorSeverity'],
    message: string,
    stackTrace?: string,
    symbol?: string
  ): Promise<void> {
    await this.logDiagnostic({
      component,
      diagnosticType: 'error_alert',
      errorType,
      errorMessage: `[${context}] ${message}`,
      errorSeverity: severity,
      stackTrace,
      symbol,
      contextData: {
        context,
        timestamp: Date.now(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      }
    });
  }

  /**
   * Get recent diagnostics for a component
   */
  async getRecentDiagnostics(
    component?: DiagnosticEntry['component'],
    hours: number = 24,
    limit: number = 100
  ) {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const query = db
      .select()
      .from(mlDiagnostics)
      .where(
        and(
          component ? eq(mlDiagnostics.component, component) : sql`1=1`,
          gte(mlDiagnostics.timestamp, hoursAgo)
        )
      )
      .orderBy(desc(mlDiagnostics.timestamp))
      .limit(limit);

    return await query;
  }

  /**
   * Get system health summary
   */
  async getSystemHealthSummary() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [recentDiagnostics, recentErrors, regimeChanges] = await Promise.all([
      db.select().from(mlDiagnostics)
        .where(gte(mlDiagnostics.timestamp, last24Hours))
        .orderBy(desc(mlDiagnostics.timestamp)),
      
      db.select().from(mlDiagnostics)
        .where(and(
          eq(mlDiagnostics.diagnosticType, 'error_alert'),
          gte(mlDiagnostics.timestamp, last24Hours)
        ))
        .orderBy(desc(mlDiagnostics.timestamp)),
      
      db.select().from(mlDiagnostics)
        .where(and(
          eq(mlDiagnostics.regimeChangeDetected, true),
          gte(mlDiagnostics.timestamp, last24Hours)
        ))
        .orderBy(desc(mlDiagnostics.timestamp))
    ]);

    return {
      totalDiagnostics: recentDiagnostics.length,
      totalErrors: recentErrors.length,
      totalRegimeChanges: regimeChanges.length,
      componentActivity: this.summarizeComponentActivity(recentDiagnostics),
      errorBreakdown: this.summarizeErrors(recentErrors),
      regimeChanges: regimeChanges.slice(0, 5), // Latest 5 regime changes
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Helper: Generate appropriate log prefix based on component and type
   */
  private getLogPrefix(component: string, type: string): string {
    const prefixes = {
      'MLTradeSignalEngine': '🧠',
      'SelfImprovingMLEngine': '📈',
      'TradeCompletionMonitor': '📊'
    };
    
    const typePrefixes = {
      'training_cycle': '🔄',
      'regime_change': '🚨',
      'error_alert': '❌',
      'performance_update': '📊'
    };
    
    return `${prefixes[component] || '🔧'} ${typePrefixes[type] || '📝'} [ML DIAGNOSTICS]`;
  }

  /**
   * Helper: Summarize component activity
   */
  private summarizeComponentActivity(diagnostics: any[]) {
    const summary = {};
    
    for (const diagnostic of diagnostics) {
      const component = diagnostic.component;
      if (!summary[component]) {
        summary[component] = {
          totalEntries: 0,
          trainingCycles: 0,
          errors: 0,
          regimeChanges: 0,
          lastActivity: null
        };
      }
      
      summary[component].totalEntries++;
      if (diagnostic.diagnosticType === 'training_cycle') summary[component].trainingCycles++;
      if (diagnostic.diagnosticType === 'error_alert') summary[component].errors++;
      if (diagnostic.regimeChangeDetected) summary[component].regimeChanges++;
      
      if (!summary[component].lastActivity || diagnostic.timestamp > summary[component].lastActivity) {
        summary[component].lastActivity = diagnostic.timestamp;
      }
    }
    
    return summary;
  }

  /**
   * Helper: Summarize error patterns
   */
  private summarizeErrors(errors: any[]) {
    const breakdown = {
      byType: {},
      bySeverity: {},
      byComponent: {}
    };
    
    for (const error of errors) {
      // By type
      if (!breakdown.byType[error.errorType]) breakdown.byType[error.errorType] = 0;
      breakdown.byType[error.errorType]++;
      
      // By severity
      if (!breakdown.bySeverity[error.errorSeverity]) breakdown.bySeverity[error.errorSeverity] = 0;
      breakdown.bySeverity[error.errorSeverity]++;
      
      // By component
      if (!breakdown.byComponent[error.component]) breakdown.byComponent[error.component] = 0;
      breakdown.byComponent[error.component]++;
    }
    
    return breakdown;
  }
}

// Export singleton instance
export const mlDiagnosticsService = new MLDiagnosticsService();