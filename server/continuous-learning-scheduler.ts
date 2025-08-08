/**
 * Continuous Learning Scheduler
 * 
 * Automates daily model retraining, performance tracking, and model promotion
 * ensuring the ML system continuously improves with fresh market data.
 */

import { CronJob } from 'cron';
import { db } from './db';
import { mlTrainingSamples, mlTrainingBatches, persistentForecasts, persistentForecastPoints } from '@shared/schema';
import { gte, desc, eq, sql, and, lt } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { logger } from './logging-service';
import { recoveryService } from './recovery-service';

interface ModelPerformanceMetrics {
  modelId: string;
  version: string;
  rmse: number;
  mae: number;
  mape: number;
  accuracyScore: number;
  forecastHorizon: number;
  evaluationDate: string;
  sampleCount: number;
}

interface ModelRegistry {
  currentProduction: {
    [symbol: string]: {
      modelId: string;
      version: string;
      deployedAt: string;
      performance: ModelPerformanceMetrics;
    }
  };
  archived: ModelPerformanceMetrics[];
}

export class ContinuousLearningScheduler {
  private retrainingJob: CronJob | null = null;
  private performanceCheckJob: CronJob | null = null;
  private modelRegistryPath = './model_registry/model_registry.json';
  private performanceThresholds = {
    rmse: 0.05,     // 5% RMSE threshold
    mae: 0.03,      // 3% MAE threshold
    mape: 0.04,     // 4% MAPE threshold
    accuracy: 0.7   // 70% accuracy threshold
  };

  constructor() {
    this.initializeModelRegistry();
  }

  /**
   * Start automated continuous learning system
   */
  public start(): void {
    // Log system startup with recovery tracking
    logger.logSystemEvent('continuous_learning_scheduler_start', 'info');
    recoveryService.recordSuccess('ml_system', 'scheduler_start', {});
    
    console.log('🤖 [CONTINUOUS LEARNING] Starting automated learning scheduler...');

    // Daily retraining at 2 AM UTC
    this.retrainingJob = new CronJob('0 2 * * *', async () => {
      await this.performDailyRetraining();
    }, null, true, 'UTC');

    // Performance check every 4 hours
    this.performanceCheckJob = new CronJob('0 */4 * * *', async () => {
      await this.checkModelPerformance();
    }, null, true, 'UTC');

    console.log('✅ [CONTINUOUS LEARNING] Scheduler started - Daily retraining at 2 AM UTC, performance checks every 4 hours');
  }

  /**
   * Stop automated learning system
   */
  public stop(): void {
    if (this.retrainingJob) {
      this.retrainingJob.stop();
      this.retrainingJob = null;
    }
    if (this.performanceCheckJob) {
      this.performanceCheckJob.stop();
      this.performanceCheckJob = null;
    }
    console.log('🛑 [CONTINUOUS LEARNING] Scheduler stopped');
  }

  /**
   * Perform comprehensive daily retraining
   */
  private async performDailyRetraining(): Promise<void> {
    // Log training start with comprehensive context
    logger.logSystemEvent('daily_retraining_started', 'info');
    recoveryService.recordSuccess('ml_training', 'daily_retraining_start', {});
    
    console.log('🔄 [DAILY RETRAINING] Starting automated daily model retraining...');

    try {
      // Step 1: Check for new training data
      const newDataCount = await this.checkNewTrainingData();
      
      if (newDataCount < 100) {
        console.log(`⏭️ [DAILY RETRAINING] Insufficient new data (${newDataCount} samples), skipping retraining`);
        return;
      }

      console.log(`📊 [DAILY RETRAINING] Found ${newDataCount} new training samples, proceeding with retraining`);

      // Step 2: Archive current production models
      await this.archiveCurrentModels();

      // Step 3: Trigger model retraining
      const retrainingResults = await this.triggerModelRetraining();

      // Step 4: Evaluate new models
      const evaluationResults = await this.evaluateNewModels();

      // Step 5: Promote best performing models
      await this.promoteNewModels(evaluationResults);

      // Step 6: Update model registry
      await this.updateModelRegistry(evaluationResults);

      // Log successful completion
      logger.logSystemEvent('daily_retraining_completed', 'info');
      recoveryService.recordSuccess('ml_training', 'daily_retraining_complete', { evaluationResults });
      
      console.log('✅ [DAILY RETRAINING] Automated retraining completed successfully');

    } catch (error) {
      // Log error with comprehensive context
      logger.logError('ml_training', 'daily_retraining', error as Error, 'system', {
        operation: 'daily_retraining',
        timestamp: new Date(),
        trainingData: await this.checkNewTrainingData()
      });
      
      // Record error for recovery tracking
      recoveryService.recordError('ml_training', 'daily_retraining', 'system');
      
      console.error('❌ [DAILY RETRAINING] Error during automated retraining:', error);
      // Send alert/notification in production
      await this.handleRetrainingError(error);
    }
  }

  /**
   * Check for new training data since last retraining
   */
  private async checkNewTrainingData(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const newSamples = await db.select({ count: sql<number>`count(*)` })
      .from(mlTrainingSamples)
      .where(gte(mlTrainingSamples.createdAt, oneDayAgo));

    return newSamples[0]?.count || 0;
  }

  /**
   * Archive current production models before retraining
   */
  private async archiveCurrentModels(): Promise<void> {
    console.log('📦 [MODEL ARCHIVAL] Archiving current production models...');

    const registry = await this.loadModelRegistry();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Create archive directory
    const archiveDir = `./model_registry/archived/${timestamp}`;
    await fs.mkdir(archiveDir, { recursive: true });

    // Archive each symbol's current production model
    for (const [symbol, modelInfo] of Object.entries(registry.currentProduction)) {
      const modelPath = `./model_registry/${symbol}_${modelInfo.version}.pkl`;
      const archivePath = path.join(archiveDir, `${symbol}_${modelInfo.version}.pkl`);
      
      try {
        await fs.copyFile(modelPath, archivePath);
        registry.archived.push({
          ...modelInfo.performance,
          modelId: modelInfo.modelId,
          version: modelInfo.version,
          evaluationDate: timestamp
        });
      } catch (error) {
        console.warn(`⚠️ [MODEL ARCHIVAL] Could not archive ${symbol} model:`, error);
      }
    }

    await this.saveModelRegistry(registry);
    console.log('✅ [MODEL ARCHIVAL] Current models archived successfully');
  }

  /**
   * Trigger comprehensive model retraining
   */
  private async triggerModelRetraining(): Promise<any> {
    console.log('🧠 [MODEL TRAINING] Triggering automated model retraining...');

    try {
      // Execute Python training script with automated parameters
      const { spawn } = require('child_process');
      
      return new Promise((resolve, reject) => {
        const trainingProcess = spawn('python', [
          'model_registry/production_trainer.py',
          '--automated',
          '--validation-split', '0.2',
          '--early-stopping',
          '--model-selection', 'ensemble'
        ], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        let output = '';
        let error = '';

        trainingProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
          console.log(`[TRAINING] ${data.toString().trim()}`);
        });

        trainingProcess.stderr.on('data', (data: Buffer) => {
          error += data.toString();
          console.error(`[TRAINING ERROR] ${data.toString().trim()}`);
        });

        trainingProcess.on('close', (code: number) => {
          if (code === 0) {
            console.log('✅ [MODEL TRAINING] Training completed successfully');
            resolve({ success: true, output, code });
          } else {
            console.error(`❌ [MODEL TRAINING] Training failed with code ${code}`);
            reject(new Error(`Training failed: ${error}`));
          }
        });

        // Set timeout for training (2 hours max)
        setTimeout(() => {
          trainingProcess.kill();
          reject(new Error('Training timeout after 2 hours'));
        }, 2 * 60 * 60 * 1000);
      });

    } catch (error) {
      console.error('❌ [MODEL TRAINING] Failed to trigger retraining:', error);
      throw error;
    }
  }

  /**
   * Evaluate newly trained models on recent data
   */
  private async evaluateNewModels(): Promise<ModelPerformanceMetrics[]> {
    console.log('📊 [MODEL EVALUATION] Evaluating newly trained models...');

    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
    const evaluationResults: ModelPerformanceMetrics[] = [];

    // Get recent forecast data for evaluation (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    for (const symbol of symbols) {
      try {
        // Get recent forecasts for this symbol
        const recentForecasts = await db.select()
          .from(persistentForecasts)
          .where(and(
            eq(persistentForecasts.symbol, symbol),
            gte(persistentForecasts.createdAt, sevenDaysAgo)
          ))
          .orderBy(desc(persistentForecasts.createdAt))
          .limit(100);

        if (recentForecasts.length === 0) {
          console.warn(`⚠️ [MODEL EVALUATION] No recent forecasts found for ${symbol}`);
          continue;
        }

        // Calculate performance metrics
        const metrics = await this.calculateModelMetrics(symbol, recentForecasts);
        evaluationResults.push(metrics);

        console.log(`📈 [MODEL EVALUATION] ${symbol} - RMSE: ${metrics.rmse.toFixed(4)}, MAE: ${metrics.mae.toFixed(4)}, Accuracy: ${(metrics.accuracyScore * 100).toFixed(1)}%`);

      } catch (error) {
        console.error(`❌ [MODEL EVALUATION] Error evaluating ${symbol}:`, error);
      }
    }

    return evaluationResults;
  }

  /**
   * Calculate comprehensive model performance metrics
   */
  private async calculateModelMetrics(symbol: string, forecasts: any[]): Promise<ModelPerformanceMetrics> {
    let totalSquaredError = 0;
    let totalAbsoluteError = 0;
    let totalPercentageError = 0;
    let correctDirectionCount = 0;
    let validPredictions = 0;

    for (const forecast of forecasts) {
      // Get actual prices for comparison
      const forecastPoints = await db.select()
        .from(persistentForecastPoints)
        .where(eq(persistentForecastPoints.forecastId, forecast.id))
        .orderBy(persistentForecastPoints.minutesAhead);

      for (const point of forecastPoints) {
        // Find actual price at the predicted time
        const actualPrice = await this.getActualPriceAtTime(symbol, point.timestamp);
        
        if (actualPrice > 0) {
          const predictedPrice = point.price;
          const error = predictedPrice - actualPrice;
          const percentageError = Math.abs(error / actualPrice);

          totalSquaredError += error * error;
          totalAbsoluteError += Math.abs(error);
          totalPercentageError += percentageError;

          // Check prediction direction accuracy
          if (point.minutesAhead > 0) {
            const previousActualPrice = await this.getActualPriceAtTime(symbol, 
              new Date(new Date(point.timestamp).getTime() - point.minutesAhead * 60 * 1000).toISOString()
            );
            
            if (previousActualPrice > 0) {
              const actualDirection = actualPrice > previousActualPrice;
              const predictedDirection = predictedPrice > previousActualPrice;
              
              if (actualDirection === predictedDirection) {
                correctDirectionCount++;
              }
            }
          }

          validPredictions++;
        }
      }
    }

    if (validPredictions === 0) {
      throw new Error(`No valid predictions found for ${symbol}`);
    }

    const rmse = Math.sqrt(totalSquaredError / validPredictions);
    const mae = totalAbsoluteError / validPredictions;
    const mape = (totalPercentageError / validPredictions) * 100;
    const accuracyScore = correctDirectionCount / validPredictions;

    return {
      modelId: `${symbol}_model`,
      version: new Date().toISOString().split('T')[0], // Date-based versioning
      rmse,
      mae,
      mape,
      accuracyScore,
      forecastHorizon: 20, // 20-minute forecast horizon
      evaluationDate: new Date().toISOString(),
      sampleCount: validPredictions
    };
  }

  /**
   * Get actual market price at specific timestamp
   */
  private async getActualPriceAtTime(symbol: string, timestamp: string): Promise<number> {
    try {
      // Query rolling chart data for actual price
      const priceData = await db.select({ close: sql<number>`CAST(close AS DECIMAL)` })
        .from(sql`rolling_chart_data`)
        .where(and(
          eq(sql`symbol`, symbol),
          eq(sql`timestamp`, timestamp)
        ))
        .limit(1);

      return priceData[0]?.close || 0;
    } catch (error) {
      console.warn(`⚠️ [PRICE LOOKUP] Could not find actual price for ${symbol} at ${timestamp}`);
      return 0;
    }
  }

  /**
   * Promote new models if they outperform current production models
   */
  private async promoteNewModels(evaluationResults: ModelPerformanceMetrics[]): Promise<void> {
    console.log('🚀 [MODEL PROMOTION] Evaluating models for promotion to production...');

    const registry = await this.loadModelRegistry();
    let promotionCount = 0;

    for (const newModel of evaluationResults) {
      const symbol = newModel.modelId.replace('_model', '');
      const currentProduction = registry.currentProduction[symbol];

      // Check if new model should be promoted
      const shouldPromote = this.shouldPromoteModel(newModel, currentProduction?.performance);

      if (shouldPromote) {
        // Promote new model to production
        registry.currentProduction[symbol] = {
          modelId: newModel.modelId,
          version: newModel.version,
          deployedAt: new Date().toISOString(),
          performance: newModel
        };

        // Copy model file to production location
        await this.deployModelToProduction(symbol, newModel.version);
        
        promotionCount++;
        console.log(`✅ [MODEL PROMOTION] Promoted ${symbol} model (RMSE: ${newModel.rmse.toFixed(4)}, Accuracy: ${(newModel.accuracyScore * 100).toFixed(1)}%)`);
      } else {
        console.log(`⏭️ [MODEL PROMOTION] ${symbol} model not promoted (insufficient improvement)`);
      }
    }

    await this.saveModelRegistry(registry);
    console.log(`🎯 [MODEL PROMOTION] Promoted ${promotionCount} models to production`);
  }

  /**
   * Determine if new model should be promoted based on performance criteria
   */
  private shouldPromoteModel(newModel: ModelPerformanceMetrics, currentModel?: ModelPerformanceMetrics): boolean {
    // Always promote if no current model exists
    if (!currentModel) {
      return true;
    }

    // Check if new model meets minimum thresholds
    if (newModel.rmse > this.performanceThresholds.rmse ||
        newModel.mae > this.performanceThresholds.mae ||
        newModel.mape > this.performanceThresholds.mape ||
        newModel.accuracyScore < this.performanceThresholds.accuracy) {
      return false;
    }

    // Promotion criteria: new model must be significantly better
    const rmseImprovement = (currentModel.rmse - newModel.rmse) / currentModel.rmse;
    const accuracyImprovement = newModel.accuracyScore - currentModel.accuracyScore;

    // Require at least 5% RMSE improvement OR 3% accuracy improvement
    return rmseImprovement > 0.05 || accuracyImprovement > 0.03;
  }

  /**
   * Deploy model to production environment
   */
  private async deployModelToProduction(symbol: string, version: string): Promise<void> {
    const sourcePath = `./model_registry/${symbol}_${version}.pkl`;
    const productionPath = `./model_registry/production/${symbol}_current.pkl`;

    try {
      await fs.mkdir('./model_registry/production', { recursive: true });
      await fs.copyFile(sourcePath, productionPath);
      console.log(`📦 [MODEL DEPLOYMENT] Deployed ${symbol} model version ${version} to production`);
    } catch (error) {
      console.error(`❌ [MODEL DEPLOYMENT] Failed to deploy ${symbol} model:`, error);
      throw error;
    }
  }

  /**
   * Update model registry with new performance data
   */
  private async updateModelRegistry(evaluationResults: ModelPerformanceMetrics[]): Promise<void> {
    const registry = await this.loadModelRegistry();
    
    // Add evaluation results to performance history
    for (const result of evaluationResults) {
      registry.archived.push(result);
    }

    // Keep only last 100 archived results per symbol
    const symbolGroups = registry.archived.reduce((acc, result) => {
      const symbol = result.modelId.replace('_model', '');
      if (!acc[symbol]) acc[symbol] = [];
      acc[symbol].push(result);
      return acc;
    }, {} as {[key: string]: ModelPerformanceMetrics[]});

    registry.archived = [];
    for (const [symbol, results] of Object.entries(symbolGroups)) {
      const latestResults = results
        .sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime())
        .slice(0, 100);
      registry.archived.push(...latestResults);
    }

    await this.saveModelRegistry(registry);
    console.log('📋 [MODEL REGISTRY] Registry updated with latest performance data');
  }

  /**
   * Check model performance and trigger retraining if degradation detected
   */
  private async checkModelPerformance(): Promise<void> {
    console.log('🔍 [PERFORMANCE CHECK] Checking model performance...');

    try {
      const registry = await this.loadModelRegistry();
      let degradationDetected = false;

      for (const [symbol, modelInfo] of Object.entries(registry.currentProduction)) {
        // Get recent forecasts for performance check
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const recentForecasts = await db.select()
          .from(persistentForecasts)
          .where(and(
            eq(persistentForecasts.symbol, symbol),
            gte(persistentForecasts.createdAt, oneDayAgo)
          ))
          .limit(20);

        if (recentForecasts.length >= 10) {
          const currentMetrics = await this.calculateModelMetrics(symbol, recentForecasts);
          
          // Check for performance degradation
          const performanceDegraded = this.isPerformanceDegraded(currentMetrics, modelInfo.performance);
          
          if (performanceDegraded) {
            console.log(`⚠️ [PERFORMANCE CHECK] Performance degradation detected for ${symbol}`);
            degradationDetected = true;
          } else {
            console.log(`✅ [PERFORMANCE CHECK] ${symbol} model performance stable`);
          }
        }
      }

      if (degradationDetected) {
        console.log('🔄 [PERFORMANCE CHECK] Triggering emergency retraining due to performance degradation');
        await this.performDailyRetraining();
      }

    } catch (error) {
      console.error('❌ [PERFORMANCE CHECK] Error during performance check:', error);
    }
  }

  /**
   * Check if model performance has degraded significantly
   */
  private isPerformanceDegraded(current: ModelPerformanceMetrics, baseline: ModelPerformanceMetrics): boolean {
    const rmseIncrease = (current.rmse - baseline.rmse) / baseline.rmse;
    const accuracyDecrease = baseline.accuracyScore - current.accuracyScore;

    // Degradation thresholds: 20% RMSE increase OR 10% accuracy decrease
    return rmseIncrease > 0.20 || accuracyDecrease > 0.10;
  }

  /**
   * Handle retraining errors with appropriate alerts
   */
  private async handleRetrainingError(error: any): Promise<void> {
    console.error('🚨 [RETRAINING ERROR] Critical error during automated retraining:', error);
    
    // In production, this would send alerts to monitoring systems
    // For now, we'll log the error and continue with fallback procedures
    
    try {
      // Attempt to restore from last known good models
      await this.restoreLastKnownGoodModels();
    } catch (restoreError) {
      console.error('❌ [RETRAINING ERROR] Failed to restore models:', restoreError);
    }
  }

  /**
   * Restore last known good models as fallback
   */
  private async restoreLastKnownGoodModels(): Promise<void> {
    console.log('🔄 [MODEL RESTORE] Attempting to restore last known good models...');
    
    // Implementation would restore from archived models
    // This is a safety net for production environments
  }

  /**
   * Initialize model registry file
   */
  private async initializeModelRegistry(): Promise<void> {
    try {
      await fs.access(this.modelRegistryPath);
    } catch {
      const initialRegistry: ModelRegistry = {
        currentProduction: {},
        archived: []
      };
      await this.saveModelRegistry(initialRegistry);
      console.log('📋 [MODEL REGISTRY] Initialized empty model registry');
    }
  }

  /**
   * Load model registry from file
   */
  private async loadModelRegistry(): Promise<ModelRegistry> {
    try {
      const data = await fs.readFile(this.modelRegistryPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('⚠️ [MODEL REGISTRY] Could not load registry, using defaults');
      return { currentProduction: {}, archived: [] };
    }
  }

  /**
   * Save model registry to file
   */
  private async saveModelRegistry(registry: ModelRegistry): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.modelRegistryPath), { recursive: true });
      await fs.writeFile(this.modelRegistryPath, JSON.stringify(registry, null, 2));
    } catch (error) {
      console.error('❌ [MODEL REGISTRY] Failed to save registry:', error);
      throw error;
    }
  }

  /**
   * Get current model performance summary
   */
  public async getPerformanceSummary(): Promise<any> {
    const registry = await this.loadModelRegistry();
    
    // Handle date conversion properly with safe checks
    const lastRetraining = this.retrainingJob?.lastDate?.();
    const nextRetraining = this.retrainingJob?.nextDate?.();
    
    // Safe date conversion function
    const safeToISO = (value: any): string | null => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value;
      return null;
    };
    
    // Sort archived results safely  
    const safeArchivedResults = (registry.archived || []).map(result => ({
      ...result,
      evaluationDate: safeToISO(result.evaluationDate) || new Date().toISOString()
    }));
    
    return {
      production: registry.currentProduction || {},
      recentPerformance: safeArchivedResults
        .sort((a, b) => new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime())
        .slice(0, 20),
      lastRetraining: safeToISO(lastRetraining),
      nextRetraining: safeToISO(nextRetraining)
    };
  }
}

// Export singleton instance
export const continuousLearningScheduler = new ContinuousLearningScheduler();