/**
 * Learning ETL Pipeline
 * Extracts, transforms, and loads trade data for meta-model training
 */

import { db } from './db';
import { eq, desc, and, gte, sql, between } from 'drizzle-orm';
import crypto from 'crypto';

interface ETLJobResult {
  extractedRecords: number;
  transformedRecords: number;
  loadedRecords: number;
  errors: string[];
  datasetVersion: string;
  executionTime: number;
}

export class LearningETLPipeline {
  private isRunning: boolean = false;
  private lastJobTimestamp: Date = new Date(0);
  
  constructor() {
    console.log('🔄 Learning ETL Pipeline initialized');
    this.startPeriodicETL();
  }

  /**
   * Start periodic ETL job execution
   */
  private startPeriodicETL() {
    // Run every hour
    setInterval(async () => {
      try {
        await this.executeETLJob();
      } catch (error) {
        console.error('❌ ETL job failed:', error);
      }
    }, 3600000); // 1 hour

    // Also run immediately on startup
    setTimeout(() => this.executeETLJob(), 30000); // 30 seconds delay
  }

  /**
   * Execute complete ETL job
   */
  async executeETLJob(): Promise<ETLJobResult> {
    if (this.isRunning) {
      console.log('⏳ ETL job already running');
      return this.createEmptyResult();
    }

    this.isRunning = true;
    const startTime = Date.now();
    const datasetVersion = `v${new Date().toISOString()}`;
    
    console.log(`🚀 Starting ETL job ${datasetVersion}`);

    const result: ETLJobResult = {
      extractedRecords: 0,
      transformedRecords: 0,
      loadedRecords: 0,
      errors: [],
      datasetVersion,
      executionTime: 0
    };

    try {
      // Step 1: Extract new trade outcomes
      const extractedData = await this.extractNewTradeOutcomes();
      result.extractedRecords = extractedData.length;
      console.log(`📊 Extracted ${extractedData.length} new trade outcomes`);

      if (extractedData.length === 0) {
        console.log('ℹ️ No new data to process');
        return result;
      }

      // Step 2: Transform data with feature engineering
      const transformedData = await this.transformTradeData(extractedData);
      result.transformedRecords = transformedData.length;
      console.log(`🔧 Transformed ${transformedData.length} records`);

      // Step 3: Load into learning dataset
      const loadResult = await this.loadLearningDataset(transformedData, datasetVersion);
      result.loadedRecords = loadResult.loadedRecords;
      result.errors = loadResult.errors;

      // Step 4: Data quality validation
      await this.validateDatasetQuality(datasetVersion);

      // Step 5: Update job timestamp
      this.lastJobTimestamp = new Date();

      console.log(`✅ ETL job completed: ${result.loadedRecords} records loaded`);

    } catch (error) {
      console.error('❌ ETL job error:', error);
      result.errors.push(error.message);
    } finally {
      result.executionTime = Date.now() - startTime;
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Extract new trade outcomes since last job
   */
  private async extractNewTradeOutcomes(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          es.signal_id,
          es.symbol,
          es.timestamp as signal_timestamp,
          es.forecast_vector,
          es.current_price,
          es.forecast_return,
          es.forecast_slope,
          es.model_confidence,
          es.technical_indicators,
          es.ensemble_dispersion,
          es.model_agreement_score,
          es.path_smoothness,
          es.entry_price,
          es.take_profit_price,
          es.stop_loss_price,
          es.risk_reward_ratio,
          es.position_size,
          es.quality_score,
          es.quality_metrics,
          es.meta_model_prediction,
          es.meta_model_version,
          es.signal,
          es.confidence,
          es.feature_vector,
          es.feature_checksum,
          
          tro.trade_id,
          tro.entry_price as actual_entry_price,
          tro.exit_price,
          tro.entry_timestamp,
          tro.exit_timestamp,
          tro.exit_reason,
          tro.realized_pnl,
          tro.realized_pnl_percent,
          tro.max_drawdown,
          tro.max_drawdown_percent,
          tro.time_to_target,
          tro.realized_volatility,
          tro.forecast_accuracy,
          tro.path_accuracy,
          tro.total_fees,
          tro.total_slippage,
          tro.net_pnl,
          tro.predicted_win_prob,
          tro.actual_win,
          tro.prediction_error
        FROM enhanced_signals es
        INNER JOIN trade_outcomes tro ON es.signal_id = tro.signal_id
        WHERE tro.created_at > $1
        AND es.signal != 'WAIT'
        ORDER BY tro.created_at DESC
        LIMIT 10000
      `;

      // Mock training data extraction - replace with actual database queries when schema is deployed
      const mockTrainingData = Array.from({ length: 75 }, (_, i) => ({
        signal_id: `SIG_ETL_${i}`,
        signal_data: JSON.stringify({
          featureVector: Array.from({ length: 10 }, () => Math.random()),
          technicalIndicators: {
            rsi: 25 + Math.random() * 50,
            macd: -3 + Math.random() * 6,
            volatility: 0.0005 + Math.random() * 0.003
          },
          metaModelPrediction: 35 + Math.random() * 30,
          metaModelVersion: 'v1.0.0',
          qualityScore: 40 + Math.random() * 60
        }),
        realized_pnl_percent: -8 + Math.random() * 16,
        actual_win: Math.random() > 0.48, // Slightly bearish bias
        max_drawdown_percent: Math.random() * 4,
        time_to_target: 45 + Math.random() * 150,
        exit_reason: ['TAKE_PROFIT', 'STOP_LOSS', 'TIMEOUT'][Math.floor(Math.random() * 3)],
        prediction_error: -0.15 + Math.random() * 0.3
      }));
      
      console.log(`📊 ETL extracted ${mockTrainingData.length} training samples (mock data)`);
      return mockTrainingData;

    } catch (error) {
      console.error('❌ Failed to extract trade outcomes:', error);
      throw error;
    }
  }

  /**
   * Transform trade data with advanced feature engineering
   */
  private async transformTradeData(rawData: any[]): Promise<any[]> {
    const transformedRecords = [];

    for (const record of rawData) {
      try {
        const transformed = await this.transformSingleRecord(record);
        if (transformed) {
          transformedRecords.push(transformed);
        }
      } catch (error) {
        console.error(`❌ Failed to transform record ${record.signal_id}:`, error);
        continue;
      }
    }

    return transformedRecords;
  }

  /**
   * Transform a single trade record with feature engineering
   */
  private async transformSingleRecord(record: any): Promise<any | null> {
    // Parse JSON fields
    const technicalIndicators = JSON.parse(record.technical_indicators || '{}');
    const qualityMetrics = JSON.parse(record.quality_metrics || '{}');
    const featureVector = JSON.parse(record.feature_vector || '[]');

    // Enhanced feature engineering
    const additionalFeatures = await this.engineerAdditionalFeatures(record, technicalIndicators);

    // Market context features
    const marketContextFeatures = await this.extractMarketContext(record);

    // Technical features with normalization
    const technicalFeatures = this.normalizeTechnicalFeatures(technicalIndicators);

    // Ensemble features
    const ensembleFeatures = [
      record.model_agreement_score / 100,
      record.ensemble_dispersion,
      record.path_smoothness / 100,
      record.quality_score / 100
    ];

    // Labels for supervised learning
    const labels = this.extractLabels(record);

    // Data quality checks
    if (!this.validateRecordQuality(record, labels)) {
      return null;
    }

    return {
      datasetVersion: 'pending', // Will be set during load
      signalId: record.signal_id,
      inputFeatures: [...featureVector, ...additionalFeatures],
      technicalFeatures,
      ensembleFeatures,
      marketContextFeatures,
      ...labels,
      metaModelPrediction: record.meta_model_prediction,
      metaModelVersion: record.meta_model_version,
      isValidSample: true,
      hasOutcome: true,
      outlierFlag: this.detectOutlier(record)
    };
  }

  /**
   * Engineer additional features from trade data
   */
  private async engineerAdditionalFeatures(record: any, indicators: any): Promise<number[]> {
    const features = [];

    // Time-based features
    const signalHour = new Date(record.signal_timestamp).getHours();
    features.push(Math.sin(2 * Math.PI * signalHour / 24)); // Hour of day cyclical
    features.push(Math.cos(2 * Math.PI * signalHour / 24));

    // Price position features
    const priceRange = indicators.bollingerUpper - indicators.bollingerLower;
    if (priceRange > 0) {
      const bbPosition = (record.current_price - indicators.bollingerLower) / priceRange;
      features.push(Math.max(0, Math.min(1, bbPosition)));
    } else {
      features.push(0.5); // Neutral position
    }

    // Volatility regime
    const volatilityPercentile = await this.getVolatilityPercentile(record.symbol, indicators.volatility);
    features.push(volatilityPercentile);

    // Signal strength
    const signalStrength = Math.abs(record.forecast_return) / (indicators.volatility + 1e-8);
    features.push(Math.tanh(signalStrength)); // Bounded between -1 and 1

    // Risk-adjusted return expectation
    const riskAdjustedReturn = record.forecast_return / Math.sqrt(indicators.volatility + 1e-8);
    features.push(Math.tanh(riskAdjustedReturn));

    return features;
  }

  /**
   * Extract market context features
   */
  private async extractMarketContext(record: any): Promise<number[]> {
    // Mock implementation - in reality would query market data
    return [
      Math.random() * 0.1, // Market volatility regime
      Math.random() * 0.1, // Cross-asset correlation
      Math.random() * 0.1, // Liquidity score
      Math.random() * 0.1  // News sentiment
    ];
  }

  /**
   * Normalize technical indicators
   */
  private normalizeTechnicalFeatures(indicators: any): number[] {
    return [
      (indicators.rsi || 50) / 100, // 0-1 scale
      Math.tanh((indicators.macd || 0) * 1000), // Bounded
      (indicators.stochasticK || 50) / 100,
      (indicators.stochasticD || 50) / 100,
      Math.min(1, (indicators.volatility || 0) * 100) // Cap at 1
    ];
  }

  /**
   * Extract learning labels
   */
  private extractLabels(record: any): any {
    return {
      profitLabel: record.actual_win,
      pnlLabel: record.realized_pnl_percent,
      drawdownLabel: record.max_drawdown_percent,
      timeToTargetLabel: record.time_to_target
    };
  }

  /**
   * Load transformed data into learning dataset
   */
  private async loadLearningDataset(transformedData: any[], datasetVersion: string): Promise<{
    loadedRecords: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let loadedRecords = 0;

    // Set dataset version
    transformedData.forEach(record => {
      record.datasetVersion = datasetVersion;
    });

    // Batch insert in chunks of 100
    for (let i = 0; i < transformedData.length; i += 100) {
      const batch = transformedData.slice(i, i + 100);
      
      try {
        await db.insert(learningDataset).values(batch);
        loadedRecords += batch.length;
      } catch (error) {
        console.error(`❌ Failed to load batch ${i}-${i + batch.length}:`, error);
        errors.push(`Batch ${i}: ${error.message}`);
      }
    }

    return { loadedRecords, errors };
  }

  /**
   * Validate dataset quality
   */
  private async validateDatasetQuality(datasetVersion: string): Promise<void> {
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_records,
          AVG(CASE WHEN profit_label THEN 1 ELSE 0 END) as win_rate,
          AVG(pnl_label) as avg_pnl,
          STDDEV(pnl_label) as pnl_stddev,
          COUNT(CASE WHEN outlier_flag THEN 1 END) as outlier_count
        FROM learning_dataset 
        WHERE dataset_version = $1
      `, [datasetVersion]));

      const result = stats[0] as any;
      
      console.log(`📊 Dataset ${datasetVersion} quality metrics:`, {
        totalRecords: result.total_records,
        winRate: (result.win_rate * 100).toFixed(1) + '%',
        avgPnL: result.avg_pnl?.toFixed(2) + '%',
        pnlStdDev: result.pnl_stddev?.toFixed(2) + '%',
        outlierCount: result.outlier_count
      });

    } catch (error) {
      console.error('❌ Dataset quality validation failed:', error);
    }
  }

  // Utility methods
  private async getVolatilityPercentile(symbol: string, volatility: number): Promise<number> {
    // Mock implementation - would query historical volatility data
    return Math.random(); // 0-1 percentile
  }

  private validateRecordQuality(record: any, labels: any): boolean {
    return (
      record.signal_id &&
      record.symbol &&
      labels.pnlLabel != null &&
      Math.abs(labels.pnlLabel) < 100 && // Exclude extreme outliers
      labels.timeToTargetLabel > 0 &&
      labels.timeToTargetLabel < 1440 // Less than 24 hours
    );
  }

  private detectOutlier(record: any): boolean {
    return (
      Math.abs(record.realized_pnl_percent) > 20 ||
      record.max_drawdown_percent > 15 ||
      record.time_to_target > 300 // More than 5 hours
    );
  }

  private createEmptyResult(): ETLJobResult {
    return {
      extractedRecords: 0,
      transformedRecords: 0,
      loadedRecords: 0,
      errors: [],
      datasetVersion: '',
      executionTime: 0
    };
  }

  /**
   * Get ETL job status
   */
  getStatus(): {
    isRunning: boolean;
    lastJobTimestamp: Date;
  } {
    return {
      isRunning: this.isRunning,
      lastJobTimestamp: this.lastJobTimestamp
    };
  }
}

// Singleton instance
export const learningETLPipeline = new LearningETLPipeline();