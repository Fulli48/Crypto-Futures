/**
 * COMPREHENSIVE DATA LEAKAGE PREVENTION UNIT TESTS
 * 
 * Critical unit tests to verify temporal constraints and prevent forward-looking bias.
 * These tests must pass before any ML model training or inference.
 * 
 * TEST CATEGORIES:
 * 1. Temporal Boundary Validation
 * 2. Historical Data Filtering  
 * 3. Training Sample Construction
 * 4. Technical Indicator Safety
 * 5. Inference Data Validation
 * 6. End-to-End ML Pipeline Safety
 */

import { DataLeakagePreventionService } from './data-leakage-prevention';
import { SafeTechnicalIndicators } from './safe-technical-indicators';

export interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  violations?: string[];
}

export class DataLeakageTests {
  
  /**
   * TEST 1: Temporal Boundary Validation
   * Ensures feature end time is strictly before target start time
   */
  static testTemporalBoundaries(): TestResult {
    const testCases = [
      {
        name: 'Valid 2-minute temporal gap',
        inputData: [
          { timestamp: '2025-01-01T10:00:00Z', close: 100 },
          { timestamp: '2025-01-01T10:01:00Z', close: 101 }
        ],
        targetData: [
          { timestamp: '2025-01-01T10:03:00Z', close: 102 },
          { timestamp: '2025-01-01T10:04:00Z', close: 103 }
        ],
        shouldPass: true
      },
      {
        name: 'Invalid temporal overlap (features after targets)',
        inputData: [
          { timestamp: '2025-01-01T10:00:00Z', close: 100 },
          { timestamp: '2025-01-01T10:03:00Z', close: 101 }
        ],
        targetData: [
          { timestamp: '2025-01-01T10:01:00Z', close: 102 },
          { timestamp: '2025-01-01T10:02:00Z', close: 103 }
        ],
        shouldPass: false
      },
      {
        name: 'Edge case: Same timestamp',
        inputData: [
          { timestamp: '2025-01-01T10:00:00Z', close: 100 },
          { timestamp: '2025-01-01T10:02:00Z', close: 101 }
        ],
        targetData: [
          { timestamp: '2025-01-01T10:02:00Z', close: 102 },
          { timestamp: '2025-01-01T10:03:00Z', close: 103 }
        ],
        shouldPass: false
      }
    ];
    
    let passed = true;
    const results: string[] = [];
    const violations: string[] = [];
    
    for (const testCase of testCases) {
      const boundary = DataLeakagePreventionService.validateTemporalBoundaries(
        testCase.inputData,
        testCase.targetData,
        new Date('2025-01-01T10:00:00Z')
      );
      
      const testPassed = boundary.assertionPassed === testCase.shouldPass;
      if (!testPassed) {
        passed = false;
        violations.push(`${testCase.name}: Expected ${testCase.shouldPass}, got ${boundary.assertionPassed}`);
      }
      results.push(`${testPassed ? '✅' : '❌'} ${testCase.name}: ${testPassed ? 'PASSED' : 'FAILED'}`);
    }
    
    return {
      testName: 'Temporal Boundary Validation',
      passed,
      details: results.join('\n'),
      violations: violations.length > 0 ? violations : undefined
    };
  }
  
  /**
   * TEST 2: Historical Data Filtering
   * Validates that future data is properly filtered out
   */
  static testHistoricalDataFiltering(): TestResult {
    const currentTime = new Date('2025-01-01T10:05:00Z');
    const constraint = DataLeakagePreventionService.createFeatureConstraint(currentTime);
    
    const testData = [
      { timestamp: '2025-01-01T09:50:00Z', close: 100 }, // Valid historical
      { timestamp: '2025-01-01T10:00:00Z', close: 101 }, // Valid historical  
      { timestamp: '2025-01-01T10:03:00Z', close: 102 }, // Valid historical
      { timestamp: '2025-01-01T10:06:00Z', close: 103 }, // Invalid future data
      { timestamp: '2025-01-01T10:10:00Z', close: 104 }, // Invalid future data
    ];
    
    const validation = DataLeakagePreventionService.validateHistoricalData(
      testData,
      constraint,
      'rsi'
    );
    
    const futureDataFiltered = validation.validData.every(d => 
      new Date(d.timestamp).getTime() <= constraint.maxTimestamp.getTime()
    );
    
    const correctCount = validation.validData.length === 3; // Should filter out 2 future points
    
    const passed = validation.isValid && futureDataFiltered && correctCount;
    
    return {
      testName: 'Historical Data Filtering',
      passed,
      details: `Valid: ${validation.isValid}, Future filtered: ${futureDataFiltered}, Count correct: ${correctCount} (${validation.validData.length}/3)`,
      violations: !passed ? ['Future data not properly filtered or incorrect count'] : undefined
    };
  }
  
  /**
   * TEST 3: Training Sample Construction Safety
   * Tests the complete training sample construction pipeline
   */
  static testTrainingSampleConstruction(): TestResult {
    // Create synthetic training data with known temporal ordering
    const inputSequence = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(2025, 0, 1, 10, i).toISOString(),
      close: 100 + i,
      rsi: 50 + i,
      macd: 0.1 * i,
      realizedVolatility: 0.01
    }));
    
    const targetPricesRaw = [110, 111, 112]; // Prices after input sequence
    
    const baseTimestamp = new Date(inputSequence[0].timestamp);
    const targetTimestamp = new Date(2025, 0, 1, 10, 15); // 5 minutes after last input
    
    const auditResult = DataLeakagePreventionService.auditTrainingSample({
      inputSequence,
      targetPricesRaw,
      baseTimestamp,
      targetTimestamp
    });
    
    return {
      testName: 'Training Sample Construction Safety',
      passed: auditResult.passed,
      details: `Audit passed: ${auditResult.passed}, Violations: ${auditResult.violations.length}, Recommendations: ${auditResult.recommendations.length}`,
      violations: auditResult.violations.length > 0 ? auditResult.violations : undefined
    };
  }
  
  /**
   * TEST 4: Technical Indicator Safety
   * Tests safe technical indicator calculations
   */
  static testTechnicalIndicatorSafety(): TestResult {
    const currentTime = new Date('2025-01-01T10:05:00Z');
    
    // Create test data with clear temporal boundaries
    const testData = [
      { timestamp: '2025-01-01T09:45:00Z', close: 100, high: 101, low: 99 },
      { timestamp: '2025-01-01T09:46:00Z', close: 102, high: 103, low: 100 },
      { timestamp: '2025-01-01T09:47:00Z', close: 101, high: 104, low: 99 },
      { timestamp: '2025-01-01T09:48:00Z', close: 103, high: 105, low: 101 },
      { timestamp: '2025-01-01T09:49:00Z', close: 104, high: 106, low: 102 },
      // Add more historical data for proper indicator calculation
      ...Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(2025, 0, 1, 9, 50 + i).toISOString(),
        close: 100 + Math.sin(i * 0.1) * 5,
        high: 105 + Math.sin(i * 0.1) * 5,
        low: 95 + Math.sin(i * 0.1) * 5
      })),
      { timestamp: '2025-01-01T10:06:00Z', close: 999, high: 999, low: 999 }, // Future data (should be filtered)
    ];
    
    const indicators = SafeTechnicalIndicators.calculateAllSafeIndicators(testData, currentTime);
    
    const passed = indicators.overallSafe && !indicators.leakageDetected;
    
    return {
      testName: 'Technical Indicator Safety',
      passed,
      details: `Overall safe: ${indicators.overallSafe}, Leakage detected: ${indicators.leakageDetected}`,
      violations: !passed ? ['Technical indicators failed safety check'] : undefined
    };
  }
  
  /**
   * TEST 5: Feature Extraction Safety
   * Tests the complete feature extraction pipeline
   */
  static testFeatureExtractionSafety(): TestResult {
    const currentTime = new Date('2025-01-01T10:05:00Z');
    
    // Create comprehensive test data
    const testData = Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(2025, 0, 1, 9, 35 + i).toISOString(),
      close: 100 + Math.sin(i * 0.2) * 10,
      high: 105 + Math.sin(i * 0.2) * 10,
      low: 95 + Math.sin(i * 0.2) * 10,
      volume: 1000000 + Math.random() * 500000
    }));
    
    // Add future data that should be filtered out
    testData.push({
      timestamp: '2025-01-01T10:06:00Z',
      close: 999,
      high: 999,
      low: 999,
      volume: 999999
    });
    
    const featureResult = SafeTechnicalIndicators.extractSafeFeaturesForML(testData, currentTime);
    
    const passed = featureResult.temporallySafe && featureResult.features !== null;
    
    return {
      testName: 'Feature Extraction Safety',
      passed,
      details: `Temporally safe: ${featureResult.temporallySafe}, Features extracted: ${featureResult.features?.length || 0}`,
      violations: !passed ? ['Feature extraction failed temporal safety'] : undefined
    };
  }
  
  /**
   * TEST 6: Inference Data Validation
   * Tests real-time inference data validation
   */
  static testInferenceDataValidation(): TestResult {
    const predictionTime = new Date('2025-01-01T10:05:00Z');
    
    const marketData = {
      timestamp: '2025-01-01T10:04:30Z', // Valid - before prediction time
      close: 105,
      volume: 1000000
    };
    
    const historicalFeatures = [
      { timestamp: '2025-01-01T10:00:00Z', rsi: 60, macd: 0.5 }, // Valid historical
      { timestamp: '2025-01-01T10:01:00Z', rsi: 62, macd: 0.6 }, // Valid historical
      { timestamp: '2025-01-01T10:04:00Z', rsi: 65, macd: 0.7 }, // Valid historical
      { timestamp: '2025-01-01T10:06:00Z', rsi: 70, macd: 0.8 }, // Invalid future data
    ];
    
    const validation = DataLeakagePreventionService.validateInferenceData(
      marketData,
      historicalFeatures,
      predictionTime
    );
    
    const correctFiltering = validation.safeFeatures.length === 3; // Should remove 1 future feature
    const passed = validation.valid && correctFiltering;
    
    return {
      testName: 'Inference Data Validation',
      passed,
      details: `Valid: ${validation.valid}, Correct filtering: ${correctFiltering} (${validation.safeFeatures.length}/3)`,
      violations: !passed ? validation.issues : undefined
    };
  }
  
  /**
   * MASTER TEST SUITE
   * Runs all data leakage prevention tests
   */
  static runAllTests(): { 
    allPassed: boolean; 
    passedCount: number; 
    totalCount: number; 
    results: TestResult[]; 
    report: string 
  } {
    const tests = [
      this.testTemporalBoundaries(),
      this.testHistoricalDataFiltering(),
      this.testTrainingSampleConstruction(),
      this.testTechnicalIndicatorSafety(),
      this.testFeatureExtractionSafety(),
      this.testInferenceDataValidation()
    ];
    
    const passedCount = tests.filter(test => test.passed).length;
    const totalCount = tests.length;
    const allPassed = passedCount === totalCount;
    
    let report = '🧪 DATA LEAKAGE PREVENTION TEST SUITE RESULTS\n';
    report += '=' .repeat(60) + '\n\n';
    
    tests.forEach((test, index) => {
      report += `${index + 1}. ${test.testName}: ${test.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `   ${test.details}\n`;
      
      if (test.violations && test.violations.length > 0) {
        report += '   VIOLATIONS:\n';
        test.violations.forEach(violation => {
          report += `     - ${violation}\n`;
        });
      }
      report += '\n';
    });
    
    report += '=' .repeat(60) + '\n';
    report += `SUMMARY: ${passedCount}/${totalCount} tests passed\n`;
    
    if (allPassed) {
      report += '🎉 ALL DATA LEAKAGE PREVENTION TESTS PASSED\n';
      report += '✅ ML pipeline is safe for training and inference\n';
    } else {
      report += '🚨 CRITICAL: Some tests failed - ML pipeline NOT SAFE\n';
      report += '❌ Do not proceed with training or inference until all tests pass\n';
    }
    
    return {
      allPassed,
      passedCount,
      totalCount,
      results: tests,
      report
    };
  }
  
  /**
   * CONTINUOUS MONITORING TEST
   * Lightweight test for ongoing monitoring during ML operations
   */
  static quickSafetyCheck(data: any[], currentTimestamp: Date): {
    safe: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check 1: No future timestamps in data
    const futureData = data.filter(d => new Date(d.timestamp).getTime() > currentTimestamp.getTime());
    if (futureData.length > 0) {
      issues.push(`${futureData.length} future data points detected`);
    }
    
    // Check 2: Temporal ordering
    let lastTimestamp = 0;
    for (const point of data) {
      const timestamp = new Date(point.timestamp).getTime();
      if (timestamp < lastTimestamp) {
        issues.push('Data not in temporal order');
        break;
      }
      lastTimestamp = timestamp;
    }
    
    // Check 3: Minimum data requirements
    if (data.length < 14) {
      issues.push('Insufficient historical data for safe indicator calculation');
    }
    
    return {
      safe: issues.length === 0,
      issues
    };
  }
}

/**
 * AUTO-RUN TESTS ON MODULE LOAD
 * Ensures data leakage prevention is working before any ML operations
 */
export function runDataLeakageTestsOnStartup(): boolean {
  console.log('🧪 [STARTUP] Running data leakage prevention tests...');
  
  const testResults = DataLeakageTests.runAllTests();
  
  console.log(testResults.report);
  
  if (!testResults.allPassed) {
    console.error('🚨 [CRITICAL ERROR] Data leakage prevention tests failed!');
    console.error('❌ ML operations are NOT SAFE - fix issues before proceeding');
  }
  
  return testResults.allPassed;
}