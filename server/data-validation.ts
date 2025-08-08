import { tradeSimulations, tradeChartData } from '@shared/schema';
import { db } from './db';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';

/**
 * Enterprise-grade data validation service for trade completion workflow
 * Provides comprehensive protection against NULL/undefined data corruption
 * Prevents incomplete trades from being stored when processes crash during completion
 */
export class DataValidationService {
  
  /**
   * Validates trade completion data with comprehensive NULL/undefined protection
   * Prevents crash-related data corruption by checking all critical fields
   */
  static validateTradeCompletion(data: {
    profitLoss: any;
    finalProfitablePercentage: any;
    scoreResult: any;
    timeInProfitRatio: any;
    maxFavorableExcursion: any;
    maxDrawdown: any;
    finalProfitableSeconds: any;
    finalLossSeconds: any;
    simulationDuration: any;
  }): { isValid: boolean; reason?: string } {
    
    // Critical NULL/undefined protection - prevents crash data corruption
    if (data.profitLoss === null || data.profitLoss === undefined || isNaN(data.profitLoss)) {
      return { isValid: false, reason: 'Critical: profit/loss value is NULL or undefined - process crash detected' };
    }
    
    if (data.finalProfitablePercentage === null || data.finalProfitablePercentage === undefined || isNaN(data.finalProfitablePercentage)) {
      return { isValid: false, reason: 'Critical: profitable percentage is NULL or undefined - incomplete completion' };
    }
    
    if (!data.scoreResult || data.scoreResult.successScore === null || data.scoreResult.successScore === undefined) {
      return { isValid: false, reason: 'Critical: success score calculation failed - scoring process crashed' };
    }
    
    if (data.simulationDuration === null || data.simulationDuration === undefined || data.simulationDuration <= 0) {
      return { isValid: false, reason: 'Critical: simulation duration invalid - trade completion corrupted' };
    }
    
    if (data.timeInProfitRatio === null || data.timeInProfitRatio === undefined || isNaN(data.timeInProfitRatio)) {
      return { isValid: false, reason: 'Critical: time in profit ratio is NULL - time calculation failed' };
    }
    
    if (data.maxFavorableExcursion === null || data.maxFavorableExcursion === undefined) {
      return { isValid: false, reason: 'Critical: max favorable excursion is NULL - MFE calculation failed' };
    }
    
    if (data.maxDrawdown === null || data.maxDrawdown === undefined) {
      return { isValid: false, reason: 'Critical: max drawdown is NULL - drawdown calculation failed' };
    }
    
    if (data.finalProfitableSeconds === null || data.finalProfitableSeconds === undefined) {
      return { isValid: false, reason: 'Critical: final profitable seconds is NULL - time accumulation failed' };
    }
    
    if (data.finalLossSeconds === null || data.finalLossSeconds === undefined) {
      return { isValid: false, reason: 'Critical: final loss seconds is NULL - time accumulation failed' };
    }
    
    // Check for all-zero profit window metrics (indicates complete data corruption)
    if (data.maxFavorableExcursion === 0 && data.maxDrawdown === 0 && data.timeInProfitRatio === 0 && 
        data.finalProfitableSeconds === 0 && data.finalLossSeconds === 0) {
      return { isValid: false, reason: 'Critical: All profit window metrics are zero - complete data corruption detected' };
    }
    
    return { isValid: true };
  }
  
  /**
   * Validates trade completion data before database storage
   * Implements multi-layer validation with detailed error reporting
   */
  static async validateTradeCompletionData(tradeData: any): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Core Data Validation
    if (!tradeData.id || typeof tradeData.id !== 'number') {
      errors.push('Invalid trade ID');
    }

    if (!tradeData.symbol || typeof tradeData.symbol !== 'string') {
      errors.push('Invalid symbol');
    }

    if (!['LONG', 'SHORT'].includes(tradeData.signalType)) {
      errors.push('Invalid signal type - must be LONG or SHORT');
    }

    if (!['SHORT', 'MEDIUM', 'LONG'].includes(tradeData.simulationType)) {
      errors.push('Invalid simulation type - must be SHORT, MEDIUM, or LONG');
    }

    // 2. Price Data Validation
    const requiredPriceFields = ['entryPrice', 'tpPrice', 'slPrice'];
    for (const field of requiredPriceFields) {
      const value = tradeData[field];
      if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
        errors.push(`Invalid ${field} - must be positive number`);
      }
    }

    // 3. TP/SL Relationship Validation
    if (tradeData.entryPrice && tradeData.tpPrice && tradeData.slPrice) {
      const entry = parseFloat(tradeData.entryPrice);
      const tp = parseFloat(tradeData.tpPrice);
      const sl = parseFloat(tradeData.slPrice);

      if (tradeData.signalType === 'LONG') {
        if (tp <= entry) {
          errors.push('LONG trade: Take Profit must be above entry price');
        }
        if (sl >= entry) {
          errors.push('LONG trade: Stop Loss must be below entry price');
        }
      } else if (tradeData.signalType === 'SHORT') {
        if (tp >= entry) {
          errors.push('SHORT trade: Take Profit must be below entry price');
        }
        if (sl <= entry) {
          errors.push('SHORT trade: Stop Loss must be above entry price');
        }
      }
    }

    // 4. Confidence and Profit Likelihood Validation
    if (tradeData.confidence !== undefined) {
      const conf = parseFloat(tradeData.confidence);
      if (isNaN(conf) || conf < 0 || conf > 100) {
        errors.push('Confidence must be between 0 and 100');
      }
    }

    if (tradeData.profitLikelihood !== undefined) {
      const profit = parseFloat(tradeData.profitLikelihood);
      if (isNaN(profit) || profit < 0 || profit > 100) {
        errors.push('Profit likelihood must be between 0 and 100');
      }
    }

    // 5. Success Score System Validation
    if (tradeData.successScore !== undefined) {
      const score = parseFloat(tradeData.successScore);
      if (isNaN(score)) {
        errors.push('Success score must be a valid number');
      }
    }

    if (tradeData.timeInProfitRatio !== undefined) {
      const ratio = parseFloat(tradeData.timeInProfitRatio);
      if (isNaN(ratio) || ratio < 0 || ratio > 1) {
        errors.push('Time in profit ratio must be between 0 and 1');
      }
    }

    // 6. Market Data Validation
    if (tradeData.marketConditions) {
      try {
        const conditions = typeof tradeData.marketConditions === 'string' 
          ? JSON.parse(tradeData.marketConditions)
          : tradeData.marketConditions;
        
        if (!conditions || typeof conditions !== 'object') {
          warnings.push('Market conditions data is empty or invalid');
        }
      } catch (e) {
        errors.push('Market conditions contains invalid JSON');
      }
    }

    if (tradeData.indicatorValues) {
      try {
        const indicators = typeof tradeData.indicatorValues === 'string'
          ? JSON.parse(tradeData.indicatorValues)
          : tradeData.indicatorValues;
        
        if (!indicators || typeof indicators !== 'object') {
          warnings.push('Indicator values data is empty or invalid');
        }
      } catch (e) {
        errors.push('Indicator values contains invalid JSON');
      }
    }

    // 7. Duration Validation
    if (tradeData.durationMinutes !== undefined) {
      const duration = parseInt(tradeData.durationMinutes);
      if (isNaN(duration) || duration <= 0) {
        errors.push('Duration must be positive integer');
      }
    }

    // 8. Time Tracking Validation
    if (tradeData.finalProfitableSeconds !== undefined && tradeData.finalLossSeconds !== undefined) {
      const profitTime = parseInt(tradeData.finalProfitableSeconds);
      const lossTime = parseInt(tradeData.finalLossSeconds);
      
      if (isNaN(profitTime) || profitTime < 0) {
        errors.push('Final profitable seconds must be non-negative integer');
      }
      if (isNaN(lossTime) || lossTime < 0) {
        errors.push('Final loss seconds must be non-negative integer');
      }
      
      if (profitTime === 0 && lossTime === 0) {
        warnings.push('Both profitable and loss time are zero - may indicate missing chart data');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates chart data integrity for a specific trade
   */
  static async validateChartData(tradeId: number): Promise<{
    hasChartData: boolean;
    dataPoints: number;
    timeRange: { start?: Date; end?: Date };
    gaps: boolean;
  }> {
    try {
      const chartData = await db
        .select()
        .from(tradeChartData)
        .where(eq(tradeChartData.tradeId, tradeId))
        .orderBy(tradeChartData.timestamp);

      if (chartData.length === 0) {
        return {
          hasChartData: false,
          dataPoints: 0,
          timeRange: {},
          gaps: false
        };
      }

      // Check for time gaps (more than 5 seconds between points)
      let hasGaps = false;
      for (let i = 1; i < chartData.length; i++) {
        const timeDiff = chartData[i].timestamp.getTime() - chartData[i-1].timestamp.getTime();
        if (timeDiff > 5000) { // More than 5 seconds gap
          hasGaps = true;
          break;
        }
      }

      return {
        hasChartData: true,
        dataPoints: chartData.length,
        timeRange: {
          start: chartData[0].timestamp,
          end: chartData[chartData.length - 1].timestamp
        },
        gaps: hasGaps
      };

    } catch (error) {
      console.error('Error validating chart data:', error);
      return {
        hasChartData: false,
        dataPoints: 0,
        timeRange: {},
        gaps: false
      };
    }
  }

  /**
   * Performs comprehensive data integrity check across all tables
   */
  static async performSystemIntegrityCheck(): Promise<{
    tradesWithoutChartData: number;
    tradesWithInvalidTP: number;
    tradesWithMissingSuccessScores: number;
    orphanedChartData: number;
    totalTrades: number;
    recommendations: string[];
  }> {
    try {
      // Count total trades
      const totalTrades = await db.select().from(tradeSimulations);
      
      // Find trades without chart data
      const tradesWithoutChartData = await db
        .select({ id: tradeSimulations.id })
        .from(tradeSimulations)
        .leftJoin(tradeChartData, eq(tradeSimulations.id, tradeChartData.tradeId))
        .where(isNull(tradeChartData.tradeId));

      // Find trades with invalid TP/SL relationships
      const tradesWithInvalidTP = totalTrades.filter(trade => {
        const entry = parseFloat(trade.entryPrice);
        const tp = parseFloat(trade.tpPrice);
        const sl = parseFloat(trade.slPrice);

        if (trade.signalType === 'LONG') {
          return tp <= entry || sl >= entry;
        } else if (trade.signalType === 'SHORT') {
          return tp >= entry || sl <= entry;
        }
        return false;
      });

      // Find trades with missing success scores
      const tradesWithMissingSuccessScores = totalTrades.filter(trade => 
        trade.successScore === null || trade.successScore === undefined
      );

      // Find orphaned chart data
      const orphanedChartData = await db
        .select({ id: tradeChartData.id })
        .from(tradeChartData)
        .leftJoin(tradeSimulations, eq(tradeChartData.tradeId, tradeSimulations.id))
        .where(isNull(tradeSimulations.id));

      const recommendations: string[] = [];
      
      if (tradesWithoutChartData.length > 0) {
        recommendations.push(`${tradesWithoutChartData.length} trades missing chart data - affects time-based analysis`);
      }
      
      if (tradesWithInvalidTP.length > 0) {
        recommendations.push(`${tradesWithInvalidTP.length} trades have invalid TP/SL relationships - needs correction`);
      }
      
      if (tradesWithMissingSuccessScores.length > 0) {
        recommendations.push(`${tradesWithMissingSuccessScores.length} trades missing success scores - recalculation needed`);
      }
      
      if (orphanedChartData.length > 0) {
        recommendations.push(`${orphanedChartData.length} orphaned chart data records - cleanup recommended`);
      }

      return {
        tradesWithoutChartData: tradesWithoutChartData.length,
        tradesWithInvalidTP: tradesWithInvalidTP.length,
        tradesWithMissingSuccessScores: tradesWithMissingSuccessScores.length,
        orphanedChartData: orphanedChartData.length,
        totalTrades: totalTrades.length,
        recommendations
      };

    } catch (error) {
      console.error('Error performing system integrity check:', error);
      throw new Error('Failed to perform system integrity check');
    }
  }

  /**
   * Implements idempotency check for trade completion processing
   */
  static async checkProcessingIdempotency(tradeId: number): Promise<{
    alreadyProcessed: boolean;
    lastProcessedAt?: Date;
    processVersion: number;
  }> {
    try {
      const trade = await db
        .select({
          completionProcessed: tradeSimulations.completionProcessed,
          lastProcessedAt: tradeSimulations.lastProcessedAt,
          processVersion: tradeSimulations.processVersion
        })
        .from(tradeSimulations)
        .where(eq(tradeSimulations.id, tradeId))
        .limit(1);

      if (trade.length === 0) {
        throw new Error(`Trade ${tradeId} not found`);
      }

      return {
        alreadyProcessed: trade[0].completionProcessed || false,
        lastProcessedAt: trade[0].lastProcessedAt || undefined,
        processVersion: trade[0].processVersion || 1
      };

    } catch (error) {
      console.error(`Error checking processing idempotency for trade ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Marks trade as processed to prevent duplicate processing
   */
  static async markTradeAsProcessed(tradeId: number): Promise<void> {
    try {
      await db
        .update(tradeSimulations)
        .set({
          completionProcessed: true,
          lastProcessedAt: new Date(),
          processVersion: 1 // Current schema version
        })
        .where(eq(tradeSimulations.id, tradeId));

      console.log(`✅ [IDEMPOTENCY] Trade ${tradeId} marked as processed`);

    } catch (error) {
      console.error(`Error marking trade ${tradeId} as processed:`, error);
      throw error;
    }
  }
}