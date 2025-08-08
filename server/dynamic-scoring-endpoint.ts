/**
 * DYNAMIC SCORING ENDPOINT TEST
 * Test the new dynamic weighted scoring system
 */

import { DynamicTradeScorer } from './dynamic-trade-scorer';

// Test data - simulating trades with different quality profiles
const testTrades = [
  // Excellent trade: 90% profit time, 2.5% peak profit
  { id: 1, profitablePercentage: '90', highestProfit: '2.5', symbol: 'BTCUSDT' },
  
  // Good trade: 70% profit time, 1.8% peak profit  
  { id: 2, profitablePercentage: '70', highestProfit: '1.8', symbol: 'ETHUSDT' },
  
  // Average trade: 50% profit time, 0.8% peak profit
  { id: 3, profitablePercentage: '50', highestProfit: '0.8', symbol: 'SOLUSDT' },
  
  // Poor trade: 20% profit time, 0.2% peak profit
  { id: 4, profitablePercentage: '20', highestProfit: '0.2', symbol: 'XRPUSDT' },
  
  // Failing trade: 10% profit time, 0.05% peak profit
  { id: 5, profitablePercentage: '10', highestProfit: '0.05', symbol: 'ADAUSDT' }
];

export function testDynamicScoring() {
  console.log('🎯 TESTING DYNAMIC WEIGHTED SCORING SYSTEM');
  console.log('=' .repeat(60));
  
  // Test individual trade scoring
  testTrades.forEach(trade => {
    const result = DynamicTradeScorer.calculateTradeScore(trade);
    console.log(`Trade ${trade.id} (${trade.symbol}):`);
    console.log(`  - Profit Time: ${trade.profitablePercentage}%, Peak: ${trade.highestProfit}%`);
    console.log(`  - Weighted Score: ${(result.weightedScore * 100).toFixed(3)}% contribution`);
    console.log(`  - Grade: ${result.gradeDescription}`);
    console.log(`  - Breakdown: Time: ${(result.timeComponent * 100).toFixed(3)}%, Profit: ${(result.profitComponent * 100).toFixed(3)}%`);
    console.log('');
  });
  
  // Test dynamic success rate calculation
  const dynamicResult = DynamicTradeScorer.calculateDynamicSuccessRate(testTrades);
  console.log('DYNAMIC SUCCESS RATE RESULTS:');
  console.log(`- Dynamic Success Rate: ${dynamicResult.dynamicSuccessRate}%`);
  console.log(`- Total Weighted Score: ${dynamicResult.totalWeightedScore.toFixed(4)}`);
  console.log(`- Average Trade Score: ${(dynamicResult.averageTradeScore * 100).toFixed(3)}%`);
  console.log(`- Trade Breakdown:`);
  console.log(`  * Excellent (≥0.8%): ${dynamicResult.tradeBreakdown.excellentTrades}`);
  console.log(`  * Good (≥0.6%): ${dynamicResult.tradeBreakdown.goodTrades}`);
  console.log(`  * Average (≥0.4%): ${dynamicResult.tradeBreakdown.averageTrades}`);
  console.log(`  * Poor (<0.4%): ${dynamicResult.tradeBreakdown.poorTrades}`);
  
  // Test detailed breakdown
  console.log('\nDETAILED BREAKDOWN:');
  const breakdown = DynamicTradeScorer.getDetailedBreakdown(testTrades);
  breakdown.forEach(trade => {
    console.log(`${trade.symbol}: ${trade.contributionPercent}% - ${trade.gradeDescription}`);
  });
  
  console.log('=' .repeat(60));
}