import { db } from "./db";
import { rollingChartData, mlTrainingSamples, mlTrainingBatches } from "@shared/schema";
import { eq, and, desc, gte, lte, count, isNotNull } from "drizzle-orm";
import { DataLeakagePreventionService } from "./data-leakage-prevention";

/**
 * ML Training Data Sampler Service
 * 
 * Implements continuous sampling process that:
 * 1. Scans the latest 10 hours (600 rows) of complete data per symbol
 * 2. Constructs training samples with 120-row inputs → 20-row targets
 * 3. Excludes samples with missing input/output fields
 * 4. Stores samples in dedicated training data table for reproducibility
 */
class MLTrainingDataSampler {
  private readonly WINDOW_SIZE = 600; // 10 hours of minute data
  private readonly INPUT_SEQUENCE_LENGTH = 120; // 2 hours of input features
  private readonly TARGET_SEQUENCE_LENGTH = 20; // 20 minutes of target prices
  private readonly SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  
  /**
   * Main entry point for continuous sampling process
   */
  async runContinuousSampling(): Promise<void> {
    console.log('🧠 [ML SAMPLER] Starting continuous training data sampling process');
    
    for (const symbol of this.SUPPORTED_SYMBOLS) {
      await this.procesSymbolSamples(symbol);
    }
    
    await this.createTrainingBatchIfReady();
    console.log('✅ [ML SAMPLER] Continuous sampling cycle completed');
  }
  
  /**
   * Process samples for a specific symbol
   */
  private async procesSymbolSamples(symbol: string): Promise<void> {
    console.log(`🔍 [ML SAMPLER] Processing samples for ${symbol}`);
    
    // Get the latest 600 complete rows for this symbol
    const latestData = await this.getLatestCompleteData(symbol);
    
    if (latestData.length < (this.INPUT_SEQUENCE_LENGTH + this.TARGET_SEQUENCE_LENGTH)) {
      console.log(`⚠️ [ML SAMPLER] ${symbol}: Insufficient data (${latestData.length} rows, need ${this.INPUT_SEQUENCE_LENGTH + this.TARGET_SEQUENCE_LENGTH})`);
      return;
    }
    
    console.log(`📊 [ML SAMPLER] ${symbol}: Found ${latestData.length} complete data points`);
    
    // Calculate all possible sliding windows
    const maxStartIndex = latestData.length - this.INPUT_SEQUENCE_LENGTH - this.TARGET_SEQUENCE_LENGTH;
    const samplesCreated = [];
    
    for (let startIndex = 0; startIndex <= maxStartIndex; startIndex++) {
      const sample = await this.constructTrainingSample(symbol, latestData, startIndex);
      
      if (sample && sample.hasCompleteInput && sample.hasCompleteTarget) {
        const existingSample = await this.checkIfSampleExists(sample.sampleKey);
        
        if (!existingSample) {
          await this.storeSample(sample);
          samplesCreated.push(sample.sampleKey);
        }
      }
    }
    
    console.log(`✅ [ML SAMPLER] ${symbol}: Created ${samplesCreated.length} new training samples`);
  }
  
  /**
   * SYSTEM RESILIENCE: Validate chart data for API outages, NaNs, price spikes
   */
  private validateChartData(data: any[]): { isValid: boolean; reason?: string } {
    if (!data || data.length === 0) {
      return { isValid: false, reason: 'No data available' };
    }

    for (const point of data) {
      // Check for NaN values in critical fields
      if (isNaN(point.close) || isNaN(point.rsi) || isNaN(point.realizedVolatility)) {
        return { isValid: false, reason: `NaN values detected in ${point.symbol} at ${point.timestamp}` };
      }
      
      // Check for unrealistic price spikes (>20% change in 1 minute)
      if (data.indexOf(point) > 0) {
        const prevPoint = data[data.indexOf(point) - 1];
        const priceChange = Math.abs((point.close - prevPoint.close) / prevPoint.close);
        if (priceChange > 0.20) {
          return { isValid: false, reason: `Price spike detected: ${(priceChange * 100).toFixed(1)}% change` };
        }
      }
      
      // Check for missing technical indicators
      if (point.rsi === null || point.macd === null || point.bollingerUpper === null) {
        return { isValid: false, reason: 'Missing critical technical indicators' };
      }
    }

    return { isValid: true };
  }

  /**
   * Get latest complete data for a symbol within the 600-row window
   */
  private async getLatestCompleteData(symbol: string) {
    const cutoffTime = new Date(Date.now() - (this.WINDOW_SIZE * 60 * 1000)); // 10 hours ago
    
    const rawData = await db
      .select()
      .from(rollingChartData)
      .where(
        and(
          eq(rollingChartData.symbol, symbol),
          eq(rollingChartData.isComplete, true),
          gte(rollingChartData.timestamp, cutoffTime),
          isNotNull(rollingChartData.close),
          isNotNull(rollingChartData.rsi),
          isNotNull(rollingChartData.macd),
          isNotNull(rollingChartData.realizedVolatility)
        )
      )
      .orderBy(desc(rollingChartData.timestamp))
      .limit(this.WINDOW_SIZE);

    // SYSTEM RESILIENCE: Validate data quality before processing
    const validation = this.validateChartData(rawData);
    if (!validation.isValid) {
      console.warn(`⚠️ [DATA VALIDATION] ${symbol}: ${validation.reason} - skipping training window`);
      return []; // Return empty array to skip this window
    }

    return rawData;
  }
  
  /**
   * Construct a training sample from data window with DATA LEAKAGE PREVENTION and SYSTEM RESILIENCE
   */
  private async constructTrainingSample(
    symbol: string, 
    data: any[], 
    startIndex: number
  ): Promise<any | null> {
    try {
      const inputData = data.slice(startIndex, startIndex + this.INPUT_SEQUENCE_LENGTH);
      const targetData = data.slice(
        startIndex + this.INPUT_SEQUENCE_LENGTH, 
        startIndex + this.INPUT_SEQUENCE_LENGTH + this.TARGET_SEQUENCE_LENGTH
      );
      
      if (inputData.length !== this.INPUT_SEQUENCE_LENGTH || targetData.length !== this.TARGET_SEQUENCE_LENGTH) {
        return null;
      }

      // SYSTEM RESILIENCE: Additional data validation before processing
      const inputValidation = this.validateChartData(inputData);
      const targetValidation = this.validateChartData(targetData);
      
      if (!inputValidation.isValid) {
        console.warn(`⚠️ [INPUT VALIDATION] ${symbol}: ${inputValidation.reason} - skipping sample`);
        return null;
      }
      
      if (!targetValidation.isValid) {
        console.warn(`⚠️ [TARGET VALIDATION] ${symbol}: ${targetValidation.reason} - skipping sample`);
        return null;
      }
      
      // 🚨 CRITICAL DATA LEAKAGE PREVENTION CHECK
      const baseTimestamp = new Date(inputData[0].timestamp);
      const targetTimestamp = new Date(targetData[0].timestamp);
      
      const temporalValidation = DataLeakagePreventionService.validateTemporalBoundaries(
        inputData,
        targetData,
        baseTimestamp
      );
      
      if (!temporalValidation.assertionPassed) {
        console.error(`🚨 [DATA LEAKAGE BLOCKED] Sample rejected for ${symbol} at index ${startIndex}`);
        console.error(`📊 Temporal violation: Features end ${temporalValidation.featureEndTime.toISOString()}, targets start ${temporalValidation.targetStartTime.toISOString()}`);
        return null; // REJECT SAMPLE WITH TEMPORAL VIOLATION
      }
      
      // Extract features for input sequence
      const inputSequence = inputData.map(row => ({
        timestamp: row.timestamp,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        rsi: row.rsi,
        macd: row.macd,
        macdSignal: row.macdSignal || 0,
        macdHistogram: row.macdHistogram || 0,
        bollingerUpper: parseFloat(row.bollingerUpper || '0'),
        bollingerMiddle: parseFloat(row.bollingerMiddle || '0'),
        bollingerLower: parseFloat(row.bollingerLower || '0'),
        stochasticK: row.stochasticK,
        stochasticD: row.stochasticD,
        realizedVolatility: row.realizedVolatility,
        tradeCount: row.tradeCount || 0,
        buyVolume: parseFloat(row.buyVolume || '0'),
        sellVolume: parseFloat(row.sellVolume || '0')
      }));
      
      // Extract target close prices
      const targetPricesRaw = targetData.map(row => parseFloat(row.close));
      const targetVolumes = targetData.map(row => parseFloat(row.volume));
      
      // Check for missing input data
      const missingInputFields = this.checkMissingFields(inputSequence, [
        'close', 'rsi', 'macd', 'realizedVolatility', 'volume'
      ]);
      
      // Check for missing target data
      const missingTargetFields = targetPricesRaw.some(price => isNaN(price) || price <= 0) ? ['close'] : [];
      
      // Calculate normalization parameters (mean/std) for input features
      const normalizationParams = this.calculateNormalizationParams(inputSequence);
      
      // Normalize input sequence
      const normalizedInput = this.normalizeSequence(inputSequence, normalizationParams);
      
      // Normalize target prices using close price normalization
      const targetPricesNormalized = this.normalizeTargetPrices(targetPricesRaw, normalizationParams.close);
      
      // Calculate data completeness
      const inputDataCompleteness = ((this.INPUT_SEQUENCE_LENGTH - missingInputFields.length) / this.INPUT_SEQUENCE_LENGTH) * 100;
      const targetDataCompleteness = missingTargetFields.length === 0 ? 100.0 : 0.0;
      
      // Calculate price volatility for the entire sample period
      const allPrices = [...inputSequence.map(d => d.close), ...targetPricesRaw];
      const priceVolatility = this.calculateVolatility(allPrices);
      
      const windowStart = data[0].timestamp;
      const windowEnd = data[data.length - 1].timestamp;
      
      const sampleKey = `${symbol}_${baseTimestamp.getTime()}_${String(startIndex).padStart(3, '0')}`;
      
      // 🧪 FINAL TRAINING SAMPLE AUDIT
      const auditResult = DataLeakagePreventionService.auditTrainingSample({
        inputSequence: inputSequence,
        targetPricesRaw: targetPricesRaw,
        baseTimestamp: baseTimestamp,
        targetTimestamp: targetTimestamp
      });
      
      if (!auditResult.passed) {
        console.error(`🚨 [SAMPLE AUDIT FAILED] ${symbol} sample ${sampleKey}:`);
        auditResult.violations.forEach(violation => console.error(`   ❌ ${violation}`));
        return null; // REJECT SAMPLE THAT FAILS AUDIT
      }
      
      if (auditResult.recommendations.length > 0) {
        console.warn(`⚠️ [SAMPLE AUDIT WARNING] ${symbol} sample ${sampleKey}:`);
        auditResult.recommendations.forEach(rec => console.warn(`   ⚠️ ${rec}`));
      }
      
      return {
        symbol,
        sampleKey,
        baseTimestamp,
        targetTimestamp,
        windowStart,
        windowEnd,
        inputSequence: normalizedInput,
        inputMetadata: normalizationParams,
        targetPricesRaw,
        targetPricesNormalized,
        targetVolumes,
        hasCompleteInput: missingInputFields.length === 0,
        hasCompleteTarget: missingTargetFields.length === 0,
        missingInputFields,
        missingTargetFields,
        inputDataCompleteness,
        targetDataCompleteness,
        priceVolatility,
        isTrainingReady: missingInputFields.length === 0 && missingTargetFields.length === 0
      };
      
    } catch (error) {
      console.error(`❌ [ML SAMPLER] Error constructing sample for ${symbol} at index ${startIndex}:`, error);
      return null;
    }
  }
  
  /**
   * Check for missing fields in input sequence
   */
  private checkMissingFields(sequence: any[], requiredFields: string[]): string[] {
    const missing: string[] = [];
    
    for (const field of requiredFields) {
      const hasAnyMissing = sequence.some(row => {
        const value = row[field];
        return value === null || value === undefined || (typeof value === 'number' && isNaN(value));
      });
      
      if (hasAnyMissing) {
        missing.push(field);
      }
    }
    
    return missing;
  }
  
  /**
   * Calculate normalization parameters (mean/std) for each feature
   */
  private calculateNormalizationParams(sequence: any[]): any {
    const features = ['open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 'realizedVolatility'];
    const params: any = {};
    
    for (const feature of features) {
      const values = sequence.map(row => row[feature]).filter(v => !isNaN(v) && v !== null);
      
      if (values.length > 0) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        
        params[feature] = { mean, std: std > 0 ? std : 1.0 }; // Prevent division by zero
      } else {
        params[feature] = { mean: 0, std: 1.0 };
      }
    }
    
    return params;
  }
  
  /**
   * Normalize input sequence using provided parameters
   */
  private normalizeSequence(sequence: any[], params: any): any[] {
    return sequence.map(row => {
      const normalized: any = { ...row };
      
      for (const [feature, normParams] of Object.entries(params)) {
        const { mean, std } = normParams as { mean: number; std: number };
        if (normalized[feature] !== null && !isNaN(normalized[feature])) {
          normalized[feature] = (normalized[feature] - mean) / std;
        }
      }
      
      return normalized;
    });
  }
  
  /**
   * Normalize target prices using close price normalization parameters
   */
  private normalizeTargetPrices(prices: number[], closeParams: any): number[] {
    const { mean, std } = closeParams;
    return prices.map(price => (price - mean) / std);
  }
  
  /**
   * Calculate price volatility for a sequence of prices
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > 0 && prices[i-1] > 0) {
        returns.push(Math.log(prices[i] / prices[i-1]));
      }
    }
    
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252 * 24 * 60); // Annualized minute-level volatility
  }
  
  /**
   * Check if sample already exists
   */
  private async checkIfSampleExists(sampleKey: string): Promise<boolean> {
    const existing = await db
      .select({ id: mlTrainingSamples.id })
      .from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.sampleKey, sampleKey))
      .limit(1);
    
    return existing.length > 0;
  }
  
  /**
   * Store sample in database
   */
  private async storeSample(sample: any): Promise<void> {
    try {
      await db.insert(mlTrainingSamples).values({
        symbol: sample.symbol,
        sampleKey: sample.sampleKey,
        baseTimestamp: sample.baseTimestamp,
        targetTimestamp: sample.targetTimestamp,
        windowStart: sample.windowStart,
        windowEnd: sample.windowEnd,
        inputSequence: sample.inputSequence,
        inputMetadata: sample.inputMetadata,
        targetPricesRaw: sample.targetPricesRaw,
        targetPricesNormalized: sample.targetPricesNormalized,
        targetVolumes: sample.targetVolumes,
        hasCompleteInput: sample.hasCompleteInput,
        hasCompleteTarget: sample.hasCompleteTarget,
        missingInputFields: sample.missingInputFields,
        missingTargetFields: sample.missingTargetFields,
        inputDataCompleteness: sample.inputDataCompleteness,
        targetDataCompleteness: sample.targetDataCompleteness,
        priceVolatility: sample.priceVolatility,
        isTrainingReady: sample.isTrainingReady
      });
    } catch (error) {
      console.error(`❌ [ML SAMPLER] Error storing sample ${sample.sampleKey}:`, error);
    }
  }
  
  /**
   * Create training batch if enough samples are ready
   */
  private async createTrainingBatchIfReady(): Promise<void> {
    const minSamplesPerSymbol = 50;
    const readySamples = await this.getReadySamplesCount();
    
    console.log('📊 [ML SAMPLER] Ready samples count:', readySamples);
    
    // Check if we have enough samples for each symbol
    const symbolsReady = Object.entries(readySamples).filter(([_, count]) => count >= minSamplesPerSymbol);
    
    if (symbolsReady.length >= 3) { // Need at least 3 symbols
      console.log(`🎯 [ML SAMPLER] Creating training batch with ${symbolsReady.length} symbols`);
      await this.createTrainingBatch(symbolsReady);
    } else {
      console.log(`⏳ [ML SAMPLER] Not ready for batch creation. Need ${minSamplesPerSymbol} samples per symbol, have: ${JSON.stringify(readySamples)}`);
    }
  }
  
  /**
   * Get count of ready samples per symbol
   */
  private async getReadySamplesCount(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    
    for (const symbol of this.SUPPORTED_SYMBOLS) {
      const [result] = await db
        .select({ count: count() })
        .from(mlTrainingSamples)
        .where(
          and(
            eq(mlTrainingSamples.symbol, symbol),
            eq(mlTrainingSamples.isTrainingReady, true),
            eq(mlTrainingSamples.usedInTraining, false)
          )
        );
      
      counts[symbol] = result?.count || 0;
    }
    
    return counts;
  }
  
  /**
   * Create a training batch from ready samples
   */
  private async createTrainingBatch(symbolsReady: [string, number][]): Promise<void> {
    const batchKey = `BATCH_${Date.now()}_${symbolsReady.length}symbols`;
    const symbolsIncluded = symbolsReady.map(([symbol, _]) => symbol);
    const samplesPerSymbol = Object.fromEntries(symbolsReady);
    const totalSamples = symbolsReady.reduce((sum, [_, count]) => sum + count, 0);
    
    // Calculate data window from available samples
    const windowStats = await this.getDataWindowStats();
    
    try {
      await db.insert(mlTrainingBatches).values({
        batchKey,
        symbolsIncluded,
        totalSamples,
        samplesPerSymbol,
        dataWindowStart: windowStats.earliest,
        dataWindowEnd: windowStats.latest,
        modelArchitecture: 'LSTM',
        inputFeatures: [
          'open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 
          'macdSignal', 'macdHistogram', 'realizedVolatility', 'stochasticK', 'stochasticD'
        ],
        normalizationParams: {}
      });
      
      console.log(`✅ [ML SAMPLER] Created training batch: ${batchKey} with ${totalSamples} samples`);
    } catch (error) {
      console.error('❌ [ML SAMPLER] Error creating training batch:', error);
    }
  }
  
  /**
   * Get data window statistics
   */
  private async getDataWindowStats(): Promise<{ earliest: Date, latest: Date }> {
    const [earliest] = await db
      .select({ timestamp: mlTrainingSamples.baseTimestamp })
      .from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.isTrainingReady, true))
      .orderBy(mlTrainingSamples.baseTimestamp)
      .limit(1);
    
    const [latest] = await db
      .select({ timestamp: mlTrainingSamples.targetTimestamp })
      .from(mlTrainingSamples)
      .where(eq(mlTrainingSamples.isTrainingReady, true))
      .orderBy(desc(mlTrainingSamples.targetTimestamp))
      .limit(1);
    
    return {
      earliest: earliest?.timestamp || new Date(),
      latest: latest?.timestamp || new Date()
    };
  }
}

// Export service instance
export const mlTrainingDataSampler = new MLTrainingDataSampler();

// Auto-start sampling process every 5 minutes
setInterval(async () => {
  try {
    await mlTrainingDataSampler.runContinuousSampling();
  } catch (error) {
    console.error('❌ [ML SAMPLER] Error in continuous sampling:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// Initial run
setTimeout(async () => {
  try {
    console.log('🚀 [ML SAMPLER] Starting initial training data sampling...');
    await mlTrainingDataSampler.runContinuousSampling();
  } catch (error) {
    console.error('❌ [ML SAMPLER] Error in initial sampling run:', error);
  }
}, 10000); // Start after 10 seconds to allow system to initialize