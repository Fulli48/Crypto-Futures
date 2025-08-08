import { db } from './db.js';
import { tradeSimulations, rollingChartData } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * Realistic Trade Evaluator - Implements enhanced trade completion logic
 * Evaluates trades based on minute-by-minute price action during the 20-minute window
 */

// Configuration constants for realistic trade evaluation
const MIN_PROFIT_TIME = 2; // minutes (comfortable window for pullout opportunity)
const MIN_PROFIT_THRESHOLD = 0.001; // 0.1% profit threshold

export interface TradeEvaluationResult {
  outcome: 'TP_HIT' | 'SL_HIT' | 'PULLOUT_PROFIT' | 'NO_PROFIT';
  profitLoss: number;
  profitIntervals: number;
  totalIntervals: number;
  highestProfit: number;
  lowestLoss: number;
  metadata: {
    tpHitAt?: Date;
    slHitAt?: Date;
    profitableMinutes: number;
    explanation: string;
  };
}

export class RealisticTradeEvaluator {
  /**
   * Evaluate a completed trade using realistic minute-by-minute analysis
   */
  static async evaluateCompletedTrade(tradeId: number): Promise<TradeEvaluationResult> {
    try {
      // Get the trade details
      const [trade] = await db.select()
        .from(tradeSimulations)
        .where(eq(tradeSimulations.id, tradeId))
        .limit(1);
      
      if (!trade) {
        throw new Error(`Trade ${tradeId} not found`);
      }
      
      console.log(`📊 [REALISTIC EVALUATOR] Starting evaluation for trade ${tradeId} (${trade.symbol})`);
      
      // Get minute-by-minute price data for the trade duration
      const priceData = await this.getTradeMinuteData(
        trade.symbol, 
        trade.startTime, 
        trade.endTime || new Date()
      );
      
      if (priceData.length === 0) {
        console.log(`⚠️ [REALISTIC EVALUATOR] No price data found for trade ${tradeId} - using fallback`);
        return this.fallbackEvaluation(trade);
      }
      
      // Perform minute-by-minute evaluation
      const result = this.analyzeTradeProgression(trade, priceData);
      
      console.log(`✅ [REALISTIC EVALUATOR] Trade ${tradeId} evaluated: ${result.outcome} (${result.profitIntervals}/${result.totalIntervals} profitable intervals)`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [REALISTIC EVALUATOR] Error evaluating trade ${tradeId}:`, error);
      throw error;
    }
  }
  
  /**
   * Analyze minute-by-minute trade progression
   */
  private static analyzeTradeProgression(trade: any, priceData: any[]): TradeEvaluationResult {
    const entryPrice = parseFloat(trade.entryPrice);
    const tpPrice = parseFloat(trade.tpPrice);
    const slPrice = parseFloat(trade.slPrice);
    const isLong = trade.signalType === 'LONG';
    
    let profitIntervals = 0;
    let highestProfit = 0;
    let lowestLoss = 0;
    let tpHitAt: Date | undefined;
    let slHitAt: Date | undefined;
    let outcome: 'TP_HIT' | 'SL_HIT' | 'PULLOUT_PROFIT' | 'NO_PROFIT' = 'NO_PROFIT';
    let finalProfitLoss = 0;
    
    // Analyze each minute interval
    for (const pricePoint of priceData) {
      const price = parseFloat(pricePoint.close);
      const timestamp = new Date(pricePoint.timestamp);
      
      // Check for TP/SL hits first (highest priority)
      if (isLong) {
        if (price >= tpPrice) {
          outcome = 'TP_HIT';
          tpHitAt = timestamp;
          finalProfitLoss = ((tpPrice - entryPrice) / entryPrice) * 100;
          break;
        }
        if (price <= slPrice) {
          outcome = 'SL_HIT';
          slHitAt = timestamp;
          finalProfitLoss = ((slPrice - entryPrice) / entryPrice) * 100;
          break;
        }
        
        // Check if price meets profit threshold
        if (price >= entryPrice * (1 + MIN_PROFIT_THRESHOLD)) {
          profitIntervals++;
        }
        
        // Track profit/loss metrics
        const pnlPercent = ((price - entryPrice) / entryPrice) * 100;
        if (pnlPercent > highestProfit) highestProfit = pnlPercent;
        if (pnlPercent < lowestLoss) lowestLoss = pnlPercent;
        
      } else { // SHORT trade
        if (price <= tpPrice) {
          outcome = 'TP_HIT';
          tpHitAt = timestamp;
          finalProfitLoss = ((entryPrice - tpPrice) / entryPrice) * 100;
          break;
        }
        if (price >= slPrice) {
          outcome = 'SL_HIT';
          slHitAt = timestamp;
          finalProfitLoss = ((entryPrice - slPrice) / entryPrice) * 100;
          break;
        }
        
        // Check if price meets profit threshold
        if (price <= entryPrice * (1 - MIN_PROFIT_THRESHOLD)) {
          profitIntervals++;
        }
        
        // Track profit/loss metrics
        const pnlPercent = ((entryPrice - price) / entryPrice) * 100;
        if (pnlPercent > highestProfit) highestProfit = pnlPercent;
        if (pnlPercent < lowestLoss) lowestLoss = pnlPercent;
      }
    }
    
    // If no TP/SL hit, determine outcome based on profit time
    if (outcome !== 'TP_HIT' && outcome !== 'SL_HIT') {
      if (profitIntervals >= MIN_PROFIT_TIME) {
        outcome = 'PULLOUT_PROFIT';
        // Calculate final P&L based on last price
        const finalPrice = parseFloat(priceData[priceData.length - 1]?.close || trade.entryPrice);
        if (isLong) {
          finalProfitLoss = ((finalPrice - entryPrice) / entryPrice) * 100;
        } else {
          finalProfitLoss = ((entryPrice - finalPrice) / entryPrice) * 100;
        }
      } else {
        outcome = 'NO_PROFIT';
        // Calculate final P&L based on last price
        const finalPrice = parseFloat(priceData[priceData.length - 1]?.close || trade.entryPrice);
        if (isLong) {
          finalProfitLoss = ((finalPrice - entryPrice) / entryPrice) * 100;
        } else {
          finalProfitLoss = ((entryPrice - finalPrice) / entryPrice) * 100;
        }
      }
    }
    
    return {
      outcome,
      profitLoss: finalProfitLoss,
      profitIntervals,
      totalIntervals: priceData.length,
      highestProfit,
      lowestLoss,
      metadata: {
        tpHitAt,
        slHitAt,
        profitableMinutes: profitIntervals,
        explanation: this.generateExplanation(outcome, profitIntervals, priceData.length)
      }
    };
  }
  
  /**
   * Get minute-by-minute price data for a trade period
   */
  private static async getTradeMinuteData(symbol: string, startTime: Date, endTime: Date) {
    try {
      const result = await db.select({
        timestamp: rollingChartData.timestamp,
        close: rollingChartData.close,
        high: rollingChartData.high,
        low: rollingChartData.low
      })
      .from(rollingChartData)
      .where(
        and(
          eq(rollingChartData.symbol, symbol),
          gte(rollingChartData.timestamp, startTime),
          lte(rollingChartData.timestamp, endTime)
        )
      )
      .orderBy(rollingChartData.timestamp);
      
      return result;
    } catch (error) {
      console.error(`❌ [REALISTIC EVALUATOR] Error fetching price data for ${symbol}:`, error);
      return [];
    }
  }
  
  /**
   * Fallback evaluation when no price data is available
   */
  private static fallbackEvaluation(trade: any): TradeEvaluationResult {
    // Use existing actualOutcome if available, otherwise default to NO_PROFIT
    let outcome: 'TP_HIT' | 'SL_HIT' | 'PULLOUT_PROFIT' | 'NO_PROFIT';
    
    if (trade.actualOutcome === 'TP_HIT') {
      outcome = 'TP_HIT';
    } else if (trade.actualOutcome === 'SL_HIT') {
      outcome = 'SL_HIT';
    } else {
      outcome = 'NO_PROFIT';
    }
    
    const profitLoss = parseFloat(trade.profitLoss?.toString() || '0');
    const highestProfit = parseFloat(trade.highestProfit?.toString() || '0');
    
    return {
      outcome,
      profitLoss,
      profitIntervals: 0,
      totalIntervals: 20, // Assume 20 minute intervals
      highestProfit,
      lowestLoss: Math.min(0, profitLoss),
      metadata: {
        profitableMinutes: 0,
        explanation: 'Fallback evaluation - no minute data available'
      }
    };
  }
  
  /**
   * Generate explanation for the outcome
   */
  private static generateExplanation(
    outcome: string, 
    profitIntervals: number, 
    totalIntervals: number
  ): string {
    switch (outcome) {
      case 'TP_HIT':
        return 'Trade hit take profit target';
      case 'SL_HIT':
        return 'Trade hit stop loss target';
      case 'PULLOUT_PROFIT':
        return `Trade spent ${profitIntervals}/${totalIntervals} minutes above profit threshold - sufficient for pullout`;
      case 'NO_PROFIT':
        return `Trade spent only ${profitIntervals}/${totalIntervals} minutes above profit threshold - insufficient for pullout`;
      default:
        return 'Unknown outcome';
    }
  }
  
  /**
   * Update trade with realistic evaluation results
   */
  static async updateTradeWithRealisticEvaluation(tradeId: number): Promise<void> {
    try {
      const evaluation = await this.evaluateCompletedTrade(tradeId);
      
      // Map new outcomes to success/failure
      const isSuccessful = evaluation.outcome === 'TP_HIT' || evaluation.outcome === 'PULLOUT_PROFIT';
      
      await db.update(tradeSimulations)
        .set({
          actualOutcome: evaluation.outcome,
          profitLoss: evaluation.profitLoss.toString(),
          highestProfit: evaluation.highestProfit.toString(),
          lowestLoss: evaluation.lowestLoss.toString(),
          isSuccessful,
          completionProcessed: true,
          lastProcessedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tradeSimulations.id, tradeId));
      
      console.log(`✅ [REALISTIC EVALUATOR] Updated trade ${tradeId} with realistic evaluation: ${evaluation.outcome}`);
      
    } catch (error) {
      console.error(`❌ [REALISTIC EVALUATOR] Error updating trade ${tradeId}:`, error);
      throw error;
    }
  }
}