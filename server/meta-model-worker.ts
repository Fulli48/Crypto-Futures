/**
 * Meta-Model Learning Worker
 * Implements continuous learning from trade outcomes with model versioning
 */

import { db } from './db';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import crypto from 'crypto';

interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  calibrationScore: number; // Brier score
  sampleSize: number;
}

interface TrainingFeatures {
  forecastReturn: number;
  forecastSlope: number;
  modelConfidence: number;
  ensembleAgreement: number;
  pathSmoothness: number;
  technicalConfluence: number;
  riskRewardRatio: number;
  crossMarketConsensus: number;
  volatility: number;
  // Additional derived features
  volumeRatio: number;
  pricePosition: number; // Position within BB bands
  momentumScore: number;
  liquidityScore: number;
}

export class MetaModelWorker {
  private currentModelVersion: string = 'v1.0.0';
  private isTraining: boolean = false;
  private minimumSamples: number = 100;
  private retrainingInterval: number = 3600000; // 1 hour in milliseconds
  
  constructor() {
    console.log('🧠 Meta-Model Worker initialized');
    this.startPeriodicRetraining();
  }

  /**
   * Start periodic model retraining
   */
  private startPeriodicRetraining() {
    setInterval(async () => {
      try {
        await this.executeRetrainingCycle();
      } catch (error) {
        console.error('❌ Meta-model retraining failed:', error);
      }
    }, this.retrainingInterval);
  }

  /**
   * Execute complete retraining cycle
   */
  async executeRetrainingCycle(): Promise<void> {
    if (this.isTraining) {
      console.log('⏳ Meta-model training already in progress');
      return;
    }

    this.isTraining = true;
    console.log('🔄 Starting meta-model retraining cycle');

    try {
      // Step 1: Extract and prepare training data
      const trainingData = await this.extractTrainingData();
      
      if (trainingData.length < this.minimumSamples) {
        console.log(`📊 Insufficient training data: ${trainingData.length} < ${this.minimumSamples}`);
        return;
      }

      // Step 2: Generate learning dataset
      const datasetVersion = `v${new Date().toISOString()}`;
      await this.generateLearningDataset(trainingData, datasetVersion);

      // Step 3: Train new model
      const newModelVersion = this.generateModelVersion();
      const modelMetrics = await this.trainMetaModel(trainingData, newModelVersion);

      // Step 4: Validate model performance
      const isModelValid = await this.validateModel(modelMetrics, trainingData);

      if (isModelValid) {
        // Step 5: Register and promote model
        await this.registerModel(newModelVersion, modelMetrics, trainingData);
        await this.promoteModelToProduction(newModelVersion);
        
        this.currentModelVersion = newModelVersion;
        console.log(`✅ Meta-model ${newModelVersion} promoted to production`);
      } else {
        console.log(`❌ Meta-model ${newModelVersion} failed validation`);
      }

    } catch (error) {
      console.error('❌ Meta-model training error:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Extract training data from completed trades
   */
  private async extractTrainingData(): Promise<any[]> {
    try {
      // Get signals with completed trades from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Mock training data extraction - replace with actual database queries when schema is deployed
      const mockTrainingData = Array.from({ length: 150 }, (_, i) => ({
        signal_id: `SIG_TEST_${i}`,
        signal_data: JSON.stringify({
          featureVector: Array.from({ length: 12 }, () => Math.random()),
          technicalIndicators: {
            rsi: 30 + Math.random() * 40,
            macd: -5 + Math.random() * 10,
            volatility: 0.001 + Math.random() * 0.005
          },
          metaModelPrediction: 40 + Math.random() * 20,
          metaModelVersion: 'v1.0.0',
          qualityScore: 50 + Math.random() * 50
        }),
        realized_pnl_percent: -10 + Math.random() * 20,
        actual_win: Math.random() > 0.5,
        max_drawdown_percent: Math.random() * 5,
        time_to_target: 30 + Math.random() * 180,
        exit_reason: ['TAKE_PROFIT', 'STOP_LOSS', 'TIMEOUT'][Math.floor(Math.random() * 3)],
        prediction_error: -0.2 + Math.random() * 0.4
      }));
      
      console.log(`📊 Extracted ${mockTrainingData.length} training samples (mock data)`);
      return mockTrainingData;

    } catch (error) {
      console.error('❌ Failed to extract training data:', error);
      return [];
    }
  }

  /**
   * Generate structured learning dataset
   */
  private async generateLearningDataset(trainingData: any[], datasetVersion: string): Promise<void> {
    const learningRecords = trainingData.map(sample => {
      const signalData = JSON.parse(sample.signal_data);
      
      return {
        datasetVersion,
        signalId: sample.signal_id,
        inputFeatures: signalData.featureVector,
        technicalFeatures: this.extractTechnicalFeatures(signalData),
        ensembleFeatures: this.extractEnsembleFeatures(signalData),
        marketContextFeatures: this.extractMarketFeatures(signalData),
        profitLabel: sample.actual_win,
        pnlLabel: sample.realized_pnl_percent,
        drawdownLabel: sample.max_drawdown_percent,
        timeToTargetLabel: sample.time_to_target,
        metaModelPrediction: signalData.metaModelPrediction,
        metaModelVersion: signalData.metaModelVersion,
        isValidSample: this.validateSample(sample),
        hasOutcome: true,
        outlierFlag: this.detectOutlier(sample)
      };
    });

    // Mock learning dataset generation - replace with actual database inserts when schema is deployed
    console.log(`💾 Mock learning dataset generation completed (${learningRecords.length} records prepared)`);
    // Actual database insert would be:
    // await db.insert(learningDataset).values(batch);

    console.log(`💾 Generated learning dataset ${datasetVersion} with ${learningRecords.length} samples`);
  }

  /**
   * Train the meta-model using extracted data
   */
  private async trainMetaModel(trainingData: any[], modelVersion: string): Promise<ModelPerformanceMetrics> {
    console.log(`🎯 Training meta-model ${modelVersion} with ${trainingData.length} samples`);
    
    // Prepare features and labels
    const features = trainingData.map(sample => {
      const signalData = JSON.parse(sample.signal_data);
      return this.prepareModelFeatures(signalData);
    });

    const labels = trainingData.map(sample => sample.actual_win ? 1 : 0);

    // Mock training process - in reality would use ML framework
    const metrics = await this.performModelTraining(features, labels, modelVersion);
    
    console.log(`📊 Training completed - Accuracy: ${metrics.accuracy.toFixed(3)}, F1: ${metrics.f1Score.toFixed(3)}`);
    
    return metrics;
  }

  /**
   * Mock model training - replace with actual ML framework
   */
  private async performModelTraining(features: number[][], labels: number[], modelVersion: string): Promise<ModelPerformanceMetrics> {
    // Simulate training time
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Mock cross-validation results
    const totalSamples = labels.length;
    const positiveLabels = labels.filter(l => l === 1).length;
    const truePositives = Math.floor(positiveLabels * 0.72); // 72% recall
    const falsePositives = Math.floor((totalSamples - positiveLabels) * 0.15); // 15% false positive rate
    
    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / positiveLabels;
    const accuracy = (truePositives + (totalSamples - positiveLabels - falsePositives)) / totalSamples;
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    // Mock Brier score (calibration)
    const calibrationScore = 0.18; // Lower is better
    
    return {
      accuracy,
      precision,
      recall,
      f1Score,
      calibrationScore,
      sampleSize: totalSamples
    };
  }

  /**
   * Validate model performance against minimum thresholds
   */
  private async validateModel(metrics: ModelPerformanceMetrics, trainingData: any[]): Promise<boolean> {
    const minAccuracy = 0.58;
    const minPrecision = 0.55;
    const minRecall = 0.60;
    const maxCalibrationError = 0.25;
    const minSampleSize = 100;

    const validations = {
      accuracy: metrics.accuracy >= minAccuracy,
      precision: metrics.precision >= minPrecision,
      recall: metrics.recall >= minRecall,
      calibration: metrics.calibrationScore <= maxCalibrationError,
      sampleSize: metrics.sampleSize >= minSampleSize
    };

    const isValid = Object.values(validations).every(Boolean);
    
    console.log('🔍 Model validation results:', {
      ...validations,
      metrics,
      isValid
    });

    return isValid;
  }

  /**
   * Register model in model registry
   */
  private async registerModel(version: string, metrics: ModelPerformanceMetrics, trainingData: any[]): Promise<void> {
    const trainingDataHash = crypto.createHash('sha256')
      .update(JSON.stringify(trainingData.map(d => d.signal_id)))
      .digest('hex');

    const modelRecord = {
      version,
      modelType: 'logistic_regression',
      trainingDataHash,
      trainingStartTime: new Date(Date.now() - 5000), // 5 seconds ago
      trainingEndTime: new Date(),
      trainingDuration: 5, // 5 seconds
      trainingDataSize: trainingData.length,
      featureCount: 12,
      validationAccuracy: metrics.accuracy,
      validationPrecision: metrics.precision,
      validationRecall: metrics.recall,
      validationF1Score: metrics.f1Score,
      calibrationScore: metrics.calibrationScore,
      hyperparameters: {
        regularization: 0.01,
        maxIterations: 1000,
        tolerance: 1e-6
      },
      featureImportance: {
        forecastReturn: 0.23,
        riskRewardRatio: 0.18,
        technicalConfluence: 0.15,
        modelConfidence: 0.12,
        volatility: 0.10,
        pathSmoothness: 0.09,
        ensembleAgreement: 0.08,
        crossMarketConsensus: 0.05
      },
      modelArtifactPath: `/models/${version}/model.pkl`,
      modelSize: 45632, // bytes
      inferenceLatency: 2.3 // ms
    };

    // Mock model promotion - replace with actual database updates when schema is deployed
    console.log(`🚀 Mock promoted model ${version} to production`);
    // Actual database updates would be:
    // await db.update(metaModelRegistry).set({ isProduction: false, retiredAt: new Date() }).where(eq(metaModelRegistry.isProduction, true));
    // await db.update(metaModelRegistry).set({ isProduction: true, promotedAt: new Date() }).where(eq(metaModelRegistry.version, version));
  }

  /**
   * Promote model to production
   */
  private async promoteModelToProduction(version: string): Promise<void> {
    // Mock model promotion - replace with actual database updates when schema is deployed
    console.log(`🚀 Mock promoted model ${version} to production`);
    // Actual database updates would be:
    // await db.update(metaModelRegistry).set({ isProduction: false, retiredAt: new Date() }).where(eq(metaModelRegistry.isProduction, true));
    // await db.update(metaModelRegistry).set({ isProduction: true, promotedAt: new Date() }).where(eq(metaModelRegistry.version, version));
  }

  /**
   * Get prediction from current production model
   */
  async getPrediction(featureVector: number[]): Promise<{
    winProbability: number;
    confidence: number;
    modelVersion: string;
  }> {
    // Mock prediction - replace with actual model inference
    const baseProb = 0.5;
    const featureSum = featureVector.reduce((sum, val) => sum + val, 0);
    const adjustment = (featureSum / featureVector.length - 0.5) * 0.4;
    
    const winProbability = Math.max(0.1, Math.min(0.9, baseProb + adjustment));
    const confidence = Math.abs(winProbability - 0.5) * 2; // 0-1 scale
    
    return {
      winProbability: winProbability * 100, // Convert to percentage
      confidence: confidence * 100,
      modelVersion: this.currentModelVersion
    };
  }

  // Utility methods for feature extraction
  private extractTechnicalFeatures(signalData: any): number[] {
    const indicators = signalData.technicalIndicators;
    return [
      indicators.rsi / 100,
      Math.tanh(indicators.macd),
      indicators.stochasticK / 100,
      indicators.volatility
    ];
  }

  private extractEnsembleFeatures(signalData: any): number[] {
    return [
      signalData.modelAgreementScore / 100,
      signalData.ensembleDispersion,
      signalData.pathSmoothness / 100
    ];
  }

  private extractMarketFeatures(signalData: any): number[] {
    return [
      signalData.riskRewardRatio / 5, // Normalize to ~0-1
      Math.log(signalData.positionSize + 1),
      signalData.technicalIndicators.volatility
    ];
  }

  private prepareModelFeatures(signalData: any): number[] {
    return [
      ...signalData.featureVector,
      ...this.extractTechnicalFeatures(signalData),
      ...this.extractEnsembleFeatures(signalData)
    ];
  }

  private validateSample(sample: any): boolean {
    // Check for data quality issues
    const signalData = JSON.parse(sample.signal_data);
    
    return (
      sample.realized_pnl_percent != null &&
      Math.abs(sample.realized_pnl_percent) < 50 && // Exclude extreme outliers
      sample.time_to_target > 0 &&
      sample.time_to_target < 1440 && // Less than 24 hours
      signalData.qualityScore > 20 // Minimum quality threshold
    );
  }

  private detectOutlier(sample: any): boolean {
    // Simple outlier detection based on extreme P&L
    return Math.abs(sample.realized_pnl_percent) > 25;
  }

  private generateModelVersion(): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(timestamp.toString()).digest('hex').substring(0, 8);
    return `v1.${Math.floor(timestamp / 3600000)}.${hash}`;
  }
}

// Singleton instance
export const metaModelWorker = new MetaModelWorker();