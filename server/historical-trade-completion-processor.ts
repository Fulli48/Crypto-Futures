import { db } from './db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { tradeSimulations, tradeHistoricalPrices, rollingChartData } from '../shared/schema';
import type { TradeSimulation, InsertTradeHistoricalPrice } from '../shared/schema';

export class HistoricalTradeCompletionProcessor {
  
  /**
   * Processes a completed trade using historical chart data to calculate accurate metrics
   * This replaces the old inaccurate method with authentic historical price analysis
   */
  public async processCompletedTrade(tradeId: number): Promise<{
    success: boolean;
    metrics?: {
      profitableTimePercentage: number;
      maxFavorableExcursion: number;
      maxDrawdown: number;
      totalDurationSeconds: number;
      profitableSeconds: number;
      lossSeconds: number;
      finalProfitLoss: number;
    };
    error?: string;
  }> {
    try {
      console.log(`🔍 [HISTORICAL PROCESSOR] Starting historical analysis for trade ${tradeId}`);
      
      // Get the completed trade details
      const [trade] = await db.select()
        .from(tradeSimulations)
        .where(eq(tradeSimulations.id, tradeId))
        .limit(1);
      
      if (!trade) {
        return { success: false, error: `Trade ${tradeId} not found` };
      }
      
      if (trade.actualOutcome === 'IN_PROGRESS') {
        return { success: false, error: `Trade ${tradeId} is still in progress` };
      }
      
      console.log(`📊 [HISTORICAL PROCESSOR] Trade ${tradeId} (${trade.symbol}): ${trade.signalType} from ${trade.startTime} to ${trade.endTime}`);
      
      // Get historical chart data for this trade's time period
      const historicalPrices = await this.getHistoricalPriceData(
        trade.symbol,
        trade.startTime,
        trade.endTime || new Date()
      );
      
      if (historicalPrices.length === 0) {
        console.log(`⚠️ [HISTORICAL PROCESSOR] No historical price data found for trade ${tradeId} - using fallback calculation`);
        return this.calculateFallbackMetrics(trade);
      }
      
      console.log(`📈 [HISTORICAL PROCESSOR] Found ${historicalPrices.length} historical price points for trade ${tradeId}`);
      
      // Calculate accurate metrics using historical price data
      const metrics = await this.calculateHistoricalMetrics(trade, historicalPrices);
      
      // Store historical price data for this trade
      await this.storeHistoricalPriceData(tradeId, historicalPrices, trade);
      
      // Update trade with accurate metrics
      await this.updateTradeWithHistoricalMetrics(tradeId, metrics);
      
      console.log(`✅ [HISTORICAL PROCESSOR] Trade ${tradeId} processed with historical data:`);
      console.log(`   Profitable Time: ${metrics.profitableTimePercentage.toFixed(1)}%`);
      console.log(`   MFE: ${metrics.maxFavorableExcursion.toFixed(2)}%, Drawdown: ${metrics.maxDrawdown.toFixed(2)}%`);
      console.log(`   Duration: ${metrics.totalDurationSeconds}s (${metrics.profitableSeconds}s profitable, ${metrics.lossSeconds}s loss)`);
      
      return { success: true, metrics };
      
    } catch (error) {
      console.error(`❌ [HISTORICAL PROCESSOR] Error processing trade ${tradeId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Get historical price data from rolling chart data for the trade's time period
   */
  private async getHistoricalPriceData(
    symbol: string,
    startTime: Date,
    endTime: Date
  ): Promise<Array<{ timestamp: Date; close: number; }>> {
    try {
      // Query rolling chart data for this symbol and time period
      const chartData = await db.select({
        timestamp: rollingChartData.timestamp,
        close: rollingChartData.close
      })
        .from(rollingChartData)
        .where(
          and(
            eq(rollingChartData.symbol, symbol),
            sql`${rollingChartData.timestamp} >= ${startTime}`,
            sql`${rollingChartData.timestamp} <= ${endTime}`
          )
        )
        .orderBy(rollingChartData.timestamp);
      
      return chartData.map(data => ({
        timestamp: data.timestamp,
        close: parseFloat(data.close)
      }));
      
    } catch (error) {
      console.error(`❌ [HISTORICAL PROCESSOR] Error fetching historical price data for ${symbol}:`, error);
      return [];
    }
  }
  
  /**
   * Calculate accurate metrics using historical price data
   */
  private async calculateHistoricalMetrics(
    trade: TradeSimulation,
    historicalPrices: Array<{ timestamp: Date; close: number; }>
  ): Promise<{
    profitableTimePercentage: number;
    maxFavorableExcursion: number;
    maxDrawdown: number;
    totalDurationSeconds: number;
    profitableSeconds: number;
    lossSeconds: number;
    finalProfitLoss: number;
  }> {
    const entryPrice = parseFloat(trade.entryPrice);
    const tpPrice = parseFloat(trade.tpPrice);
    const slPrice = parseFloat(trade.slPrice);
    const isLongTrade = trade.signalType === 'LONG';
    
    let profitableSeconds = 0;
    let lossSeconds = 0;
    let maxFavorableExcursion = 0;
    let maxDrawdown = 0;
    
    // Analyze each price point to determine profitability and extremes
    for (let i = 0; i < historicalPrices.length; i++) {
      const price = historicalPrices[i].close;
      
      // Calculate P&L percentage for this price point
      let pnlPercent: number;
      if (isLongTrade) {
        pnlPercent = ((price - entryPrice) / entryPrice) * 100;
      } else {
        pnlPercent = ((entryPrice - price) / entryPrice) * 100;
      }
      
      // Track time in profit vs loss (assume 1 minute intervals between data points)
      if (pnlPercent > 0) {
        profitableSeconds += 60; // 1 minute = 60 seconds
      } else if (pnlPercent < 0) {
        lossSeconds += 60; // 1 minute = 60 seconds  
      }
      // When pnlPercent === 0, don't add to either category
      
      // Track maximum favorable excursion (best profit)
      if (pnlPercent > maxFavorableExcursion) {
        maxFavorableExcursion = pnlPercent;
      }
      
      // Track maximum drawdown (worst loss)
      if (pnlPercent < maxDrawdown) {
        maxDrawdown = Math.abs(pnlPercent); // Store as positive value
      }
    }
    
    // Calculate final P&L based on actual outcome
    let finalProfitLoss: number;
    if (trade.actualOutcome === 'TP_HIT') {
      // Trade hit take profit
      if (isLongTrade) {
        finalProfitLoss = ((tpPrice - entryPrice) / entryPrice) * 100;
      } else {
        finalProfitLoss = ((entryPrice - tpPrice) / entryPrice) * 100;
      }
    } else if (trade.actualOutcome === 'SL_HIT') {
      // Trade hit stop loss
      if (isLongTrade) {
        finalProfitLoss = ((slPrice - entryPrice) / entryPrice) * 100;
      } else {
        finalProfitLoss = ((entryPrice - slPrice) / entryPrice) * 100;
      }
    } else {
      // Trade expired - use last known price
      const finalPrice = historicalPrices[historicalPrices.length - 1]?.close || entryPrice;
      if (isLongTrade) {
        finalProfitLoss = ((finalPrice - entryPrice) / entryPrice) * 100;
      } else {
        finalProfitLoss = ((entryPrice - finalPrice) / entryPrice) * 100;
      }
    }
    
    const totalDurationSeconds = profitableSeconds + lossSeconds;
    const profitableTimePercentage = totalDurationSeconds > 0 
      ? (profitableSeconds / totalDurationSeconds) * 100 
      : 0;
    
    return {
      profitableTimePercentage,
      maxFavorableExcursion,
      maxDrawdown,
      totalDurationSeconds,
      profitableSeconds,
      lossSeconds,
      finalProfitLoss
    };
  }
  
  /**
   * Store historical price data points for the completed trade
   */
  private async storeHistoricalPriceData(
    tradeId: number,
    historicalPrices: Array<{ timestamp: Date; close: number; }>,
    trade: TradeSimulation
  ): Promise<void> {
    try {
      const entryPrice = parseFloat(trade.entryPrice);
      const tpPrice = parseFloat(trade.tpPrice);
      const slPrice = parseFloat(trade.slPrice);
      const isLongTrade = trade.signalType === 'LONG';
      
      const historicalPriceInserts: InsertTradeHistoricalPrice[] = [];
      
      for (const priceData of historicalPrices) {
        // Calculate P&L for this price point
        let pnlPercent: number;
        if (isLongTrade) {
          pnlPercent = ((priceData.close - entryPrice) / entryPrice) * 100;
        } else {
          pnlPercent = ((entryPrice - priceData.close) / entryPrice) * 100;
        }
        
        // Calculate distances to TP/SL
        let distanceToTp: number;
        let distanceToSl: number;
        
        if (isLongTrade) {
          distanceToTp = ((tpPrice - priceData.close) / priceData.close) * 100;
          distanceToSl = ((priceData.close - slPrice) / priceData.close) * 100;
        } else {
          distanceToTp = ((priceData.close - tpPrice) / priceData.close) * 100;
          distanceToSl = ((slPrice - priceData.close) / priceData.close) * 100;
        }
        
        historicalPriceInserts.push({
          tradeId,
          timestamp: priceData.timestamp,
          open: priceData.close, // Use close as open for simplicity
          high: priceData.close,
          low: priceData.close,
          close: priceData.close,
          volume: 0, // Not available from chart data
          profitLossPercent: pnlPercent,
          distanceToTakeProfit: distanceToTp,
          distanceToStopLoss: distanceToSl,
          wasProfitable: pnlPercent > 0
        });
      }
      
      // Insert all historical price data
      if (historicalPriceInserts.length > 0) {
        await db.insert(tradeHistoricalPrices).values(historicalPriceInserts);
        console.log(`💾 [HISTORICAL PROCESSOR] Stored ${historicalPriceInserts.length} historical price points for trade ${tradeId}`);
      }
      
    } catch (error) {
      console.error(`❌ [HISTORICAL PROCESSOR] Error storing historical price data for trade ${tradeId}:`, error);
    }
  }
  
  /**
   * Update trade with calculated historical metrics
   */
  private async updateTradeWithHistoricalMetrics(
    tradeId: number,
    metrics: {
      profitableTimePercentage: number;
      maxFavorableExcursion: number;
      maxDrawdown: number;
      totalDurationSeconds: number;
      profitableSeconds: number;
      lossSeconds: number;
      finalProfitLoss: number;
    }
  ): Promise<void> {
    try {
      await db.update(tradeSimulations)
        .set({
          profitablePercentage: metrics.profitableTimePercentage.toFixed(1),
          maxFavorableExcursion: metrics.maxFavorableExcursion.toFixed(4),
          maxDrawdown: metrics.maxDrawdown.toFixed(4),
          profitLoss: metrics.finalProfitLoss.toFixed(2),
          finalProfitableSeconds: metrics.profitableSeconds,
          finalLossSeconds: metrics.lossSeconds,
          simulationDuration: Math.floor(metrics.totalDurationSeconds / 60), // Convert to minutes
          updatedAt: new Date()
        })
        .where(eq(tradeSimulations.id, tradeId));
      
      console.log(`✅ [HISTORICAL PROCESSOR] Updated trade ${tradeId} with historical metrics`);
      
    } catch (error) {
      console.error(`❌ [HISTORICAL PROCESSOR] Error updating trade ${tradeId} with historical metrics:`, error);
    }
  }
  
  /**
   * Fallback calculation when historical data is not available
   */
  private async calculateFallbackMetrics(trade: TradeSimulation): Promise<{
    success: boolean;
    metrics: {
      profitableTimePercentage: number;
      maxFavorableExcursion: number;
      maxDrawdown: number;
      totalDurationSeconds: number;
      profitableSeconds: number;
      lossSeconds: number;
      finalProfitLoss: number;
    };
  }> {
    // Use existing trade data as fallback
    const existingProfitablePercentage = parseFloat(trade.profitablePercentage || '0');
    const existingMFE = parseFloat(trade.maxFavorableExcursion || '0');
    const existingDrawdown = parseFloat(trade.maxDrawdown || '0');
    const existingProfitLoss = parseFloat(trade.profitLoss || '0');
    
    // Estimate duration from start/end times
    const startTime = trade.startTime;
    const endTime = trade.endTime || new Date();
    const totalDurationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // Estimate profitable vs loss seconds
    const profitableSeconds = Math.floor((totalDurationSeconds * existingProfitablePercentage) / 100);
    const lossSeconds = totalDurationSeconds - profitableSeconds;
    
    return {
      success: true,
      metrics: {
        profitableTimePercentage: existingProfitablePercentage,
        maxFavorableExcursion: existingMFE,
        maxDrawdown: existingDrawdown,
        totalDurationSeconds,
        profitableSeconds,
        lossSeconds,
        finalProfitLoss: existingProfitLoss
      }
    };
  }
  
  /**
   * Process all completed trades that haven't been processed with historical data yet
   */
  public async processAllCompletedTrades(): Promise<{
    processed: number;
    errors: number;
    details: string[];
  }> {
    try {
      console.log(`🔄 [HISTORICAL PROCESSOR] Starting batch processing of completed trades`);
      
      // Get all completed trades that don't have historical price data
      const completedTrades = await db.select()
        .from(tradeSimulations)
        .where(
          and(
            sql`${tradeSimulations.actualOutcome} IN ('TP_HIT', 'SL_HIT', 'EXPIRED')`,
            sql`${tradeSimulations.endTime} IS NOT NULL`
          )
        )
        .orderBy(desc(tradeSimulations.endTime));
      
      console.log(`📊 [HISTORICAL PROCESSOR] Found ${completedTrades.length} completed trades to process`);
      
      let processed = 0;
      let errors = 0;
      const details: string[] = [];
      
      for (const trade of completedTrades) {
        // Check if this trade already has historical price data
        const existingHistoricalData = await db.select()
          .from(tradeHistoricalPrices)
          .where(eq(tradeHistoricalPrices.tradeId, trade.id))
          .limit(1);
        
        if (existingHistoricalData.length > 0) {
          details.push(`Trade ${trade.id} already has historical data - skipping`);
          continue;
        }
        
        const result = await this.processCompletedTrade(trade.id);
        
        if (result.success) {
          processed++;
          details.push(`Trade ${trade.id} (${trade.symbol}) processed successfully`);
        } else {
          errors++;
          details.push(`Trade ${trade.id} (${trade.symbol}) failed: ${result.error}`);
        }
      }
      
      console.log(`✅ [HISTORICAL PROCESSOR] Batch processing complete: ${processed} processed, ${errors} errors`);
      
      return { processed, errors, details };
      
    } catch (error) {
      console.error(`❌ [HISTORICAL PROCESSOR] Error in batch processing:`, error);
      return { processed: 0, errors: 1, details: [(error as Error).message] };
    }
  }
}

// Export singleton instance
export const historicalTradeCompletionProcessor = new HistoricalTradeCompletionProcessor();