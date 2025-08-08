/**
 * Comprehensive Logging Service
 * 
 * Provides structured logging for all ML operations including feature calculations,
 * predictions, filter events, errors, and recovery operations with detailed audit trails.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'audit';
  category: 'feature' | 'prediction' | 'filter' | 'database' | 'recovery' | 'system';
  symbol?: string;
  operation: string;
  data?: any;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  metadata?: {
    duration?: number;
    inputCount?: number;
    outputCount?: number;
    confidence?: number;
    profitLikelihood?: number;
  };
}

export interface FeatureCalculationLog extends LogEntry {
  category: 'feature';
  data: {
    featureType: 'RSI' | 'MACD' | 'Bollinger' | 'Stochastic' | 'Volatility' | 'Volume' | 'Support' | 'Resistance';
    inputData: any;
    outputValue: number | null;
    calculationSuccess: boolean;
    windowSize?: number;
  };
}

export interface PredictionLog extends LogEntry {
  category: 'prediction';
  data: {
    modelType: 'ML_ENGINE' | 'DYNAMIC_ML' | 'ENSEMBLE';
    inputFeatures: Record<string, number>;
    prediction: {
      signal: 'LONG' | 'SHORT' | 'WAIT';
      confidence: number;
      profitLikelihood: number;
    };
    modelVersion?: string;
    trainingSize?: number;
  };
}

export interface FilterLog extends LogEntry {
  category: 'filter';
  data: {
    filterType: 'confidence' | 'profit_likelihood' | 'adaptive' | 'risk_reward';
    originalValues: Record<string, number>;
    filteredValues: Record<string, number>;
    filterPassed: boolean;
    thresholds: Record<string, number>;
  };
}

export interface DatabaseLog extends LogEntry {
  category: 'database';
  data: {
    operation: 'insert' | 'update' | 'select' | 'delete' | 'transaction';
    table: string;
    recordCount?: number;
    queryDuration?: number;
    success: boolean;
  };
}

export interface RecoveryLog extends LogEntry {
  category: 'recovery';
  data: {
    recoveryType: 'auto_restart' | 'state_restore' | 'backfill' | 'data_repair';
    triggerEvent: string;
    recoveryAction: string;
    affectedRecords?: number;
    recoverySuccess: boolean;
    lastGoodState?: any;
  };
}

class LoggingService {
  private logDir: string;
  private currentDate: string;
  private logFiles: Map<string, string> = new Map();

  constructor() {
    this.logDir = join(process.cwd(), 'logs');
    this.currentDate = new Date().toISOString().split('T')[0];
    this.ensureLogDirectory();
    this.initializeLogFiles();
  }

  private ensureLogDirectory(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initializeLogFiles(): void {
    const categories = ['feature', 'prediction', 'filter', 'database', 'recovery', 'system', 'audit'];
    
    categories.forEach(category => {
      const filename = `${category}-${this.currentDate}.jsonl`;
      const filepath = join(this.logDir, filename);
      this.logFiles.set(category, filepath);
      
      // Create file if it doesn't exist
      if (!existsSync(filepath)) {
        writeFileSync(filepath, '');
      }
    });
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
      processId: process.pid,
      nodeVersion: process.version
    }) + '\n';
  }

  private writeToFile(category: string, entry: LogEntry): void {
    try {
      const filepath = this.logFiles.get(category);
      if (filepath) {
        appendFileSync(filepath, this.formatLogEntry(entry));
      }
      
      // Also write to audit log for critical operations
      if (entry.level === 'error' || entry.category === 'recovery') {
        const auditPath = this.logFiles.get('audit');
        if (auditPath) {
          appendFileSync(auditPath, this.formatLogEntry(entry));
        }
      }
    } catch (writeError) {
      console.error('Failed to write log entry:', writeError);
    }
  }

  // Feature calculation logging
  logFeatureCalculation(
    symbol: string,
    featureType: string,
    inputData: any,
    outputValue: number | null,
    success: boolean,
    duration?: number,
    windowSize?: number
  ): void {
    const entry: FeatureCalculationLog = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'error',
      category: 'feature',
      symbol,
      operation: `calculate_${featureType}`,
      data: {
        featureType: featureType as any,
        inputData,
        outputValue,
        calculationSuccess: success,
        windowSize
      },
      metadata: {
        duration
      }
    };

    this.writeToFile('feature', entry);
    console.log(`📊 [FEATURE LOG] ${symbol} ${featureType}: ${success ? 'SUCCESS' : 'FAILED'} - Value: ${outputValue}`);
  }

  // Prediction logging
  logPrediction(
    symbol: string,
    modelType: string,
    inputFeatures: Record<string, number>,
    prediction: { signal: string; confidence: number; profitLikelihood: number },
    modelVersion?: string,
    trainingSize?: number,
    duration?: number
  ): void {
    const entry: PredictionLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'prediction',
      symbol,
      operation: `generate_prediction`,
      data: {
        modelType: modelType as any,
        inputFeatures,
        prediction: prediction as any,
        modelVersion,
        trainingSize
      },
      metadata: {
        duration,
        confidence: prediction.confidence,
        profitLikelihood: prediction.profitLikelihood
      }
    };

    this.writeToFile('prediction', entry);
    console.log(`🤖 [PREDICTION LOG] ${symbol} ${modelType}: ${prediction.signal} (${prediction.confidence}%/${prediction.profitLikelihood}%)`);
  }

  // Filter event logging
  logFilterEvent(
    symbol: string,
    filterType: string,
    originalValues: Record<string, number>,
    filteredValues: Record<string, number>,
    filterPassed: boolean,
    thresholds: Record<string, number>
  ): void {
    const entry: FilterLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'filter',
      symbol,
      operation: `apply_${filterType}_filter`,
      data: {
        filterType: filterType as any,
        originalValues,
        filteredValues,
        filterPassed,
        thresholds
      }
    };

    this.writeToFile('filter', entry);
    console.log(`🔍 [FILTER LOG] ${symbol} ${filterType}: ${filterPassed ? 'PASSED' : 'BLOCKED'}`);
  }

  // Database operation logging
  logDatabaseOperation(
    operation: string,
    table: string,
    success: boolean,
    recordCount?: number,
    duration?: number,
    error?: Error
  ): void {
    const entry: DatabaseLog = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'error',
      category: 'database',
      operation: `db_${operation}`,
      data: {
        operation: operation as any,
        table,
        recordCount,
        queryDuration: duration,
        success
      },
      error: error ? {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.writeToFile('database', entry);
    console.log(`💾 [DATABASE LOG] ${operation} ${table}: ${success ? 'SUCCESS' : 'FAILED'} - Records: ${recordCount || 0}`);
  }

  // Recovery operation logging
  logRecoveryOperation(
    recoveryType: string,
    triggerEvent: string,
    recoveryAction: string,
    success: boolean,
    affectedRecords?: number,
    lastGoodState?: any
  ): void {
    const entry: RecoveryLog = {
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'error',
      category: 'recovery',
      operation: `recovery_${recoveryType}`,
      data: {
        recoveryType: recoveryType as any,
        triggerEvent,
        recoveryAction,
        affectedRecords,
        recoverySuccess: success,
        lastGoodState
      }
    };

    this.writeToFile('recovery', entry);
    console.log(`🔄 [RECOVERY LOG] ${recoveryType}: ${success ? 'SUCCESS' : 'FAILED'} - Action: ${recoveryAction}`);
  }

  // Error logging with full context
  logError(
    category: string,
    operation: string,
    error: Error,
    symbol?: string,
    context?: any
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      category: category as any,
      symbol,
      operation,
      data: context,
      error: {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack
      }
    };

    this.writeToFile(category, entry);
    this.writeToFile('system', entry);
    console.error(`❌ [ERROR LOG] ${category}/${operation}: ${error.message}`, symbol ? `(${symbol})` : '');
  }

  // System event logging
  logSystemEvent(
    operation: string,
    level: 'info' | 'warn' | 'error',
    data?: any,
    symbol?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: 'system',
      symbol,
      operation,
      data
    };

    this.writeToFile('system', entry);
    console.log(`🔧 [SYSTEM LOG] ${operation}: ${level.toUpperCase()}`);
  }

  // Get recent logs for debugging
  getRecentLogs(category: string, limit: number = 100): LogEntry[] {
    try {
      const filepath = this.logFiles.get(category);
      if (!filepath || !existsSync(filepath)) {
        return [];
      }

      const fs = require('fs');
      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.trim().split('\n').filter((line: string) => line.length > 0);
      
      return lines
        .slice(-limit)
        .map((line: string) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry: LogEntry | null) => entry !== null);
    } catch (error) {
      console.error('Failed to read recent logs:', error);
      return [];
    }
  }

  // Rotate log files daily
  rotateLogs(): void {
    const newDate = new Date().toISOString().split('T')[0];
    if (newDate !== this.currentDate) {
      this.currentDate = newDate;
      this.initializeLogFiles();
      this.logSystemEvent('log_rotation', 'info', { newDate });
    }
  }
}

// Export singleton instance
export const logger = new LoggingService();

// Auto-rotate logs daily
setInterval(() => {
  logger.rotateLogs();
}, 24 * 60 * 60 * 1000); // 24 hours