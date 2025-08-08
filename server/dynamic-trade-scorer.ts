/**
 * DYNAMIC TRADE SCORING SYSTEM
 * 
 * Each trade receives a weighted score (0.1% to 1.0%) based on:
 * 1. Profit Time Percentage (40% weight) - More time profitable = higher score
 * 2. Peak Profit Achievement (60% weight) - Higher peak profit = higher score
 * 
 * Score Formula:
 * - Base Score = 0.1% (minimum contribution)
 * - Time Component = (profitable_percentage / 100) * 0.4 * 0.9% 
 * - Profit Component = min(highest_profit / 1.0, 1.0) * 0.6 * 0.9%
 * - Final Score = Base Score + Time Component + Profit Component
 */

export interface TradeScoreResult {
  weightedScore: number;        // Final weighted score (0.001 to 0.01 = 0.1% to 1.0%)
  timeComponent: number;        // Contribution from time profitable
  profitComponent: number;      // Contribution from peak profit
  baseScore: number;           // Minimum base score
  gradeDescription: string;    // Human-readable trade grade
}

export class DynamicTradeScorer {
  private static readonly BASE_SCORE = 0.001;      // 0.1% minimum contribution
  private static readonly MAX_ADDITIONAL = 0.009;  // 0.9% maximum additional (total 1.0%)
  private static readonly TIME_WEIGHT = 0.4;       // 40% weight for time profitable
  private static readonly PROFIT_WEIGHT = 0.6;     // 60% weight for peak profit
  private static readonly PROFIT_TARGET = 1.0;     // 1.0% profit target for max score

  /**
   * Calculate dynamic weighted score for a trade
   * PRIORITY SCORING: TP_HIT = 1.0% (maximum), SL_HIT = 0.1% (minimum)
   */
  static calculateTradeScore(trade: any): TradeScoreResult {
    // PRIORITY SCORING: TP_HIT trades get maximum score (1.0%)
    if (trade.actualOutcome === 'TP_HIT' || trade.outcome === 'TP_HIT') {
      return {
        weightedScore: 0.01, // 1.0% maximum contribution
        timeComponent: this.MAX_ADDITIONAL * this.TIME_WEIGHT, // Full time weight
        profitComponent: this.MAX_ADDITIONAL * this.PROFIT_WEIGHT, // Full profit weight
        baseScore: this.BASE_SCORE,
        gradeDescription: 'A+ (Excellent) - TP Hit'
      };
    }
    
    // PRIORITY SCORING: SL_HIT trades get minimum score (0.1%)
    if (trade.actualOutcome === 'SL_HIT' || trade.outcome === 'SL_HIT') {
      return {
        weightedScore: this.BASE_SCORE, // 0.1% minimum contribution
        timeComponent: 0, // No additional time component
        profitComponent: 0, // No additional profit component
        baseScore: this.BASE_SCORE,
        gradeDescription: 'F (Failing) - SL Hit'
      };
    }
    
    // EXPIRED trades use weighted calculation
    const profitablePercentage = parseFloat(trade.profitable_percentage || trade.profitablePercentage || '0');
    const highestProfit = parseFloat(trade.highest_profit || trade.highestProfit || '0');
    
    // FALLBACK FIX: If highest_profit is 0 but profit_loss > 0, use profit_loss as proxy
    const effectiveHighestProfit = highestProfit > 0 ? highestProfit : 
      (parseFloat(trade.profit_loss || '0') > 0 ? parseFloat(trade.profit_loss || '0') : 0);
    
    // Calculate time component (0 to 40% of additional score)
    const timeRatio = Math.min(profitablePercentage / 100, 1.0);
    const timeComponent = timeRatio * this.TIME_WEIGHT * this.MAX_ADDITIONAL;
    
    // Calculate profit component (0 to 60% of additional score)
    const profitRatio = Math.min(Math.abs(effectiveHighestProfit) / this.PROFIT_TARGET, 1.0);
    const profitComponent = profitRatio * this.PROFIT_WEIGHT * this.MAX_ADDITIONAL;
    
    // Final weighted score (0.1% to 1.0%)
    const weightedScore = this.BASE_SCORE + timeComponent + profitComponent;
    
    // Generate grade description
    const gradeDescription = this.generateGradeDescription(weightedScore);
    
    return {
      weightedScore,
      timeComponent,
      profitComponent,
      baseScore: this.BASE_SCORE,
      gradeDescription
    };
  }

  /**
   * Generate human-readable grade description
   */
  private static generateGradeDescription(score: number): string {
    const percentage = score * 100; // Convert to percentage
    
    if (percentage >= 0.9) return 'A+ (Excellent)';
    if (percentage >= 0.8) return 'A (Very Good)';
    if (percentage >= 0.7) return 'B+ (Good)';
    if (percentage >= 0.6) return 'B (Above Average)';
    if (percentage >= 0.5) return 'C+ (Average)';
    if (percentage >= 0.4) return 'C (Below Average)';
    if (percentage >= 0.3) return 'D+ (Poor)';
    if (percentage >= 0.2) return 'D (Very Poor)';
    return 'F (Failing)';
  }

  /**
   * Calculate dynamic weighted success rate from recent trades
   * CRITICAL REQUIREMENT: Only consider positive success scores for profit strength measurement
   */
  static calculateDynamicSuccessRate(trades: any[]): {
    dynamicSuccessRate: number;
    totalWeightedScore: number;
    averageTradeScore: number;
    tradeBreakdown: {
      excellentTrades: number;
      goodTrades: number;
      averageTrades: number;
      poorTrades: number;
    };
  } {
    if (trades.length === 0) {
      return {
        dynamicSuccessRate: 0,
        totalWeightedScore: 0,
        averageTradeScore: 0,
        tradeBreakdown: { excellentTrades: 0, goodTrades: 0, averageTrades: 0, poorTrades: 0 }
      };
    }

    let totalWeightedScore = 0;
    let positiveScoreCount = 0; // Count of trades with positive success scores only
    let excellentTrades = 0;
    let goodTrades = 0;
    let averageTrades = 0;
    let poorTrades = 0;

    // Calculate weighted score for each trade combining success scores and time profitable %
    trades.forEach(trade => {
      const scoreResult = this.calculateTradeScore(trade);
      
      // ENHANCED REQUIREMENT: Combine positive success scores with time profitable percentage
      if (scoreResult.weightedScore > 0) {
        // Get profitable time percentage (default to 0 if missing)
        const profitableTimePercent = parseFloat(trade.profitable_percentage || trade.profitablePercentage || "0");
        
        // Weighted combination: 70% success score + 30% time profitable percentage
        const successScoreComponent = scoreResult.weightedScore * 0.7;
        const timeComponent = (profitableTimePercent / 100) * 0.01 * 0.3; // Scale to match score range
        
        const combinedScore = successScoreComponent + timeComponent;
        
        totalWeightedScore += combinedScore;
        positiveScoreCount++;
        
        console.log(`📊 [COMBINED SCORING] ${trade.symbol || 'Trade'}: Success ${(scoreResult.weightedScore * 100).toFixed(1)}% + Time ${profitableTimePercent.toFixed(1)}% = Combined ${(combinedScore * 100).toFixed(1)}%`);
        console.log(`📊 [TRADE DEBUG] ID: ${trade.id}, Outcome: ${trade.actual_outcome || trade.actualOutcome}, ProfitLoss: ${trade.profit_loss}, ProfitablePercentage: ${trade.profitable_percentage}, HighestProfit: ${trade.highest_profit}`);
      }
      
      // Categorize trades by original score (includes all trades for breakdown)
      const percentage = scoreResult.weightedScore * 100;
      if (percentage >= 0.8) excellentTrades++;
      else if (percentage >= 0.6) goodTrades++;
      else if (percentage >= 0.4) averageTrades++;
      else poorTrades++;
    });

    // Calculate dynamic success rate using combined scoring (success scores + time profitable %)
    // Maximum possible combined score based on positive scoring trades only
    const maxPossibleScore = positiveScoreCount * 0.01; // Same max scale
    const dynamicSuccessRate = maxPossibleScore > 0 ? (totalWeightedScore / maxPossibleScore) * 100 : 0;
    
    // Average trade score based on positive scores only (profit strength focus)
    const averageTradeScore = positiveScoreCount > 0 ? totalWeightedScore / positiveScoreCount : 0;

    // Calculate what the rate would be WITHOUT combined scoring (for comparison)
    let totalScoreAllTrades = 0;
    trades.forEach(trade => {
      const scoreResult = this.calculateTradeScore(trade);
      totalScoreAllTrades += scoreResult.weightedScore;
    });
    const maxPossibleScoreAll = trades.length * 0.01;
    const unfilteredRate = maxPossibleScoreAll > 0 ? (totalScoreAllTrades / maxPossibleScoreAll) * 100 : 0;

    console.log(`🎯 [COMBINED SCORING] Profit strength calculation using ALL stored trades (Success Score + Time Profitable %):`);
    console.log(`📊 Total trades analyzed: ${trades.length}`);
    console.log(`📊 Positive scoring trades: ${positiveScoreCount}`);
    console.log(`📊 Negative scoring trades: ${trades.length - positiveScoreCount}`);
    console.log(`📊 WITHOUT filtering (all trades): ${unfilteredRate.toFixed(1)}%`);
    console.log(`📊 WITH combined scoring: ${dynamicSuccessRate.toFixed(1)}%`);
    console.log(`📊 COMBINED BENEFIT: +${(dynamicSuccessRate - unfilteredRate).toFixed(1)}% improvement using success scores + time profitable %`);

    return {
      dynamicSuccessRate: Math.round(dynamicSuccessRate * 10) / 10, // Round to 1 decimal
      totalWeightedScore,
      averageTradeScore,
      tradeBreakdown: {
        excellentTrades,
        goodTrades,
        averageTrades,
        poorTrades
      }
    };
  }

  /**
   * Get detailed scoring breakdown for debugging
   */
  static getDetailedBreakdown(trades: any[]): any[] {
    return trades.map(trade => {
      const scoreResult = this.calculateTradeScore(trade);
      return {
        id: trade.id,
        symbol: trade.symbol,
        profitablePercentage: parseFloat(trade.profitablePercentage || '0'),
        highestProfit: parseFloat(trade.highestProfit || '0'),
        ...scoreResult,
        contributionPercent: (scoreResult.weightedScore * 100).toFixed(3)
      };
    });
  }
}