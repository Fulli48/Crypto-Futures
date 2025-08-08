/**
 * TRADE SUCCESS SCORING SYSTEM
 * 
 * A sophisticated hybrid confidence algorithm that evaluates the success likelihood 
 * of simulated crypto trades based on 4 key factors:
 * 1. Time-in-Profit Ratio (40% weight)
 * 2. Weighted Profit Score (30% weight) 
 * 3. Cluster Consistency Score (20% weight)
 * 4. Binary Success Flag (10% weight)
 */

interface TradeSuccessResult {
  finalScore: number;
  timeInProfitRatio: number;
  weightedProfitScore: number;
  clusterScore: number;
  binarySuccessFlag: number;
  breakdown: {
    profitableSeconds: number;
    totalSeconds: number;
    maxProfit: number;
    numClusters: number;
    longestCluster: number;
    hadSustainedProfit: boolean;
  };
}

/**
 * Calculates trade success odds using a hybrid confidence algorithm
 * @param entryPrice - The price at which the trade started
 * @param positionType - Either "LONG" or "SHORT" 
 * @param priceSeries - List of prices recorded at consistent intervals
 * @param profitThreshold - Minimum required profit to consider profitable (default: 0.0)
 * @returns TradeSuccessResult with final score and component breakdowns
 */
export function calculateTradeSuccessOdds(
  entryPrice: number,
  positionType: 'LONG' | 'SHORT',
  priceSeries: number[],
  profitThreshold: number = 0.0
): TradeSuccessResult {
  
  const totalSeconds = priceSeries.length;
  if (totalSeconds === 0) {
    return createEmptyResult();
  }

  // Calculate profit values for each timestamp
  const profitValues: number[] = [];
  const isProfitableAtTime: boolean[] = [];
  
  for (const price of priceSeries) {
    let profit: number;
    
    if (positionType === 'LONG') {
      profit = price - entryPrice;
    } else {
      profit = entryPrice - price;
    }
    
    const isProfitable = profit > profitThreshold;
    profitValues.push(Math.max(0, profit));
    isProfitableAtTime.push(isProfitable);
  }

  // 1. TIME-IN-PROFIT RATIO (Weight = 0.4)
  const profitableSeconds = isProfitableAtTime.filter(Boolean).length;
  const timeInProfitRatio = profitableSeconds / totalSeconds;

  // 2. WEIGHTED PROFIT SCORE (Weight = 0.3)
  const maxProfitSeen = Math.max(...profitValues, 0.001); // Avoid division by zero
  const weightedProfitScore = Math.min(1.0, 
    profitValues.reduce((sum, profit) => sum + profit, 0) / (totalSeconds * maxProfitSeen)
  );

  // 3. CLUSTER CONSISTENCY SCORE (Weight = 0.2)
  const clusters = findProfitableClusters(isProfitableAtTime);
  const numClusters = clusters.length;
  const longestCluster = clusters.length > 0 ? Math.max(...clusters.map(c => c.length)) : 0;
  
  const clusterScore = Math.min(1.0,
    (numClusters / (totalSeconds / 10)) * 0.5 + 
    (longestCluster / totalSeconds) * 0.5
  );

  // 4. BINARY SUCCESS FLAG (Weight = 0.1)
  const hadSustainedProfit = longestCluster >= 30;
  const binarySuccessFlag = hadSustainedProfit ? 1.0 : 0.0;

  // FINAL SCORE CALCULATION
  const finalScore = 
    0.4 * timeInProfitRatio +
    0.3 * weightedProfitScore +
    0.2 * clusterScore +
    0.1 * binarySuccessFlag;

  return {
    finalScore: Math.round(finalScore * 10000) / 10000, // Round to 4 decimal places
    timeInProfitRatio: Math.round(timeInProfitRatio * 10000) / 10000,
    weightedProfitScore: Math.round(weightedProfitScore * 10000) / 10000,
    clusterScore: Math.round(clusterScore * 10000) / 10000,
    binarySuccessFlag,
    breakdown: {
      profitableSeconds,
      totalSeconds,
      maxProfit: Math.round(maxProfitSeen * 10000) / 10000,
      numClusters,
      longestCluster,
      hadSustainedProfit
    }
  };
}

/**
 * Finds consecutive sequences of profitable moments ("clusters")
 */
function findProfitableClusters(isProfitableAtTime: boolean[]): number[][] {
  const clusters: number[][] = [];
  let currentCluster: number[] = [];
  
  for (let i = 0; i < isProfitableAtTime.length; i++) {
    if (isProfitableAtTime[i]) {
      currentCluster.push(i);
    } else {
      if (currentCluster.length > 0) {
        clusters.push([...currentCluster]);
        currentCluster = [];
      }
    }
  }
  
  // Don't forget the last cluster if it ends profitable
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }
  
  return clusters;
}

/**
 * Creates an empty result for edge cases
 */
function createEmptyResult(): TradeSuccessResult {
  return {
    finalScore: 0,
    timeInProfitRatio: 0,
    weightedProfitScore: 0,
    clusterScore: 0,
    binarySuccessFlag: 0,
    breakdown: {
      profitableSeconds: 0,
      totalSeconds: 0,
      maxProfit: 0,
      numClusters: 0,
      longestCluster: 0,
      hadSustainedProfit: false
    }
  };
}

/**
 * Utility function to generate example usage
 */
export function exampleUsage() {
  // Example: LONG trade that started at $100 and had mixed performance
  const entryPrice = 100.0;
  const positionType = 'LONG';
  const priceSeries = [
    100.0, 100.5, 101.0, 100.8, 100.2, 99.5, 99.0, 100.5, 101.2, 101.8,
    102.0, 101.5, 101.0, 101.8, 102.5, 102.8, 102.2, 101.9, 102.1, 102.0
  ];
  
  const result = calculateTradeSuccessOdds(entryPrice, positionType, priceSeries, 0.5);
  
  console.log('📊 Trade Success Analysis:');
  console.log(`Final Score: ${result.finalScore} (0.0-1.0)`);
  console.log(`Time in Profit: ${(result.timeInProfitRatio * 100).toFixed(1)}%`);
  console.log(`Weighted Profit: ${result.weightedProfitScore.toFixed(4)}`);
  console.log(`Cluster Consistency: ${result.clusterScore.toFixed(4)}`);
  console.log(`Sustained Profit (30s+): ${result.binarySuccessFlag ? 'Yes' : 'No'}`);
  console.log(`Clusters Found: ${result.breakdown.numClusters}`);
  console.log(`Longest Profitable Streak: ${result.breakdown.longestCluster} seconds`);
  
  return result;
}