import { db } from './db.js';
import { tradeSimulations } from '@shared/schema';
import { sql, and, isNull, lte } from 'drizzle-orm';

/**
 * Trade Expiration Service
 * Monitors trades and marks them as EXPIRED when their duration exceeds 20 minutes
 */
export class TradeExpirationService {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the trade expiration monitoring service
   */
  public static start(): void {
    if (this.isRunning) {
      console.log('⏰ [TRADE EXPIRATION] Service already running');
      return;
    }

    console.log('🚀 [TRADE EXPIRATION] Starting trade expiration monitoring service...');
    this.isRunning = true;

    // Run immediately
    this.checkAndExpireTrades();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkAndExpireTrades();
    }, 30000);

    console.log('✅ [TRADE EXPIRATION] Service started - checking every 30 seconds');
  }

  /**
   * Stop the trade expiration monitoring service
   */
  public static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 [TRADE EXPIRATION] Service stopped');
  }

  /**
   * Check for trades that should be expired and mark them
   */
  private static async checkAndExpireTrades(): Promise<void> {
    try {
      const now = new Date();

      // Find trades that are older than their specified duration with NULL actual_outcome
      // Use the durationMinutes field from the database (should be 20 minutes)
      const expiredTrades = await db.select({
        id: tradeSimulations.id,
        symbol: tradeSimulations.symbol,
        signalType: tradeSimulations.signalType,
        createdAt: tradeSimulations.createdAt,
        entryPrice: tradeSimulations.entryPrice,
        durationMinutes: tradeSimulations.durationMinutes
      })
      .from(tradeSimulations)
      .where(
        and(
          isNull(tradeSimulations.actualOutcome),
          sql`${tradeSimulations.createdAt} + INTERVAL '1 minute' * ${tradeSimulations.durationMinutes} <= ${now}`
        )
      )
      .limit(100); // Process in batches to avoid overwhelming the system

      if (expiredTrades.length === 0) {
        console.log('⏰ [TRADE EXPIRATION] No trades to expire');
        return;
      }

      console.log(`⏰ [TRADE EXPIRATION] Found ${expiredTrades.length} trades to expire`);

      // Mark trades as EXPIRED
      for (const trade of expiredTrades) {
        await this.markTradeAsExpired(trade);
      }

      console.log(`✅ [TRADE EXPIRATION] Successfully expired ${expiredTrades.length} trades`);

    } catch (error) {
      console.error('❌ [TRADE EXPIRATION] Error checking for expired trades:', error);
    }
  }

  /**
   * Mark a specific trade as expired
   */
  private static async markTradeAsExpired(trade: any): Promise<void> {
    try {
      const now = new Date();
      const durationMs = (trade.durationMinutes || 20) * 60 * 1000; // Use trade's duration or default to 20 min
      const expiredAt = new Date(trade.createdAt.getTime() + durationMs);

      // Get current price to calculate final profit/loss
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      const entryPrice = parseFloat(trade.entryPrice);
      
      let profitLoss = 0;
      if (currentPrice) {
        if (trade.signalType === 'LONG') {
          profitLoss = ((currentPrice - entryPrice) / entryPrice) * 100;
        } else {
          profitLoss = ((entryPrice - currentPrice) / entryPrice) * 100;
        }
      }

      // Update the trade to mark it as expired
      await db.update(tradeSimulations)
        .set({
          actualOutcome: 'EXPIRED',
          endTime: expiredAt,
          completedAt: now,
          profitLoss: profitLoss.toString(),
          updatedAt: now
        })
        .where(sql`id = ${trade.id}`);

      console.log(`⏰ [TRADE EXPIRATION] Trade ${trade.id} (${trade.symbol} ${trade.signalType}) marked as EXPIRED with ${profitLoss.toFixed(2)}% P/L`);

    } catch (error) {
      console.error(`❌ [TRADE EXPIRATION] Error marking trade ${trade.id} as expired:`, error);
    }
  }

  /**
   * Get current price for a symbol from rolling chart data
   */
  private static async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        SELECT close 
        FROM rolling_chart_data 
        WHERE symbol = ${symbol} 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      if (result.rows && result.rows.length > 0) {
        return parseFloat((result.rows[0] as any).close.toString());
      }
      return null;
    } catch (error) {
      console.error(`❌ [TRADE EXPIRATION] Error getting current price for ${symbol}:`, error);
      return null;
    }
  }
}