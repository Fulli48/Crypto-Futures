#!/usr/bin/env node
/**
 * RSI Recalculation Worker
 * Updates RSI values in the rolling_chart_data table using proper technical analysis calculations
 * Replaces initial chart-generated RSI values with accurate calculations from OHLCV data
 */

const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { eq, sql, and, gte, lte, desc } = require('drizzle-orm');

// Database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const db = drizzle({ client: pool });

// Define rollingChartData table structure for queries
const rollingChartData = {
  id: { name: 'id' },
  symbol: { name: 'symbol' },
  timestamp: { name: 'timestamp' },
  open: { name: 'open' },
  high: { name: 'high' },
  low: { name: 'low' },
  close: { name: 'close' },
  rsi: { name: 'rsi' },
  updatedAt: { name: 'updated_at' }
};

/**
 * Calculate RSI (Relative Strength Index) from price data
 * @param {Array} prices - Array of closing prices (oldest to newest)
 * @param {number} period - RSI period (default 14)
 * @returns {number} RSI value between 0-100
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    return null; // Not enough data
  }

  const gains = [];
  const losses = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  if (gains.length < period) {
    return null;
  }

  // Calculate initial average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  // Apply smoothing for remaining periods
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  // Calculate RSI
  if (avgLoss === 0) {
    return 100; // No losses = maximum RSI
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.round(rsi * 100) / 100; // Round to 2 decimal places
}

/**
 * Get OHLCV data for RSI calculation
 * @param {string} symbol - Trading symbol
 * @param {number} limit - Number of records to fetch
 * @returns {Array} Array of price data
 */
async function getOHLCVData(symbol, limit = 50) {
  try {
    const query = `
      SELECT timestamp, open, high, low, close, rsi
      FROM rolling_chart_data 
      WHERE symbol = $1 
      ORDER BY timestamp ASC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [symbol, limit]);
    return result.rows.map(row => ({
      timestamp: row.timestamp,
      close: parseFloat(row.close),
      currentRSI: parseFloat(row.rsi) || null
    }));
  } catch (error) {
    console.error(`Error fetching OHLCV data for ${symbol}:`, error);
    return [];
  }
}

/**
 * Update RSI value in database
 * @param {number} id - Record ID
 * @param {number} newRSI - New RSI value
 */
async function updateRSI(id, newRSI) {
  try {
    const query = `
      UPDATE rolling_chart_data 
      SET rsi = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await pool.query(query, [newRSI, id]);
    return true;
  } catch (error) {
    console.error(`Error updating RSI for record ${id}:`, error);
    return false;
  }
}

/**
 * Process RSI recalculation for a symbol
 * @param {string} symbol - Trading symbol
 * @param {number} batchSize - Number of records to process
 */
async function processSymbolRSI(symbol, batchSize = 100) {
  console.log(`🔄 Processing RSI recalculation for ${symbol}...`);
  
  try {
    // Get all records for this symbol
    const data = await getOHLCVData(symbol, batchSize);
    
    if (data.length < 15) {
      console.log(`⚠️ ${symbol}: Insufficient data (${data.length} records) for RSI calculation`);
      return { processed: 0, updated: 0 };
    }

    const prices = data.map(item => item.close);
    let updated = 0;
    let processed = 0;

    // Calculate RSI for each data point (starting from index 14 for 14-period RSI)
    for (let i = 14; i < data.length; i++) {
      const priceSlice = prices.slice(0, i + 1);
      const newRSI = calculateRSI(priceSlice, 14);
      
      if (newRSI !== null) {
        const currentRSI = data[i].currentRSI;
        
        // Update if RSI is different or missing
        if (currentRSI === null || Math.abs(currentRSI - newRSI) > 0.01) {
          const success = await updateRSI(i + 1, newRSI);
          if (success) {
            updated++;
            console.log(`✅ ${symbol}: Updated RSI ${currentRSI} → ${newRSI} at ${data[i].timestamp}`);
          }
        }
      }
      processed++;
    }

    console.log(`✅ ${symbol}: Processed ${processed} records, updated ${updated} RSI values`);
    return { processed, updated };
    
  } catch (error) {
    console.error(`❌ Error processing ${symbol}:`, error);
    return { processed: 0, updated: 0 };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting RSI Recalculation Worker...');
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
  const batchSize = parseInt(process.argv[2]) || 100;
  
  let totalProcessed = 0;
  let totalUpdated = 0;

  for (const symbol of symbols) {
    const result = await processSymbolRSI(symbol, batchSize);
    totalProcessed += result.processed;
    totalUpdated += result.updated;
    
    // Small delay between symbols
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 RSI Recalculation Summary:');
  console.log(`Total records processed: ${totalProcessed}`);
  console.log(`Total RSI values updated: ${totalUpdated}`);
  console.log(`Success rate: ${totalProcessed > 0 ? ((totalUpdated / totalProcessed) * 100).toFixed(1) : 0}%`);
  
  await pool.end();
  console.log('✅ RSI Recalculation Worker completed successfully!');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Run the worker
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { calculateRSI, processSymbolRSI };