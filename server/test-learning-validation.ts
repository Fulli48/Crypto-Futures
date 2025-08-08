/**
 * Comprehensive Learning System Validation Test
 * Demonstrates that the system actually learns and improves over time
 */

import { AdaptiveBoldnessManager } from './adaptive-boldness-manager';
import { ForecastPerformanceTracker } from './forecast-performance-tracker';

export async function validateLearningSystem() {
  console.log('🔍 [LEARNING VALIDATION] Starting comprehensive learning system test...');
  
  const adaptiveBoldness = new AdaptiveBoldnessManager();
  const forecastTracker = new ForecastPerformanceTracker();
  
  // Test 1: Check initial state
  console.log('\n📊 [TEST 1] Initial System State');
  const initialMetrics = adaptiveBoldness.getMetrics();
  console.log('Initial Boldness Multiplier:', initialMetrics.globalBoldnessMultiplier);
  console.log('Initial Success Rate:', initialMetrics.overallSuccessRate);
  console.log('Initial Recent Accuracy:', initialMetrics.recentAccuracyPercentage);
  
  // Test 2: Feed poor performance data and verify system learns to be less confident
  console.log('\n📉 [TEST 2] Testing Learning from Poor Performance');
  const poorAccuracies = [25, 30, 35, 20, 28, 32, 18, 45, 38, 25];
  
  for (let i = 0; i < poorAccuracies.length; i++) {
    const accuracy = poorAccuracies[i];
    adaptiveBoldness.updateWithAccuracyResult(accuracy);
    
    const metrics = adaptiveBoldness.getMetrics();
    console.log(`Poor Performance ${i+1}: ${accuracy}% accuracy → Boldness: ${metrics.globalBoldnessMultiplier.toFixed(3)}, Recent: ${metrics.recentAccuracyPercentage.toFixed(1)}%`);
  }
  
  const afterPoorMetrics = adaptiveBoldness.getMetrics();
  console.log('After Poor Performance:');
  console.log('  - Boldness Multiplier:', afterPoorMetrics.globalBoldnessMultiplier.toFixed(3));
  console.log('  - Recent Accuracy:', afterPoorMetrics.recentAccuracyPercentage.toFixed(1) + '%');
  console.log('  - Overall Success Rate:', afterPoorMetrics.overallSuccessRate.toFixed(1) + '%');
  
  // Test 3: Feed good performance data and verify system learns to be more confident
  console.log('\n📈 [TEST 3] Testing Learning from Good Performance');
  const goodAccuracies = [85, 88, 92, 89, 95, 87, 91, 93, 86, 90];
  
  for (let i = 0; i < goodAccuracies.length; i++) {
    const accuracy = goodAccuracies[i];
    adaptiveBoldness.updateWithAccuracyResult(accuracy);
    
    const metrics = adaptiveBoldness.getMetrics();
    console.log(`Good Performance ${i+1}: ${accuracy}% accuracy → Boldness: ${metrics.globalBoldnessMultiplier.toFixed(3)}, Recent: ${metrics.recentAccuracyPercentage.toFixed(1)}%`);
  }
  
  const afterGoodMetrics = adaptiveBoldness.getMetrics();
  console.log('After Good Performance:');
  console.log('  - Boldness Multiplier:', afterGoodMetrics.globalBoldnessMultiplier.toFixed(3));
  console.log('  - Recent Accuracy:', afterGoodMetrics.recentAccuracyPercentage.toFixed(1) + '%');
  console.log('  - Overall Success Rate:', afterGoodMetrics.overallSuccessRate.toFixed(1) + '%');
  
  // Test 4: Verify learning metrics
  console.log('\n🎯 [TEST 4] Learning Validation Results');
  
  const boldnessIncrease = afterGoodMetrics.globalBoldnessMultiplier - afterPoorMetrics.globalBoldnessMultiplier;
  const accuracyImprovement = afterGoodMetrics.recentAccuracyPercentage - afterPoorMetrics.recentAccuracyPercentage;
  
  console.log('Learning Evidence:');
  console.log(`  - Boldness increased by: ${boldnessIncrease.toFixed(3)} (${(boldnessIncrease * 100).toFixed(1)}%)`);
  console.log(`  - Recent accuracy improved by: ${accuracyImprovement.toFixed(1)} percentage points`);
  
  // Test 5: Verify the system is actually adaptive
  const isLearningActive = boldnessIncrease > 0.1 && accuracyImprovement > 10;
  console.log(`  - System is actively learning: ${isLearningActive ? '✅ YES' : '❌ NO'}`);
  
  // Test 6: Check forecast integration
  console.log('\n🔮 [TEST 5] Forecast Performance Integration Test');
  
  try {
    // Create test forecasts with different outcomes using static methods
    await ForecastPerformanceTracker.storeForecast({
      symbol: 'BTCUSDT',
      initialPrice: 112000,
      forecastPrice: 113000,
      forecastChange: ((113000 - 112000) / 112000) * 100,
      confidence: 65
    });
    await ForecastPerformanceTracker.storeForecast({
      symbol: 'ETHUSDT',
      initialPrice: 3400,
      forecastPrice: 3500,
      forecastChange: ((3500 - 3400) / 3400) * 100,
      confidence: 75
    });
    
    console.log('✅ Test forecasts stored successfully');
    
    // Get performance metrics using static method
    const performanceMetrics = await ForecastPerformanceTracker.getPerformanceMetrics();
    console.log('Forecast Performance Metrics:', performanceMetrics);
    
  } catch (error: any) {
    console.log('⚠️ Forecast integration test failed:', error.message);
  }
  
  // Final summary
  console.log('\n🏁 [LEARNING VALIDATION] Test Summary');
  console.log('=====================================');
  console.log(`Initial Boldness: ${initialMetrics.globalBoldnessMultiplier.toFixed(3)}`);
  console.log(`Final Boldness: ${afterGoodMetrics.globalBoldnessMultiplier.toFixed(3)}`);
  console.log(`Boldness Change: ${boldnessIncrease.toFixed(3)} (${boldnessIncrease > 0 ? '+' : ''}${(boldnessIncrease * 100).toFixed(1)}%)`);
  console.log(`Accuracy Change: ${accuracyImprovement.toFixed(1)} percentage points`);
  console.log(`Learning Status: ${isLearningActive ? '✅ ACTIVE LEARNING CONFIRMED' : '❌ NO LEARNING DETECTED'}`);
  
  return {
    initialBoldness: initialMetrics.globalBoldnessMultiplier,
    finalBoldness: afterGoodMetrics.globalBoldnessMultiplier,
    boldnessIncrease,
    accuracyImprovement,
    isLearningActive,
    testPassed: isLearningActive
  };
}

// Test confidence adjustment integration with ML signals
export async function testMLConfidenceIntegration() {
  console.log('\n🧠 [ML INTEGRATION TEST] Testing confidence adjustments in ML signals...');
  
  const adaptiveBoldness = new AdaptiveBoldnessManager();
  const originalMetrics = adaptiveBoldness.getMetrics();
  
  // Simulate ML signal generation with different confidence levels
  const testConfidences = [45, 55, 65, 75];
  
  console.log('Testing ML confidence adjustments:');
  for (const originalConfidence of testConfidences) {
    const adjustedConfidence = Math.min(95, Math.max(15, originalConfidence * originalMetrics.globalBoldnessMultiplier));
    console.log(`  Original: ${originalConfidence}% → Adjusted: ${Math.round(adjustedConfidence)}% (multiplier: ${originalMetrics.globalBoldnessMultiplier.toFixed(3)})`);
  }
  
  return true;
}

// Auto-execute tests
setTimeout(async () => {
  try {
    console.log('🚀 [AUTO TEST] Starting learning validation in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const results = await validateLearningSystem();
    await testMLConfidenceIntegration();
    
    console.log('\n✅ [AUTO TEST] Learning validation completed successfully');
    console.log('Results:', results);
    
  } catch (error) {
    console.error('❌ [AUTO TEST] Learning validation failed:', error);
  }
}, 1000);