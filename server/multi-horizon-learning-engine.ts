import { db } from './db';
import { horizonFeatureWeights, forecastAccuracyHistory, tradeSimulations } from '../shared/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';

/**
 * MULTI-HORIZON LEARNING ENGINE
 * 
 * Manages feature weights and learning for different time horizons:
 * - Short-term (1-5 minutes): High-frequency patterns, momentum
 * - Mid-term (6-12 minutes): Trend confirmation, reversal patterns  
 * - Long-term (13-20 minutes): Structure breaks, major trend shifts
 */

export interface HorizonLearningConfig {
  horizonRange: '1-5' | '6-12' | '13-20';
  features: string[];
  learningRate: number;
  decayFactor: number;
}

export interface HorizonWeights {
  [featureName: string]: {
    shortTerm: number;    // 1-5 minute weight
    midTerm: number;      // 6-12 minute weight  
    longTerm: number;     // 13-20 minute weight
  };
}

export class MultiHorizonLearningEngine {
  private horizonConfigs: HorizonLearningConfig[] = [
    {
      horizonRange: '1-5',
      features: ['rsi', 'macd', 'stochastic', 'volatility', 'volume_profile'],
      learningRate: 0.25,   // High learning rate for fast patterns
      decayFactor: 0.95,
    },
    {
      horizonRange: '6-12', 
      features: ['bollinger_bands', 'ema_alignment', 'support_resistance', 'market_structure'],
      learningRate: 0.15,   // Moderate learning rate for trend patterns
      decayFactor: 0.97,
    },
    {
      horizonRange: '13-20',
      features: ['patterns', 'market_structure', 'support_resistance', 'volume_profile'],
      learningRate: 0.10,   // Conservative learning rate for structural patterns
      decayFactor: 0.98,
    },
  ];

  private targetSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('🎯 [MULTI-HORIZON] Initializing multi-horizon learning system...');
    
    // Initialize default weights for each symbol and horizon range
    for (const symbol of this.targetSymbols) {
      await this.initializeSymbolWeights(symbol);
    }
    
    this.isInitialized = true;
    console.log('✅ [MULTI-HORIZON] Multi-horizon learning system initialized');
  }

  /**
   * Initialize default weights for a symbol across all horizon ranges
   */
  private async initializeSymbolWeights(symbol: string): Promise<void> {
    for (const config of this.horizonConfigs) {
      for (const feature of config.features) {
        try {
          await db
            .insert(horizonFeatureWeights)
            .values({
              symbol,
              horizonRange: config.horizonRange,
              featureName: feature,
              weightValue: 1.0, // Default weight
            })
            .onConflictDoNothing();
        } catch (error) {
          // Ignore conflicts - weights already exist
        }
      }
    }
  }

  /**
   * Update weights based on completed trade performance
   */
  async updateWeightsFromTrade(
    symbol: string,
    trade: any,
    forecastAccuracy: { [horizon: string]: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🎯 [MULTI-HORIZON] Updating weights for ${symbol} trade ${trade.id}`);

    // Calculate reward based on trade outcome
    const tradeReward = this.calculateTradeReward(trade);
    
    // Update weights for each horizon range based on forecast accuracy
    for (const config of this.horizonConfigs) {
      const horizonAccuracy = this.getHorizonAccuracy(config.horizonRange, forecastAccuracy);
      await this.updateHorizonWeights(symbol, config, tradeReward, horizonAccuracy);
    }
  }

  /**
   * Calculate trade reward using the existing graded reward system
   */
  private calculateTradeReward(trade: any): number {
    let reward = 0;
    
    // Base reward based on realistic outcome classification
    if (trade.actual_outcome === 'TP_HIT' || trade.actual_outcome === 'PULLOUT_PROFIT') {
      reward = 1.0;
    } else if (trade.actual_outcome === 'SL_HIT' || trade.actual_outcome === 'NO_PROFIT') {
      reward = -1.0;
    }
    
    // Add MFE and drawdown adjustments
    const mfe = parseFloat(trade.max_favorable_excursion?.toString() || '0');
    const drawdown = Math.abs(parseFloat(trade.max_drawdown?.toString() || '0'));
    
    if (mfe > 0) {
      reward += 0.2 * Math.min(1.0, mfe / 0.5); // Bonus for favorable moves
    }
    
    if (drawdown > 0) {
      reward -= 0.2 * Math.min(1.0, drawdown / 0.5); // Penalty for drawdowns
    }
    
    return Math.max(-1.4, Math.min(1.4, reward));
  }

  /**
   * Get accuracy for specific horizon range
   */
  private getHorizonAccuracy(horizonRange: string, forecastAccuracy: { [horizon: string]: number }): number {
    const [minHorizon, maxHorizon] = horizonRange.split('-').map(Number);
    
    let totalAccuracy = 0;
    let count = 0;
    
    for (let h = minHorizon; h <= maxHorizon; h++) {
      if (forecastAccuracy[h.toString()]) {
        totalAccuracy += forecastAccuracy[h.toString()];
        count++;
      }
    }
    
    return count > 0 ? totalAccuracy / count : 50; // Default accuracy
  }

  /**
   * Update weights for specific horizon range
   */
  private async updateHorizonWeights(
    symbol: string,
    config: HorizonLearningConfig,
    tradeReward: number,
    horizonAccuracy: number
  ): Promise<void> {
    const learningSignal = tradeReward * (horizonAccuracy / 100);
    
    for (const feature of config.features) {
      try {
        // Get current weight
        const currentWeight = await this.getCurrentWeight(symbol, config.horizonRange, feature);
        
        // Calculate new weight with horizon-specific learning rate
        const weightAdjustment = config.learningRate * learningSignal;
        const newWeight = Math.max(0.1, Math.min(10.0, currentWeight + weightAdjustment));
        
        // Apply decay factor to prevent excessive weight inflation
        const decayedWeight = newWeight * config.decayFactor;
        
        // Update in database
        await db
          .update(horizonFeatureWeights)
          .set({
            weightValue: decayedWeight,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(horizonFeatureWeights.symbol, symbol),
              eq(horizonFeatureWeights.horizonRange, config.horizonRange),
              eq(horizonFeatureWeights.featureName, feature)
            )
          );
        
        console.log(`📈 [MULTI-HORIZON] ${symbol} ${config.horizonRange} ${feature}: ${currentWeight.toFixed(3)} → ${decayedWeight.toFixed(3)}`);
        
      } catch (error) {
        console.error(`❌ [MULTI-HORIZON] Error updating weight for ${symbol} ${feature}:`, error);
      }
    }
  }

  /**
   * Get current weight for feature/horizon combination
   */
  private async getCurrentWeight(symbol: string, horizonRange: string, featureName: string): Promise<number> {
    try {
      const result = await db
        .select()
        .from(horizonFeatureWeights)
        .where(
          and(
            eq(horizonFeatureWeights.symbol, symbol),
            eq(horizonFeatureWeights.horizonRange, horizonRange),
            eq(horizonFeatureWeights.featureName, featureName)
          )
        )
        .limit(1);
      
      return result.length > 0 ? result[0].weightValue || 1.0 : 1.0;
    } catch (error) {
      console.error(`❌ [MULTI-HORIZON] Error getting current weight:`, error);
      return 1.0;
    }
  }

  /**
   * Get all horizon weights for a symbol
   */
  async getHorizonWeights(symbol: string): Promise<HorizonWeights> {
    const weights: HorizonWeights = {};
    
    try {
      const allWeights = await db
        .select()
        .from(horizonFeatureWeights)
        .where(eq(horizonFeatureWeights.symbol, symbol));
      
      for (const weight of allWeights) {
        const feature = weight.featureName;
        if (!weights[feature]) {
          weights[feature] = { shortTerm: 1.0, midTerm: 1.0, longTerm: 1.0 };
        }
        
        switch (weight.horizonRange) {
          case '1-5':
            weights[feature].shortTerm = weight.weightValue || 1.0;
            break;
          case '6-12':
            weights[feature].midTerm = weight.weightValue || 1.0;
            break;
          case '13-20':
            weights[feature].longTerm = weight.weightValue || 1.0;
            break;
        }
      }
    } catch (error) {
      console.error(`❌ [MULTI-HORIZON] Error getting horizon weights for ${symbol}:`, error);
    }
    
    return weights;
  }

  /**
   * Calculate adjusted confidence based on horizon-specific accuracies
   */
  calculateAdjustedConfidence(
    baseConfidence: number,
    forecastAccuracy: { [horizon: string]: number },
    tradeDuration: number = 20
  ): number {
    // Weight different horizons based on trade duration
    const shortTermWeight = tradeDuration <= 5 ? 0.6 : 0.3;
    const midTermWeight = tradeDuration <= 12 ? 0.3 : 0.4;
    const longTermWeight = tradeDuration > 12 ? 0.4 : 0.1;
    
    // Calculate weighted accuracy
    const shortTermAcc = this.getHorizonAccuracy('1-5', forecastAccuracy);
    const midTermAcc = this.getHorizonAccuracy('6-12', forecastAccuracy);
    const longTermAcc = this.getHorizonAccuracy('13-20', forecastAccuracy);
    
    const weightedAccuracy = (
      shortTermAcc * shortTermWeight +
      midTermAcc * midTermWeight +
      longTermAcc * longTermWeight
    );
    
    // Adjust base confidence by weighted accuracy
    const accuracyMultiplier = weightedAccuracy / 50; // Normalize around 50% baseline
    const adjustedConfidence = baseConfidence * accuracyMultiplier;
    
    return Math.max(30, Math.min(95, adjustedConfidence));
  }

  /**
   * Get forecast accuracy history for horizon analysis
   */
  async getForecastAccuracyForTrade(symbol: string, tradeStartTime: Date): Promise<{ [horizon: string]: number }> {
    try {
      // Get forecast accuracy data from 30 minutes before trade
      const lookbackTime = new Date(tradeStartTime.getTime() - 30 * 60 * 1000);
      
      const accuracyData = await db
        .select({
          horizonMinute: forecastAccuracyHistory.horizonMinute,
          accuracy: sql<number>`AVG(CASE WHEN ${forecastAccuracyHistory.directionCorrect} THEN 100 ELSE 0 END)`,
        })
        .from(forecastAccuracyHistory)
        .where(
          and(
            eq(forecastAccuracyHistory.symbol, symbol),
            gte(forecastAccuracyHistory.forecastTimestamp, lookbackTime),
            sql`${forecastAccuracyHistory.actualPrice} IS NOT NULL`
          )
        )
        .groupBy(forecastAccuracyHistory.horizonMinute);
      
      const result: { [horizon: string]: number } = {};
      for (const row of accuracyData) {
        result[row.horizonMinute.toString()] = row.accuracy || 50;
      }
      
      return result;
    } catch (error) {
      console.error(`❌ [MULTI-HORIZON] Error getting forecast accuracy:`, error);
      return {};
    }
  }

  /**
   * Determine optimal TP/SL adjustment based on horizon performance
   */
  calculateOptimalTPSL(
    baseTP: number,
    baseSL: number,
    entryPrice: number,
    forecastAccuracy: { [horizon: string]: number }
  ): { adjustedTP: number; adjustedSL: number; reasoning: string } {
    const shortTermAcc = this.getHorizonAccuracy('1-5', forecastAccuracy);
    const midTermAcc = this.getHorizonAccuracy('6-12', forecastAccuracy);
    const longTermAcc = this.getHorizonAccuracy('13-20', forecastAccuracy);
    
    let tpMultiplier = 1.0;
    let slMultiplier = 1.0;
    let reasoning = '';
    
    if (shortTermAcc > 70 && longTermAcc < 50) {
      // High short-term accuracy, poor long-term -> tighten TP, keep SL
      tpMultiplier = 0.7;
      slMultiplier = 1.0;
      reasoning = 'Short-term favorable, quick exit strategy';
    } else if (longTermAcc > 70 && shortTermAcc < 50) {
      // High long-term accuracy, poor short-term -> extend TP, widen SL
      tpMultiplier = 1.3;
      slMultiplier = 1.2;
      reasoning = 'Long-term favorable, extended target strategy';
    } else if (midTermAcc > 70) {
      // Strong mid-term accuracy -> balanced approach
      tpMultiplier = 1.0;
      slMultiplier = 0.9;
      reasoning = 'Mid-term favorable, balanced approach';
    } else {
      // Poor accuracy across horizons -> conservative approach
      tpMultiplier = 0.8;
      slMultiplier = 0.8;
      reasoning = 'Low accuracy, conservative targets';
    }
    
    const tpDistance = Math.abs(baseTP - entryPrice);
    const slDistance = Math.abs(baseSL - entryPrice);
    
    const adjustedTP = baseTP > entryPrice ? 
      entryPrice + (tpDistance * tpMultiplier) :
      entryPrice - (tpDistance * tpMultiplier);
      
    const adjustedSL = baseSL > entryPrice ?
      entryPrice + (slDistance * slMultiplier) :
      entryPrice - (slDistance * slMultiplier);
    
    return { adjustedTP, adjustedSL, reasoning };
  }
}

// Export singleton instance
export const multiHorizonLearningEngine = new MultiHorizonLearningEngine();