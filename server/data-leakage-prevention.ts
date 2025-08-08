/**
 * DATA LEAKAGE PREVENTION SERVICE
 * 
 * Critical safeguards to prevent forward-looking bias in ML training and inference.
 * Implements strict temporal constraints ensuring no future information leaks into predictions.
 * 
 * KEY PRINCIPLES:
 * 1. TEMPORAL ISOLATION: Feature extraction uses ONLY historical data up to time t0
 * 2. TARGET SEPARATION: Prediction targets start strictly at t0+1 or later
 * 3. ROLLING WINDOWS: All indicator calculations respect historical boundaries
 * 4. ASSERTION GUARDS: Runtime checks prevent accidental leakage
 * 5. UNIT TESTING: Automated tests verify temporal constraints
 */

export interface TemporalBoundary {
  featureEndTime: Date;    // Latest timestamp allowed for feature extraction
  targetStartTime: Date;   // Earliest timestamp for prediction targets
  assertionPassed: boolean; // Whether temporal constraint is satisfied
}

export interface FeatureExtractionConstraint {
  maxTimestamp: Date;      // Hard boundary for feature data
  windowSize: number;      // Historical window size in minutes
  indicatorPeriods: {      // Maximum lookback periods for each indicator
    rsi: number;
    macd: number;
    bollinger: number;
    stochastic: number;
    volatility: number;
  };
}

export class DataLeakagePreventionService {
  
  /**
   * CRITICAL: Validate temporal boundaries for training sample construction
   * Ensures no forward-looking bias in feature extraction
   */
  static validateTemporalBoundaries(
    inputData: any[], 
    targetData: any[], 
    sampleTimestamp: Date
  ): TemporalBoundary {
    
    // Extract timestamps
    const inputTimestamps = inputData.map(d => new Date(d.timestamp));
    const targetTimestamps = targetData.map(d => new Date(d.timestamp));
    
    // Calculate boundaries
    const featureEndTime = new Date(Math.max(...inputTimestamps.map(t => t.getTime())));
    const targetStartTime = new Date(Math.min(...targetTimestamps.map(t => t.getTime())));
    
    // CRITICAL ASSERTION: Features must end BEFORE targets begin
    const assertionPassed = featureEndTime.getTime() < targetStartTime.getTime();
    
    if (!assertionPassed) {
      console.error('🚨 [DATA LEAKAGE ALERT] Temporal boundary violation detected!');
      console.error(`📊 Feature end time: ${featureEndTime.toISOString()}`);
      console.error(`🎯 Target start time: ${targetStartTime.toISOString()}`);
      console.error(`⚠️ Gap required: ${targetStartTime.getTime() - featureEndTime.getTime()}ms`);
    }
    
    return {
      featureEndTime,
      targetStartTime,  
      assertionPassed
    };
  }
  
  /**
   * Create feature extraction constraint for given timestamp
   * Defines hard boundaries for historical data usage
   */
  static createFeatureConstraint(currentTimestamp: Date, windowMinutes: number = 120): FeatureExtractionConstraint {
    const maxTimestamp = new Date(currentTimestamp.getTime() - 60000); // 1 minute gap minimum
    
    return {
      maxTimestamp,
      windowSize: windowMinutes,
      indicatorPeriods: {
        rsi: 14,        // 14-period RSI
        macd: 26,       // 26-period slow EMA (longest MACD component)
        bollinger: 20,  // 20-period Bollinger Bands
        stochastic: 14, // 14-period Stochastic
        volatility: 20  // 20-period volatility calculation
      }
    };
  }
  
  /**
   * CRITICAL: Validate historical data for indicator calculation
   * Ensures all technical indicators use only past data
   */
  static validateHistoricalData(
    data: any[], 
    constraint: FeatureExtractionConstraint,
    indicatorType: keyof FeatureExtractionConstraint['indicatorPeriods']
  ): { isValid: boolean; validData: any[]; violation?: string } {
    
    // Filter data to respect temporal boundary
    const validData = data.filter(d => {
      const timestamp = new Date(d.timestamp);
      return timestamp.getTime() <= constraint.maxTimestamp.getTime();
    });
    
    // Check minimum data requirements for indicator
    const requiredPeriods = constraint.indicatorPeriods[indicatorType];
    const hasEnoughData = validData.length >= requiredPeriods;
    
    if (!hasEnoughData) {
      return {
        isValid: false,
        validData: [],
        violation: `Insufficient historical data for ${indicatorType}: need ${requiredPeriods}, have ${validData.length}`
      };
    }
    
    // Verify no future timestamps leaked through
    const futureDataExists = data.some(d => {
      const timestamp = new Date(d.timestamp);
      return timestamp.getTime() > constraint.maxTimestamp.getTime();
    });
    
    if (futureDataExists) {
      console.warn(`⚠️ [DATA LEAKAGE WARNING] Future data detected in ${indicatorType} calculation - filtered out`);
    }
    
    return {
      isValid: true,
      validData: validData.slice(-requiredPeriods), // Use only required lookback window
      violation: undefined
    };
  }
  
  /**
   * SAFE TECHNICAL INDICATOR WRAPPER
   * Ensures all indicator calculations respect temporal boundaries
   */
  static safeCalculateIndicator<T>(
    data: any[],
    currentTimestamp: Date,
    indicatorType: keyof FeatureExtractionConstraint['indicatorPeriods'],
    calculationFunction: (validData: any[]) => T
  ): { result: T | null; leakageDetected: boolean; errorMessage?: string } {
    
    try {
      // Create temporal constraint
      const constraint = this.createFeatureConstraint(currentTimestamp);
      
      // Validate historical data
      const validation = this.validateHistoricalData(data, constraint, indicatorType);
      
      if (!validation.isValid) {
        return {
          result: null,
          leakageDetected: false,
          errorMessage: validation.violation
        };
      }
      
      // CRITICAL: Double-check no future data in validated set
      const maxDataTimestamp = Math.max(...validation.validData.map(d => new Date(d.timestamp).getTime()));
      const leakageDetected = maxDataTimestamp > constraint.maxTimestamp.getTime();
      
      if (leakageDetected) {
        console.error(`🚨 [CRITICAL LEAKAGE] Future data detected in ${indicatorType} calculation!`);
        console.error(`📊 Max data timestamp: ${new Date(maxDataTimestamp).toISOString()}`);
        console.error(`⛔ Boundary timestamp: ${constraint.maxTimestamp.toISOString()}`);
        
        return {
          result: null,
          leakageDetected: true,
          errorMessage: 'Data leakage detected - calculation aborted'
        };
      }
      
      // Safe to calculate with validated historical data
      const result = calculationFunction(validation.validData);
      
      return {
        result,
        leakageDetected: false
      };
      
    } catch (error) {
      return {
        result: null,
        leakageDetected: false,
        errorMessage: `Calculation error: ${error}`
      };
    }
  }
  
  /**
   * TRAINING SAMPLE AUDIT
   * Comprehensive validation of ML training samples for temporal consistency
   */
  static auditTrainingSample(sample: {
    inputSequence: any[];
    targetPricesRaw: number[];
    baseTimestamp: Date;
    targetTimestamp: Date;
  }): {
    passed: boolean;
    violations: string[];
    recommendations: string[];
  } {
    
    const violations: string[] = [];
    const recommendations: string[] = [];
    
    // 1. Check temporal gap between features and targets
    const temporalGap = sample.targetTimestamp.getTime() - sample.baseTimestamp.getTime();
    const minRequiredGap = 60000; // 1 minute minimum
    
    if (temporalGap < minRequiredGap) {
      violations.push(`Insufficient temporal gap: ${temporalGap}ms < ${minRequiredGap}ms required`);
    }
    
    // 2. Verify input sequence temporal ordering
    let previousTimestamp = 0;
    for (let i = 0; i < sample.inputSequence.length; i++) {
      const currentTimestamp = new Date(sample.inputSequence[i].timestamp).getTime();
      
      if (currentTimestamp <= previousTimestamp) {
        violations.push(`Input sequence temporal ordering violation at index ${i}`);
      }
      
      // Check no input data exceeds feature boundary
      if (currentTimestamp >= sample.targetTimestamp.getTime()) {
        violations.push(`Input data leaks into target window at index ${i}`);
      }
      
      previousTimestamp = currentTimestamp;
    }
    
    // 3. Verify target prices temporal consistency
    if (sample.targetPricesRaw.length === 0) {
      violations.push('No target prices provided');
    }
    
    // 4. Check for realistic price movements (detect synthetic data)
    if (sample.inputSequence.length > 1) {
      const priceChanges = [];
      for (let i = 1; i < sample.inputSequence.length; i++) {
        const prevPrice = sample.inputSequence[i-1].close;
        const currPrice = sample.inputSequence[i].close;
        
        if (prevPrice > 0 && currPrice > 0) {
          const change = Math.abs((currPrice - prevPrice) / prevPrice);
          priceChanges.push(change);
        }
      }
      
      // Flag unrealistic price movements (>50% per minute)
      const suspiciousChanges = priceChanges.filter(change => change > 0.5);
      if (suspiciousChanges.length > 0) {
        recommendations.push(`${suspiciousChanges.length} suspicious price movements detected - verify data authenticity`);
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      recommendations
    };
  }
  
  /**
   * INFERENCE DATA VALIDATION
   * Ensures real-time prediction requests don't contain future information
   */
  static validateInferenceData(
    marketData: any,
    historicalFeatures: any[],
    predictionTimestamp: Date
  ): { valid: boolean; issues: string[]; safeFeatures: any[] } {
    
    const issues: string[] = [];
    
    // 1. Check market data timestamp doesn't exceed prediction boundary
    if (marketData.timestamp) {
      const dataTimestamp = new Date(marketData.timestamp);
      if (dataTimestamp.getTime() > predictionTimestamp.getTime()) {
        issues.push('Market data timestamp exceeds prediction boundary');
      }
    }
    
    // 2. Validate historical features temporal ordering
    const safeFeatures = historicalFeatures.filter(feature => {
      const featureTimestamp = new Date(feature.timestamp);
      return featureTimestamp.getTime() < predictionTimestamp.getTime();
    });
    
    if (safeFeatures.length < historicalFeatures.length) {
      issues.push(`Filtered out ${historicalFeatures.length - safeFeatures.length} future features`);
    }
    
    // 3. Ensure minimum historical context
    if (safeFeatures.length < 14) { // Minimum for RSI calculation
      issues.push('Insufficient historical context for reliable prediction');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      safeFeatures
    };
  }
}

/**
 * UNIT TESTS FOR DATA LEAKAGE PREVENTION
 * Critical tests to verify temporal constraints are maintained
 */
export class DataLeakageTests {
  
  /**
   * Test temporal boundary validation
   */
  static testTemporalBoundaries(): { passed: boolean; details: string } {
    const testCases = [
      {
        name: 'Valid temporal separation',
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
        name: 'Invalid temporal overlap',
        inputData: [
          { timestamp: '2025-01-01T10:00:00Z', close: 100 },
          { timestamp: '2025-01-01T10:02:00Z', close: 101 }
        ],
        targetData: [
          { timestamp: '2025-01-01T10:01:00Z', close: 102 },
          { timestamp: '2025-01-01T10:03:00Z', close: 103 }
        ],
        shouldPass: false
      }
    ];
    
    let passed = true;
    const results: string[] = [];
    
    for (const testCase of testCases) {
      const boundary = DataLeakagePreventionService.validateTemporalBoundaries(
        testCase.inputData,
        testCase.targetData,
        new Date('2025-01-01T10:00:00Z')
      );
      
      const testPassed = boundary.assertionPassed === testCase.shouldPass;
      if (!testPassed) {
        passed = false;
        results.push(`❌ ${testCase.name}: Expected ${testCase.shouldPass}, got ${boundary.assertionPassed}`);
      } else {
        results.push(`✅ ${testCase.name}: Passed`);
      }
    }
    
    return {
      passed,
      details: results.join('\n')
    };
  }
  
  /**
   * Test historical data validation
   */
  static testHistoricalDataValidation(): { passed: boolean; details: string } {
    const currentTime = new Date('2025-01-01T10:05:00Z');
    const constraint = DataLeakagePreventionService.createFeatureConstraint(currentTime);
    
    const testData = [
      { timestamp: '2025-01-01T09:50:00Z', close: 100 }, // Valid historical
      { timestamp: '2025-01-01T10:00:00Z', close: 101 }, // Valid historical  
      { timestamp: '2025-01-01T10:04:00Z', close: 102 }, // Valid historical
      { timestamp: '2025-01-01T10:06:00Z', close: 103 }, // Invalid future data
    ];
    
    const validation = DataLeakagePreventionService.validateHistoricalData(
      testData,
      constraint,
      'rsi'
    );
    
    const futureDataFiltered = validation.validData.every(d => 
      new Date(d.timestamp).getTime() <= constraint.maxTimestamp.getTime()
    );
    
    return {
      passed: validation.isValid && futureDataFiltered,
      details: `Validation: ${validation.isValid}, Future data filtered: ${futureDataFiltered}, Valid data count: ${validation.validData.length}`
    };
  }
  
  /**
   * Run all data leakage prevention tests
   */
  static runAllTests(): { allPassed: boolean; report: string } {
    const tests = [
      this.testTemporalBoundaries(),
      this.testHistoricalDataValidation()
    ];
    
    const allPassed = tests.every(test => test.passed);
    const report = tests.map(test => test.details).join('\n\n');
    
    return {
      allPassed,
      report: `🧪 DATA LEAKAGE PREVENTION TEST RESULTS:\n\n${report}\n\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`
    };
  }
}