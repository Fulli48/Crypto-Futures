/**
 * MFE (Maximum Favorable Excursion) and Drawdown Calculator
 * 
 * Calculates MFE and Drawdown from second-by-second trade history data
 * MFE = highest unrealized profit during trade
 * Drawdown = maximum loss from peak profit during trade
 */

interface TradeHistoryPoint {
  timestamp: number;
  price: number;
  unrealized_profit: number;
}

interface MFEDrawdownResult {
  mfe: number;
  drawdown: number;
}

/**
 * Calculate MFE and Drawdown from trade history array
 * @param trade_history Array of {timestamp, price, unrealized_profit} objects
 * @returns {mfe: number, drawdown: number} with rounded values
 */
export function calculate_mfe_and_drawdown(trade_history: TradeHistoryPoint[] | null | undefined): MFEDrawdownResult {
  // Handle empty or null trade history
  if (!trade_history || trade_history.length === 0) {
    return { mfe: 0, drawdown: 0 };
  }

  let mfe = 0; // Maximum Favorable Excursion (highest profit)
  let peak_profit = 0; // Track running peak profit
  let max_drawdown_from_peak = 0; // Maximum drawdown from peak

  for (const point of trade_history) {
    const profit = point.unrealized_profit;
    
    // Update MFE (highest profit reached)
    if (profit > mfe) {
      mfe = profit;
    }
    
    // Update peak profit
    if (profit > peak_profit) {
      peak_profit = profit;
    }
    
    // Calculate drawdown from current peak
    const drawdown_from_peak = peak_profit - profit;
    if (drawdown_from_peak > max_drawdown_from_peak) {
      max_drawdown_from_peak = drawdown_from_peak;
    }
  }

  // Round to 4 decimal places for precision
  return {
    mfe: Math.round(mfe * 10000) / 10000,
    drawdown: Math.round(max_drawdown_from_peak * 10000) / 10000
  };
}

/**
 * Create trade history point for second-by-second tracking
 * @param timestamp Current timestamp in milliseconds
 * @param price Current market price
 * @param entryPrice Trade entry price
 * @param signalType 'LONG' or 'SHORT'
 * @returns TradeHistoryPoint object
 */
export function createTradeHistoryPoint(
  timestamp: number,
  price: number, 
  entryPrice: number,
  signalType: 'LONG' | 'SHORT'
): TradeHistoryPoint {
  // Calculate unrealized profit percentage
  let unrealized_profit: number;
  
  if (signalType === 'LONG') {
    unrealized_profit = ((price - entryPrice) / entryPrice) * 100;
  } else {
    unrealized_profit = ((entryPrice - price) / entryPrice) * 100;
  }
  
  return {
    timestamp,
    price,
    unrealized_profit: Math.round(unrealized_profit * 10000) / 10000
  };
}

/**
 * Format MFE/Drawdown values for display
 * @param value MFE or Drawdown value
 * @returns Formatted string or "N/A" for zero values
 */
export function formatMFEDrawdown(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return "N/A";
  }
  return `${value.toFixed(4)}%`;
}