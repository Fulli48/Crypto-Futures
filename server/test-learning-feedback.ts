/**
 * Test script to create sample forecast data and trigger learning feedback
 * This will demonstrate the learning system actually improving
 */

import { db } from './db';
import { forecastPerformance } from '@shared/schema';
import type { InsertForecastPerformance } from '@shared/schema';
import { ForecastPerformanceTracker } from './forecast-performance-tracker';
import { AdaptiveBoldnessManager } from './adaptive-boldness-manager';

export async function createTestLearningData() {
  console.log('🧪 [TEST LEARNING] Creating sample forecast data to trigger learning feedback...');
  
  const adaptiveBoldness = new AdaptiveBoldnessManager();
  
  // Create a mix of good and poor forecasts to test learning
  const testForecasts = [
    // Poor forecasts (should reduce confidence)
    { symbol: 'BTCUSDT', forecastChange: 5.0, actualChange: 0.2, confidence: 75 }, // Terrible forecast
    { symbol: 'ETHUSDT', forecastChange: -3.0, actualChange: 0.8, confidence: 80 }, // Wrong direction
    { symbol: 'SOLUSDT', forecastChange: 2.0, actualChange: -1.5, confidence: 70 }, // Wrong direction
    
    // Good forecasts (should increase confidence)
    { symbol: 'XRPUSDT', forecastChange: 1.2, actualChange: 1.1, confidence: 65 }, // Very accurate
    { symbol: 'ADAUSDT', forecastChange: -0.8, actualChange: -0.9, confidence: 60 }, // Good direction and magnitude
    { symbol: 'HBARUSDT', forecastChange: 0.5, actualChange: 0.6, confidence: 55 }, // Close prediction
  ];
  
  console.log('📊 [TEST LEARNING] Processing accuracy results to trigger learning...');
  
  // Process each forecast to trigger learning
  for (const forecast of testForecasts) {
    // Calculate accuracy score
    const forecastError = Math.abs(forecast.actualChange - forecast.forecastChange);
    const accuracyScore = Math.max(0, 100 - (forecastError * 10)); // 1% error = 10 point deduction
    
    console.log(`📈 [TEST FORECAST] ${forecast.symbol}: Predicted ${forecast.forecastChange.toFixed(1)}%, Actual ${forecast.actualChange.toFixed(1)}%, Accuracy: ${accuracyScore.toFixed(1)}%`);
    
    // Feed to learning system
    adaptiveBoldness.updateWithAccuracyResult(accuracyScore);
    
    // Log current learning state
    const status = adaptiveBoldness.getStatusSummary();
    console.log(`🧠 [LEARNING UPDATE] ${status}`);
  }
  
  // Show final learning state
  const finalMetrics = adaptiveBoldness.getMetrics();
  console.log('🎯 [FINAL LEARNING STATE]', {
    boldnessMultiplier: finalMetrics.globalBoldnessMultiplier,
    recentAccuracy: finalMetrics.recentAccuracyPercentage,
    overallSuccessRate: finalMetrics.overallSuccessRate,
    convergenceState: finalMetrics.convergenceState,
    consecutiveAccurate: finalMetrics.consecutiveAccurateForecasts,
    consecutiveInaccurate: finalMetrics.consecutiveInaccurateForecasts
  });
  
  console.log('✅ [TEST LEARNING] Learning feedback test completed - system should now show actual improvement patterns');
  
  return finalMetrics;
}

// Auto-run the test to immediately trigger learning
setTimeout(() => {
  createTestLearningData().catch(console.error);
}, 2000); // Wait 2 seconds for system to initialize