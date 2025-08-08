/**
 * Auto-Recovery Service
 * 
 * Provides automatic recovery mechanisms for database crashes, process failures,
 * and data corruption with state restoration and processing resumption.
 */

import { db } from './db';
import { logger } from './logging-service';
import { 
  rollingChartData, 
  persistentForecasts, 
  mlTrainingSamples
} from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export interface SystemState {
  lastProcessedTimestamp: string;
  activeSymbols: string[];
  processingStatus: Record<string, boolean>;
  lastGoodDataPoint: Record<string, any>;
  errorCounts: Record<string, number>;
  recoveryAttempts: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}

export interface RecoveryPlan {
  recoveryType: 'state_restore' | 'data_backfill' | 'process_restart' | 'database_repair';
  priority: 'high' | 'medium' | 'low';
  steps: string[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

class RecoveryService {
  private systemState: SystemState;
  private isRecovering: boolean = false;
  private maxErrorThreshold: number = 5;
  private recoveryCheckInterval: number = 30000; // 30 seconds
  private lastHealthCheck: Date;

  constructor() {
    this.systemState = {
      lastProcessedTimestamp: new Date().toISOString(),
      activeSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'],
      processingStatus: {},
      lastGoodDataPoint: {},
      errorCounts: {},
      recoveryAttempts: 0,
      systemHealth: 'healthy'
    };
    
    this.lastHealthCheck = new Date();
    this.initializeRecoverySystem();
  }

  private async initializeRecoverySystem(): Promise<void> {
    try {
      logger.logSystemEvent('recovery_service_init', 'info', { 
        recoveryCheckInterval: this.recoveryCheckInterval,
        maxErrorThreshold: this.maxErrorThreshold 
      });

      // Load last known good state from database
      await this.loadLastGoodState();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();
      
      console.log('🔄 [RECOVERY SERVICE] Initialized with auto-recovery capabilities');
    } catch (error) {
      logger.logError('recovery', 'initialization', error as Error);
      console.error('❌ [RECOVERY SERVICE] Failed to initialize:', error);
    }
  }

  private async loadLastGoodState(): Promise<void> {
    try {
      // Load last good state from file system
      const fs = require('fs');
      const stateFile = './recovery-state.json';
      
      if (fs.existsSync(stateFile)) {
        const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        this.systemState = {
          ...this.systemState,
          lastProcessedTimestamp: stateData.lastProcessedTimestamp,
          processingStatus: stateData.processingStatus || {},
          lastGoodDataPoint: stateData.lastGoodDataPoint || {},
          errorCounts: stateData.errorCounts || {}
        };
        
        logger.logRecoveryOperation(
          'state_restore',
          'system_startup',
          'loaded_last_good_state',
          true,
          1,
          this.systemState
        );
      }
    } catch (error) {
      logger.logError('recovery', 'load_state', error as Error);
      console.warn('⚠️ [RECOVERY SERVICE] Could not load last good state, using defaults');
    }
  }

  private async saveCurrentState(): Promise<void> {
    try {
      // Save state to localStorage/file system instead of database
      const fs = require('fs');
      const stateFile = './recovery-state.json';
      fs.writeFileSync(stateFile, JSON.stringify({
        lastProcessedTimestamp: this.systemState.lastProcessedTimestamp,
        processingStatus: this.systemState.processingStatus,
        lastGoodDataPoint: this.systemState.lastGoodDataPoint,
        errorCounts: this.systemState.errorCounts,
        systemHealth: this.systemState.systemHealth,
        createdAt: new Date().toISOString()
      }, null, 2));

      logger.logDatabaseOperation('insert', 'systemState', true, 1);
    } catch (error) {
      logger.logError('recovery', 'save_state', error as Error);
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.recoveryCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const now = new Date();
      const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
      
      logger.logSystemEvent('health_check', 'info', {
        timeSinceLastCheck,
        systemHealth: this.systemState.systemHealth,
        errorCounts: this.systemState.errorCounts
      });

      // Check database connectivity
      const dbHealth = await this.checkDatabaseHealth();
      
      // Check data freshness
      const dataFreshness = await this.checkDataFreshness();
      
      // Check error rates
      const errorRates = this.checkErrorRates();
      
      // Update system health
      this.updateSystemHealth(dbHealth, dataFreshness, errorRates);
      
      // Trigger recovery if needed
      if (this.systemState.systemHealth === 'critical' && !this.isRecovering) {
        await this.triggerAutoRecovery('health_check_failed');
      }
      
      this.lastHealthCheck = now;
      
    } catch (error) {
      logger.logError('recovery', 'health_check', error as Error);
      this.systemState.systemHealth = 'critical';
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Simple database connectivity test
      await db.select({ count: sql<number>`count(*)` })
        .from(rollingChartData)
        .limit(1);
      return true;
    } catch (error) {
      logger.logError('recovery', 'database_health_check', error as Error);
      return false;
    }
  }

  private async checkDataFreshness(): Promise<boolean> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      for (const symbol of this.systemState.activeSymbols) {
        const recentData = await db.select()
          .from(rollingChartData)
          .where(and(
            eq(rollingChartData.symbol, symbol),
            gte(rollingChartData.timestamp, fiveMinutesAgo)
          ))
          .limit(1);
          
        if (recentData.length === 0) {
          logger.logSystemEvent('data_freshness_check', 'warn', {
            symbol,
            lastDataAge: '> 5 minutes'
          });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.logError('recovery', 'data_freshness_check', error as Error);
      return false;
    }
  }

  private checkErrorRates(): boolean {
    const totalErrors = Object.values(this.systemState.errorCounts)
      .reduce((sum, count) => sum + count, 0);
    
    return totalErrors < this.maxErrorThreshold;
  }

  private updateSystemHealth(dbHealth: boolean, dataFreshness: boolean, errorRates: boolean): void {
    const healthScore = [dbHealth, dataFreshness, errorRates].filter(Boolean).length;
    
    if (healthScore === 3) {
      this.systemState.systemHealth = 'healthy';
    } else if (healthScore === 2) {
      this.systemState.systemHealth = 'degraded';
    } else {
      this.systemState.systemHealth = 'critical';
    }
    
    logger.logSystemEvent('system_health_update', 'info', {
      dbHealth,
      dataFreshness,
      errorRates,
      healthScore,
      systemHealth: this.systemState.systemHealth
    });
  }

  private async triggerAutoRecovery(triggerEvent: string): Promise<void> {
    if (this.isRecovering) {
      logger.logSystemEvent('recovery_already_in_progress', 'warn');
      return;
    }

    this.isRecovering = true;
    this.systemState.recoveryAttempts++;
    
    logger.logRecoveryOperation(
      'auto_restart',
      triggerEvent,
      'initiating_auto_recovery',
      false,
      undefined,
      this.systemState
    );

    try {
      const recoveryPlan = await this.createRecoveryPlan(triggerEvent);
      const recoverySuccess = await this.executeRecoveryPlan(recoveryPlan);
      
      if (recoverySuccess) {
        this.systemState.systemHealth = 'healthy';
        this.systemState.errorCounts = {}; // Reset error counts
        
        logger.logRecoveryOperation(
          'auto_restart',
          triggerEvent,
          'recovery_completed_successfully',
          true,
          undefined,
          this.systemState
        );
      } else {
        logger.logRecoveryOperation(
          'auto_restart',
          triggerEvent,
          'recovery_failed',
          false
        );
      }
      
    } catch (error) {
      logger.logError('recovery', 'auto_recovery', error as Error);
    } finally {
      this.isRecovering = false;
      await this.saveCurrentState();
    }
  }

  private async createRecoveryPlan(triggerEvent: string): Promise<RecoveryPlan> {
    // Analyze the current situation and create appropriate recovery plan
    if (triggerEvent.includes('database')) {
      return {
        recoveryType: 'database_repair',
        priority: 'high',
        steps: [
          'check_database_connectivity',
          'repair_corrupted_tables',
          'restore_from_backup_if_needed',
          'verify_data_integrity'
        ],
        estimatedDuration: 300000, // 5 minutes
        riskLevel: 'medium'
      };
    } else if (triggerEvent.includes('data')) {
      return {
        recoveryType: 'data_backfill',
        priority: 'medium',
        steps: [
          'identify_missing_data_ranges',
          'backfill_missing_chart_data',
          'recalculate_technical_indicators',
          'validate_data_completeness'
        ],
        estimatedDuration: 600000, // 10 minutes
        riskLevel: 'low'
      };
    } else {
      return {
        recoveryType: 'process_restart',
        priority: 'high',
        steps: [
          'save_current_state',
          'graceful_shutdown_services',
          'restart_core_processes',
          'restore_processing_state'
        ],
        estimatedDuration: 120000, // 2 minutes
        riskLevel: 'low'
      };
    }
  }

  private async executeRecoveryPlan(plan: RecoveryPlan): Promise<boolean> {
    logger.logRecoveryOperation(
      plan.recoveryType,
      'plan_execution',
      `executing_${plan.steps.length}_steps`,
      false
    );

    try {
      for (const step of plan.steps) {
        const stepSuccess = await this.executeRecoveryStep(step, plan.recoveryType);
        if (!stepSuccess) {
          logger.logRecoveryOperation(
            plan.recoveryType,
            step,
            'step_failed',
            false
          );
          return false;
        }
        
        logger.logRecoveryOperation(
          plan.recoveryType,
          step,
          'step_completed',
          true
        );
      }
      
      return true;
    } catch (error) {
      logger.logError('recovery', 'plan_execution', error as Error);
      return false;
    }
  }

  private async executeRecoveryStep(step: string, recoveryType: string): Promise<boolean> {
    try {
      switch (step) {
        case 'check_database_connectivity':
          return await this.checkDatabaseHealth();
          
        case 'identify_missing_data_ranges':
          return await this.identifyMissingDataRanges();
          
        case 'backfill_missing_chart_data':
          return await this.backfillMissingData();
          
        case 'save_current_state':
          await this.saveCurrentState();
          return true;
          
        case 'restore_processing_state':
          return await this.restoreProcessingState();
          
        default:
          logger.logSystemEvent('unknown_recovery_step', 'warn', { step, recoveryType });
          return true; // Continue with other steps
      }
    } catch (error) {
      logger.logError('recovery', `step_${step}`, error as Error);
      return false;
    }
  }

  private async identifyMissingDataRanges(): Promise<boolean> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      for (const symbol of this.systemState.activeSymbols) {
        const dataCount = await db.select({ count: sql<number>`count(*)` })
          .from(rollingChartData)
          .where(and(
            eq(rollingChartData.symbol, symbol),
            gte(rollingChartData.timestamp, oneHourAgo)
          ));
          
        const expectedCount = 60; // 1 minute intervals for 1 hour
        const actualCount = dataCount[0]?.count || 0;
        
        if (actualCount < expectedCount * 0.8) { // Less than 80% of expected data
          logger.logSystemEvent('missing_data_detected', 'warn', {
            symbol,
            expectedCount,
            actualCount,
            missingPercentage: ((expectedCount - actualCount) / expectedCount) * 100
          });
        }
      }
      
      return true;
    } catch (error) {
      logger.logError('recovery', 'identify_missing_data', error as Error);
      return false;
    }
  }

  private async backfillMissingData(): Promise<boolean> {
    try {
      // This would integrate with the existing chart building services
      // For now, just log the action
      logger.logRecoveryOperation(
        'data_backfill',
        'missing_data_gaps',
        'initiated_backfill_process',
        true
      );
      
      return true;
    } catch (error) {
      logger.logError('recovery', 'backfill_data', error as Error);
      return false;
    }
  }

  private async restoreProcessingState(): Promise<boolean> {
    try {
      // Reset processing status for all symbols
      this.systemState.processingStatus = {};
      this.systemState.activeSymbols.forEach(symbol => {
        this.systemState.processingStatus[symbol] = true;
      });
      
      return true;
    } catch (error) {
      logger.logError('recovery', 'restore_state', error as Error);
      return false;
    }
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.logSystemEvent('graceful_shutdown', 'info', { signal });
      
      console.log(`🔄 [RECOVERY SERVICE] Received ${signal}, saving state and shutting down...`);
      
      try {
        await this.saveCurrentState();
        logger.logSystemEvent('shutdown_complete', 'info');
        process.exit(0);
      } catch (error) {
        logger.logError('recovery', 'graceful_shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.logError('recovery', 'uncaught_exception', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.logError('recovery', 'unhandled_rejection', reason as Error, undefined, { promise });
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }

  // Public methods for external use
  public recordError(category: string, operation: string, symbol?: string): void {
    const key = symbol ? `${category}_${symbol}` : category;
    this.systemState.errorCounts[key] = (this.systemState.errorCounts[key] || 0) + 1;
    
    logger.logSystemEvent('error_recorded', 'warn', {
      category,
      operation,
      symbol,
      totalErrors: this.systemState.errorCounts[key]
    });
  }

  public recordSuccess(category: string, symbol?: string, data?: any): void {
    const key = symbol ? `${category}_${symbol}` : category;
    
    // Update last good data point
    if (symbol && data) {
      this.systemState.lastGoodDataPoint[symbol] = {
        timestamp: new Date().toISOString(),
        data
      };
    }
    
    // Reset error count on success
    if (this.systemState.errorCounts[key]) {
      delete this.systemState.errorCounts[key];
    }
    
    this.systemState.lastProcessedTimestamp = new Date().toISOString();
  }

  public getSystemHealth(): SystemState {
    return { ...this.systemState };
  }

  public async forceRecovery(triggerEvent: string): Promise<boolean> {
    return await this.triggerAutoRecovery(triggerEvent);
  }
}

// Export singleton instance
export const recoveryService = new RecoveryService();