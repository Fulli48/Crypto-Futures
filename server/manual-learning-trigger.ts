/**
 * Manual learning system trigger to force immediate learning demonstration
 */

import { AdaptiveBoldnessManager } from './adaptive-boldness-manager';

export async function triggerLearningDemo() {
  console.log('🚀 [MANUAL LEARNING] Triggering immediate learning demonstration...');
  
  const adaptiveBoldness = new AdaptiveBoldnessManager();
  
  // Simulate a series of poor accuracy results to show learning response
  const poorResults = [25, 15, 35, 20, 40]; // Poor accuracy percentages
  
  console.log('📉 [MANUAL LEARNING] Feeding poor accuracy results to trigger learning response...');
  
  for (const accuracy of poorResults) {
    console.log(`📊 [MANUAL LEARNING] Processing ${accuracy}% accuracy result`);
    adaptiveBoldness.updateWithAccuracyResult(accuracy);
    
    const metrics = adaptiveBoldness.getMetrics();
    console.log(`🧠 [LEARNING STATE] Boldness: ${metrics.globalBoldnessMultiplier.toFixed(3)}, Recent Accuracy: ${metrics.recentAccuracyPercentage.toFixed(1)}%, Overall Success: ${metrics.overallSuccessRate.toFixed(1)}%`);
  }
  
  // Now feed good results to show system learning to improve
  const goodResults = [85, 90, 88, 92, 87]; // Good accuracy percentages
  
  console.log('📈 [MANUAL LEARNING] Feeding good accuracy results to show learning improvement...');
  
  for (const accuracy of goodResults) {
    console.log(`📊 [MANUAL LEARNING] Processing ${accuracy}% accuracy result`);
    adaptiveBoldness.updateWithAccuracyResult(accuracy);
    
    const metrics = adaptiveBoldness.getMetrics();
    console.log(`🧠 [LEARNING STATE] Boldness: ${metrics.globalBoldnessMultiplier.toFixed(3)}, Recent Accuracy: ${metrics.recentAccuracyPercentage.toFixed(1)}%, Overall Success: ${metrics.overallSuccessRate.toFixed(1)}%`);
  }
  
  const finalMetrics = adaptiveBoldness.getMetrics();
  console.log('🎯 [MANUAL LEARNING] Final learning demonstration results:', {
    boldnessMultiplier: finalMetrics.globalBoldnessMultiplier,
    recentAccuracy: finalMetrics.recentAccuracyPercentage,
    overallSuccessRate: finalMetrics.overallSuccessRate,
    convergenceState: finalMetrics.convergenceState
  });
  
  console.log('✅ [MANUAL LEARNING] Learning demonstration complete - system should show clear learning patterns');
}

// Auto-execute to demonstrate learning
setTimeout(() => {
  triggerLearningDemo().catch(console.error);
}, 5000); // Wait 5 seconds for system to initialize