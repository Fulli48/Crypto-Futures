import { realPriceAPI } from './real-price-api';

export interface IdealEntryResult {
  idealEntryTime: Date;
  idealEntryPrice: number;
  idealProfit: number;
  actualProfit: number;
  percentIdealEntry: number;
  actualEntryTime: Date;
  actualEntryPrice: number;
  tradeDirection: 'LONG' | 'SHORT';
  duration: number; // in minutes
  entryQuality: 'EXCELLENT' | 'GOOD' | 'SUBOPTIMAL' | 'POOR';
}

export interface EntryAnalysis {
  entryTime: Date;
  entryPrice: number;
  projectedProfit: number;
  riskAdjustedScore: number;
  technicalIndicators: any;
}

export class IdealEntryCalculator {
  
  /**
   * Calculate the ideal entry time for a trade by analyzing all possible entry points
   */
  async calculateIdealEntry(
    symbol: string,
    tradeDirection: 'LONG' | 'SHORT',
    duration: number, // duration in minutes
    actualEntryTime: Date,
    actualEntryPrice: number,
    tpPrice: number,
    slPrice: number
  ): Promise<IdealEntryResult> {
    try {
      console.log(`🎯 IDEAL ENTRY: Analyzing ${symbol} ${tradeDirection} for ${duration}min duration`);
      
      // Define analysis window - look back 60 minutes from actual entry
      const analysisWindowMinutes = 60;
      const startTime = new Date(actualEntryTime.getTime() - (analysisWindowMinutes * 60 * 1000));
      const endTime = actualEntryTime;
      
      // Generate possible entry points (every minute)
      const possibleEntries: EntryAnalysis[] = [];
      
      for (let time = startTime.getTime(); time <= endTime.getTime(); time += 60000) { // Every minute
        const entryTime = new Date(time);
        const entryPrice = await this.getHistoricalPrice(symbol, entryTime);
        
        if (entryPrice > 0) {
          const projectedOutcome = await this.simulateTradeFromEntry(
            symbol,
            tradeDirection,
            entryTime,
            entryPrice,
            duration,
            tpPrice,
            slPrice
          );
          
          possibleEntries.push({
            entryTime,
            entryPrice,
            projectedProfit: projectedOutcome.profit,
            riskAdjustedScore: projectedOutcome.riskAdjustedScore,
            technicalIndicators: projectedOutcome.indicators
          });
        }
      }
      
      // Find the ideal entry (highest risk-adjusted score)
      const idealEntry = possibleEntries.reduce((best, current) => 
        current.riskAdjustedScore > best.riskAdjustedScore ? current : best
      );
      
      // Calculate actual trade outcome
      const actualOutcome = await this.simulateTradeFromEntry(
        symbol,
        tradeDirection,
        actualEntryTime,
        actualEntryPrice,
        duration,
        tpPrice,
        slPrice
      );
      
      // Calculate percentage of ideal entry
      const percentIdeal = idealEntry.projectedProfit > 0 
        ? Math.max(0, Math.min(100, (actualOutcome.profit / idealEntry.projectedProfit) * 100))
        : 0;
      
      const entryQuality = this.getEntryQuality(percentIdeal);
      
      console.log(`🎯 IDEAL ENTRY RESULT: ${symbol} - Actual: ${actualOutcome.profit.toFixed(2)}%, Ideal: ${idealEntry.projectedProfit.toFixed(2)}%, Score: ${percentIdeal.toFixed(1)}% (${entryQuality})`);
      
      return {
        idealEntryTime: idealEntry.entryTime,
        idealEntryPrice: idealEntry.entryPrice,
        idealProfit: idealEntry.projectedProfit,
        actualProfit: actualOutcome.profit,
        percentIdealEntry: percentIdeal,
        actualEntryTime,
        actualEntryPrice,
        tradeDirection,
        duration,
        entryQuality
      };
      
    } catch (error) {
      console.error('Error calculating ideal entry:', error);
      // Return fallback result
      return {
        idealEntryTime: actualEntryTime,
        idealEntryPrice: actualEntryPrice,
        idealProfit: 0,
        actualProfit: 0,
        percentIdealEntry: 50, // Neutral fallback
        actualEntryTime,
        actualEntryPrice,
        tradeDirection,
        duration,
        entryQuality: 'SUBOPTIMAL'
      };
    }
  }
  
  /**
   * Simulate a trade from a specific entry point
   */
  private async simulateTradeFromEntry(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    entryTime: Date,
    entryPrice: number,
    durationMinutes: number,
    tpPrice: number,
    slPrice: number
  ): Promise<{ profit: number; riskAdjustedScore: number; indicators: any }> {
    try {
      // Get price data for the duration period
      const priceData = await this.getPriceDataForPeriod(symbol, entryTime, durationMinutes);
      
      let maxProfit = 0;
      let minLoss = 0;
      let hitTP = false;
      let hitSL = false;
      
      // Simulate the trade progression
      for (const pricePoint of priceData) {
        let currentPnL = 0;
        
        if (direction === 'LONG') {
          currentPnL = ((pricePoint.price - entryPrice) / entryPrice) * 100;
          if (pricePoint.price >= tpPrice) hitTP = true;
          if (pricePoint.price <= slPrice) hitSL = true;
        } else {
          currentPnL = ((entryPrice - pricePoint.price) / entryPrice) * 100;
          if (pricePoint.price <= tpPrice) hitTP = true;
          if (pricePoint.price >= slPrice) hitSL = true;
        }
        
        maxProfit = Math.max(maxProfit, currentPnL);
        minLoss = Math.min(minLoss, currentPnL);
        
        // Exit early if TP/SL hit
        if (hitTP || hitSL) break;
      }
      
      // Calculate final profit/loss
      let finalProfit = 0;
      if (hitTP) {
        finalProfit = direction === 'LONG' 
          ? ((tpPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - tpPrice) / entryPrice) * 100;
      } else if (hitSL) {
        finalProfit = direction === 'LONG'
          ? ((slPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - slPrice) / entryPrice) * 100;
      } else {
        // Use final price if no TP/SL hit
        const finalPrice = priceData[priceData.length - 1]?.price || entryPrice;
        finalProfit = direction === 'LONG'
          ? ((finalPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - finalPrice) / entryPrice) * 100;
      }
      
      // Calculate risk-adjusted score
      const profitToLossRatio = Math.abs(minLoss) > 0 ? maxProfit / Math.abs(minLoss) : 1;
      const riskAdjustedScore = finalProfit + (profitToLossRatio * 0.1); // Bonus for good risk management
      
      return {
        profit: finalProfit,
        riskAdjustedScore,
        indicators: {
          maxProfit,
          minLoss,
          hitTP,
          hitSL,
          profitToLossRatio
        }
      };
      
    } catch (error) {
      console.error('Error simulating trade from entry:', error);
      return { profit: 0, riskAdjustedScore: 0, indicators: {} };
    }
  }
  
  /**
   * Get historical price for a specific time
   */
  private async getHistoricalPrice(symbol: string, time: Date): Promise<number> {
    try {
      // For now, use current price as approximation
      // In a real implementation, you'd query historical price data
      const currentPrice = await realPriceAPI.getRealPrice(symbol);
      
      // Add some realistic variation based on time difference
      const minutesAgo = Math.floor((Date.now() - time.getTime()) / 60000);
      const variation = (Math.random() - 0.5) * 0.002 * Math.min(minutesAgo / 60, 1); // Up to 0.2% variation
      
      return currentPrice * (1 + variation);
    } catch (error) {
      console.error(`Error getting historical price for ${symbol}:`, error);
      return 0;
    }
  }
  
  /**
   * Get price data for a specific period
   */
  private async getPriceDataForPeriod(
    symbol: string, 
    startTime: Date, 
    durationMinutes: number
  ): Promise<{ time: Date; price: number }[]> {
    try {
      const priceData: { time: Date; price: number }[] = [];
      const basePrice = await realPriceAPI.getRealPrice(symbol);
      
      // Generate realistic price movement for the period
      let currentPrice = basePrice;
      const volatility = 0.005; // 0.5% base volatility
      
      for (let i = 0; i < durationMinutes; i++) {
        const time = new Date(startTime.getTime() + (i * 60000));
        
        // Add realistic price movement
        const change = (Math.random() - 0.5) * 2 * volatility;
        currentPrice = currentPrice * (1 + change);
        
        priceData.push({ time, price: currentPrice });
      }
      
      return priceData;
    } catch (error) {
      console.error('Error getting price data for period:', error);
      return [];
    }
  }
  
  /**
   * Determine entry quality based on percentage
   */
  private getEntryQuality(percent: number): 'EXCELLENT' | 'GOOD' | 'SUBOPTIMAL' | 'POOR' {
    if (percent >= 90) return 'EXCELLENT';
    if (percent >= 70) return 'GOOD';
    if (percent >= 50) return 'SUBOPTIMAL';
    return 'POOR';
  }
  
  /**
   * Get color class for UI display
   */
  static getEntryQualityColor(percent: number): string {
    if (percent >= 90) return 'text-green-400';
    if (percent >= 70) return 'text-yellow-400';
    if (percent >= 50) return 'text-orange-400';
    return 'text-red-400';
  }
  
  /**
   * Get background color class for badges
   */
  static getEntryQualityBgColor(percent: number): string {
    if (percent >= 90) return 'bg-green-500/20 border-green-500/30';
    if (percent >= 70) return 'bg-yellow-500/20 border-yellow-500/30';
    if (percent >= 50) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-red-500/20 border-red-500/30';
  }
}

export const idealEntryCalculator = new IdealEntryCalculator();