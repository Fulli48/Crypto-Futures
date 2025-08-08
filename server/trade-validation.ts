/**
 * Comprehensive Trade Validation System
 * Ensures only complete trades with all required fields are saved to database
 */

interface TradeValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorMessage?: string;
}

interface RequiredTradeFields {
  id?: number;
  signal: string;
  symbol: string;
  duration: number;
  entry: number;
  tp: number;
  sl: number;
  outcome: string;
  profitLoss: number;
  maxProfit: number;
  maxLoss: number;
  timeInProfitRatio: number;
  durationMinutes: number;
  successScore: number;
  highestProfit: number;
  lowestLoss: number;
  completed: boolean;
}

/**
 * Validates that a trade has all required fields and no N/A values
 */
export function validateTradeCompletion(trade: any): TradeValidationResult {
  const requiredFields = [
    'symbol',
    'signal_type',
    'simulation_type', 
    'entry_price',
    'tp_price',
    'sl_price',
    'actual_outcome',
    'profit_loss',
    'highest_profit',
    'lowest_loss',
    'time_in_profit_ratio',
    'duration_minutes',
    'success_score'
  ];

  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const value = trade[field];
    
    // Check if field is missing, null, undefined, NaN, empty string, or 'N/A'
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      value === 'N/A' ||
      value === 'n/a' ||
      (typeof value === 'number' && isNaN(value)) ||
      (typeof value === 'string' && value.toLowerCase() === 'n/a')
    ) {
      missingFields.push(field);
    }
    
    // Special validation for numeric fields that should not be zero for certain outcomes
    if (field === 'durationMinutes' && (value === 0 || value === '0')) {
      missingFields.push(`${field} (zero duration invalid)`);
    }
    
    if (field === 'timeInProfitRatio' && trade.actualOutcome !== 'IN_PROGRESS' && (value === 0 || value === '0')) {
      missingFields.push(`${field} (zero ratio invalid for completed trade)`);
    }
  }

  const isValid = missingFields.length === 0;
  
  return {
    isValid,
    missingFields,
    errorMessage: isValid ? undefined : `Trade validation failed: Missing or invalid fields: ${missingFields.join(', ')}`
  };
}

/**
 * Logs detailed validation error for debugging
 */
export function logTradeValidationError(tradeId: number | string, validation: TradeValidationResult, trade: any): void {
  console.error(`❌ TRADE VALIDATION FAILED - Trade ID: ${tradeId}`);
  console.error(`🔍 Missing/Invalid Fields: ${validation.missingFields.join(', ')}`);
  console.error(`📊 Trade Data:`, {
    symbol: trade.symbol,
    signalType: trade.signalType,
    simulationType: trade.simulationType,
    actualOutcome: trade.actualOutcome,
    profitLoss: trade.profitLoss,
    highestProfit: trade.highestProfit,
    lowestLoss: trade.lowestLoss,
    timeInProfitRatio: trade.timeInProfitRatio,
    durationMinutes: trade.durationMinutes,
    successScore: trade.successScore
  });
  console.error(`❗ Error: ${validation.errorMessage}`);
}

/**
 * Enhanced validation with profit window data integrity check
 */
export function validateProfitWindowData(trade: any): TradeValidationResult {
  const missingFields: string[] = [];
  
  // Check profit window specific fields
  const profitWindowFields = [
    'highestProfit',
    'lowestLoss', 
    'timeInProfitRatio',
    'durationMinutes'
  ];
  
  for (const field of profitWindowFields) {
    const value = trade[field];
    
    if (value === null || value === undefined || value === '' || value === 'N/A') {
      missingFields.push(field);
    }
    
    // Check for invalid zero combinations that indicate N/A equivalent data
    if (field === 'highestProfit' && value === 0 && trade.lowestLoss === 0 && trade.timeInProfitRatio === 0 && trade.durationMinutes === 0) {
      missingFields.push('all profit window data is zero (N/A equivalent)');
      break;
    }
  }
  
  const isValid = missingFields.length === 0;
  
  return {
    isValid,
    missingFields,
    errorMessage: isValid ? undefined : `Profit window validation failed: ${missingFields.join(', ')}`
  };
}

/**
 * Main validation function for trade data before saving to database
 * Combines comprehensive field validation with profit window data integrity checks
 */
export async function validateTradeBeforeSave(trade: any): Promise<{
  isValid: boolean;
  errors: string[];
  errorMessage?: string;
}> {
  const errors: string[] = [];
  
  // Run comprehensive field validation
  const fieldValidation = validateTradeCompletion(trade);
  if (!fieldValidation.isValid) {
    errors.push(...fieldValidation.missingFields);
  }
  
  // Run profit window data validation
  const profitWindowValidation = validateProfitWindowData(trade);
  if (!profitWindowValidation.isValid) {
    errors.push(...profitWindowValidation.missingFields);
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    errorMessage: isValid ? undefined : `Trade validation failed: ${errors.join(', ')}`
  };
}

/**
 * Comprehensive validation combining all checks
 */
export function performComprehensiveTradeValidation(trade: any): TradeValidationResult {
  // Basic field validation
  const basicValidation = validateTradeCompletion(trade);
  if (!basicValidation.isValid) {
    return basicValidation;
  }
  
  // Profit window data validation
  const profitWindowValidation = validateProfitWindowData(trade);
  if (!profitWindowValidation.isValid) {
    return profitWindowValidation;
  }
  
  return {
    isValid: true,
    missingFields: [],
    errorMessage: undefined
  };
}