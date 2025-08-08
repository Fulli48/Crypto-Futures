/**
 * Adaptive Boldness Manager - Controls forecast prediction boldness based on accuracy feedback
 * 
 * System Goals:
 * - Start with moderate boldness (2.5x multiplier)
 * - Increase boldness when accuracy is good (75%+ accuracy)
 * - Decrease boldness when accuracy drops
 * - Target: 75% accuracy 90% of the time through self-tuning
 */

interface BoldnessMetrics {
  globalBoldnessMultiplier: number;
  recentAccuracyPercentage: number;
  consecutiveAccurateForecasts: number;
  consecutiveInaccurateForecasts: number;
  targetAccuracyGoal: number;
  achievedTargetStreak: number;
  convergenceState: 'LEARNING' | 'CONVERGING' | 'CONVERGED';
  totalForecastWindows: number;
  accurateWindows: number;
  overallSuccessRate: number;
}

export class AdaptiveBoldnessManager {
  private metrics: BoldnessMetrics = {
    globalBoldnessMultiplier: 2.5, // Starting boldness
    recentAccuracyPercentage: 60.0,
    consecutiveAccurateForecasts: 0,
    consecutiveInaccurateForecasts: 0,
    targetAccuracyGoal: 75.0,
    achievedTargetStreak: 0,
    convergenceState: 'LEARNING',
    totalForecastWindows: 0,
    accurateWindows: 0,
    overallSuccessRate: 0.0
  };

  private accuracyHistory: number[] = [];
  private boldnessHistory: number[] = [];
  private readonly MAX_HISTORY = 50; // Keep last 50 forecast accuracy results

  /**
   * Get current boldness multiplier for forecasting algorithm
   */
  getCurrentBoldnessMultiplier(): number {
    return this.metrics.globalBoldnessMultiplier;
  }

  /**
   * Get current system metrics
   */
  getMetrics(): BoldnessMetrics {
    return { ...this.metrics };
  }

  /**
   * Update system with new forecast accuracy result
   * NOW WITH MOVEMENT-BASED FILTERING: Only process trades with sufficient price movement
   */
  updateWithAccuracyResult(accuracyPercentage: number, tradeData?: any): void {
    // MOVEMENT-BASED FILTER: Check if trade should be excluded from learning
    if (tradeData) {
      const actualMovement = parseFloat(tradeData.actual_movement_percent?.toString() || '0');
      const excludedFromLearning = tradeData.excluded_from_learning === true;
      const MOVEMENT_THRESHOLD = 0.1; // 0.1% threshold
      
      if (excludedFromLearning || actualMovement < MOVEMENT_THRESHOLD) {
        console.log(`🚫 [MOVEMENT FILTER] Boldness update excluded: movement=${actualMovement.toFixed(4)}% < ${MOVEMENT_THRESHOLD}% threshold`);
        return; // Skip boldness updates for low-movement trades
      }
      
      console.log(`✅ [MOVEMENT FILTER] Boldness update accepted: movement=${actualMovement.toFixed(4)}% ≥ ${MOVEMENT_THRESHOLD}% threshold`);
    }
    
    console.log(`🎯 [ADAPTIVE BOLDNESS] Processing accuracy result: ${accuracyPercentage.toFixed(1)}%`);
    
    // Add to history
    this.accuracyHistory.push(accuracyPercentage);
    if (this.accuracyHistory.length > this.MAX_HISTORY) {
      this.accuracyHistory.shift();
    }

    // Update metrics
    this.metrics.totalForecastWindows++;
    if (accuracyPercentage >= this.metrics.targetAccuracyGoal) {
      this.metrics.accurateWindows++;
      this.metrics.consecutiveAccurateForecasts++;
      this.metrics.consecutiveInaccurateForecasts = 0;
      this.metrics.achievedTargetStreak++;
    } else {
      this.metrics.consecutiveInaccurateForecasts++;
      this.metrics.consecutiveAccurateForecasts = 0;
      this.metrics.achievedTargetStreak = 0;
    }

    // Calculate recent accuracy (last 10 results or all if less)
    const recentResults = this.accuracyHistory.slice(-10);
    this.metrics.recentAccuracyPercentage = recentResults.reduce((sum, acc) => sum + acc, 0) / recentResults.length;

    // Calculate overall success rate
    this.metrics.overallSuccessRate = (this.metrics.accurateWindows / this.metrics.totalForecastWindows) * 100;

    // Adjust boldness based on results
    this.adjustBoldness(accuracyPercentage);

    // Update convergence state
    this.updateConvergenceState();

    console.log(`📊 [ADAPTIVE BOLDNESS] Updated - Boldness: ${this.metrics.globalBoldnessMultiplier.toFixed(2)}x, Recent Accuracy: ${this.metrics.recentAccuracyPercentage.toFixed(1)}%, State: ${this.metrics.convergenceState}`);
  }

  /**
   * Adjust boldness multiplier based on accuracy feedback
   */
  private adjustBoldness(accuracyPercentage: number): void {
    const currentBoldness = this.metrics.globalBoldnessMultiplier;
    let newBoldness = currentBoldness;

    // Core adaptation logic
    if (accuracyPercentage >= 85) {
      // Excellent accuracy - increase boldness significantly
      newBoldness = Math.min(5.0, currentBoldness * 1.15);
      console.log(`🚀 [BOLDNESS] Excellent accuracy (${accuracyPercentage.toFixed(1)}%) - Increasing boldness to ${newBoldness.toFixed(2)}x`);
    } else if (accuracyPercentage >= 75) {
      // Target accuracy achieved - moderate increase
      newBoldness = Math.min(4.0, currentBoldness * 1.08);
      console.log(`📈 [BOLDNESS] Target accuracy reached (${accuracyPercentage.toFixed(1)}%) - Increasing boldness to ${newBoldness.toFixed(2)}x`);
    } else if (accuracyPercentage >= 65) {
      // Good accuracy - small increase
      newBoldness = Math.min(3.5, currentBoldness * 1.03);
      console.log(`✅ [BOLDNESS] Good accuracy (${accuracyPercentage.toFixed(1)}%) - Slight increase to ${newBoldness.toFixed(2)}x`);
    } else if (accuracyPercentage >= 50) {
      // Moderate accuracy - maintain current boldness
      console.log(`➡️ [BOLDNESS] Moderate accuracy (${accuracyPercentage.toFixed(1)}%) - Maintaining boldness at ${currentBoldness.toFixed(2)}x`);
    } else {
      // Poor accuracy - reduce boldness
      newBoldness = Math.max(1.2, currentBoldness * 0.85);
      console.log(`📉 [BOLDNESS] Poor accuracy (${accuracyPercentage.toFixed(1)}%) - Reducing boldness to ${newBoldness.toFixed(2)}x`);
    }

    // Additional logic for consecutive results
    if (this.metrics.consecutiveInaccurateForecasts >= 3) {
      // Multiple consecutive poor results - be more conservative
      newBoldness = Math.max(1.0, newBoldness * 0.9);
      console.log(`⚠️ [BOLDNESS] ${this.metrics.consecutiveInaccurateForecasts} consecutive poor results - Conservative reduction to ${newBoldness.toFixed(2)}x`);
    } else if (this.metrics.consecutiveAccurateForecasts >= 5) {
      // Multiple consecutive good results - be more aggressive
      newBoldness = Math.min(6.0, newBoldness * 1.1);
      console.log(`🎯 [BOLDNESS] ${this.metrics.consecutiveAccurateForecasts} consecutive good results - Aggressive increase to ${newBoldness.toFixed(2)}x`);
    }

    this.metrics.globalBoldnessMultiplier = newBoldness;
    this.boldnessHistory.push(newBoldness);
    if (this.boldnessHistory.length > this.MAX_HISTORY) {
      this.boldnessHistory.shift();
    }
  }

  /**
   * Update convergence state based on performance
   */
  private updateConvergenceState(): void {
    const recentAccuracy = this.metrics.recentAccuracyPercentage;
    const overallSuccess = this.metrics.overallSuccessRate;

    if (this.metrics.totalForecastWindows < 10) {
      this.metrics.convergenceState = 'LEARNING';
    } else if (overallSuccess >= 90 && recentAccuracy >= 75) {
      // 90% of forecasts achieve 75%+ accuracy - converged!
      this.metrics.convergenceState = 'CONVERGED';
      console.log(`🎉 [CONVERGENCE] Target achieved! 90%+ forecasts reach 75%+ accuracy`);
    } else if (overallSuccess >= 70 && recentAccuracy >= 70) {
      // Making good progress toward target
      this.metrics.convergenceState = 'CONVERGING';
    } else {
      this.metrics.convergenceState = 'LEARNING';
    }
  }

  /**
   * Calculate dynamic confidence multiplier based on current state
   */
  getConfidenceMultiplier(): number {
    const baseMultiplier = 1.0;
    
    // Boost confidence when system is performing well
    if (this.metrics.convergenceState === 'CONVERGED') {
      return baseMultiplier * 1.3;
    } else if (this.metrics.convergenceState === 'CONVERGING') {
      return baseMultiplier * 1.15;
    } else if (this.metrics.recentAccuracyPercentage >= 75) {
      return baseMultiplier * 1.1;
    }
    
    // Reduce confidence when struggling
    if (this.metrics.consecutiveInaccurateForecasts >= 3) {
      return baseMultiplier * 0.85;
    }
    
    return baseMultiplier;
  }

  /**
   * Get status summary for logging
   */
  getStatusSummary(): string {
    return `Boldness: ${this.metrics.globalBoldnessMultiplier.toFixed(2)}x | ` +
           `Recent Accuracy: ${this.metrics.recentAccuracyPercentage.toFixed(1)}% | ` +
           `Overall Success: ${this.metrics.overallSuccessRate.toFixed(1)}% | ` +
           `State: ${this.metrics.convergenceState} | ` +
           `Streak: ${this.metrics.achievedTargetStreak} accurate`;
  }

  /**
   * Reset system for fresh learning (if needed)
   */
  reset(): void {
    this.metrics = {
      globalBoldnessMultiplier: 2.5,
      recentAccuracyPercentage: 60.0,
      consecutiveAccurateForecasts: 0,
      consecutiveInaccurateForecasts: 0,
      targetAccuracyGoal: 75.0,
      achievedTargetStreak: 0,
      convergenceState: 'LEARNING',
      totalForecastWindows: 0,
      accurateWindows: 0,
      overallSuccessRate: 0.0
    };
    this.accuracyHistory = [];
    this.boldnessHistory = [];
    console.log(`🔄 [ADAPTIVE BOLDNESS] System reset to initial state`);
  }

  /**
   * Simulate accuracy result for testing
   */
  simulateAccuracyResult(accuracyPercentage: number): void {
    console.log(`🧪 [SIMULATION] Testing with ${accuracyPercentage}% accuracy`);
    this.updateWithAccuracyResult(accuracyPercentage);
  }
}

// Singleton instance
export const adaptiveBoldnessManager = new AdaptiveBoldnessManager();