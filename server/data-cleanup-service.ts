/**
 * AUTOMATIC DATA CLEANUP SERVICE
 * 
 * This service automatically scans stored trades for data quality issues
 * and removes trades with 2+ occurrences of 0.0 or N/A values to maintain
 * database integrity and prevent corrupted data from affecting ML training.
 */

import { db } from './db';
import { tradeSimulations, tradeChartData } from '../shared/schema';
import { eq, ne } from 'drizzle-orm';

export interface DataCleanupResult {
  scannedTrades: number;
  deletedTrades: number;
  deletedTradeIds: number[];
  cleanupReasons: string[];
}

export class DataCleanupService {
  private static readonly INVALID_VALUES = [0.0, null, undefined, 'N/A', 'null', 'undefined'];
  private static readonly MIN_INVALID_COUNT = 2; // Minimum occurrences to trigger deletion

  /**
   * Main cleanup method that scans all completed trades and removes problematic ones
   */
  public static async performAutomaticCleanup(): Promise<DataCleanupResult> {
    console.log('🧹 [DATA CLEANUP] Starting automatic data quality scan...');
    
    try {
      // Get all completed trades from database
      const completedTrades = await db.select()
        .from(tradeSimulations)
        .where(ne(tradeSimulations.status, 'IN_PROGRESS'));

      const result: DataCleanupResult = {
        scannedTrades: completedTrades.length,
        deletedTrades: 0,
        deletedTradeIds: [],
        cleanupReasons: []
      };

      console.log(`🔍 [DATA CLEANUP] Scanning ${result.scannedTrades} completed trades for quality issues...`);

      // Scan each trade for data quality issues
      for (const trade of completedTrades) {
        const cleanupReason = this.analyzeTradeDataQuality(trade);
        
        if (cleanupReason) {
          // Delete trade and associated chart data
          await this.deleteTradeAndChartData(trade.id);
          
          result.deletedTrades++;
          result.deletedTradeIds.push(trade.id);
          result.cleanupReasons.push(`Trade ${trade.id} (${trade.symbol}): ${cleanupReason}`);
          
          console.log(`🗑️ [DATA CLEANUP] Deleted trade ${trade.id} (${trade.symbol}): ${cleanupReason}`);
        }
      }

      console.log(`✅ [DATA CLEANUP] Scan complete: ${result.scannedTrades} scanned, ${result.deletedTrades} deleted`);
      
      if (result.deletedTrades > 0) {
        console.log(`📊 [DATA CLEANUP] Cleanup improved data quality by removing ${result.deletedTrades} corrupted trades`);
      }

      return result;

    } catch (error) {
      console.error('❌ [DATA CLEANUP] Error during automatic cleanup:', error);
      throw error;
    }
  }

  /**
   * Analyzes a single trade for data quality issues
   * Returns cleanup reason if trade should be deleted, null otherwise
   */
  private static analyzeTradeDataQuality(trade: any): string | null {
    const criticalFields = [
      'entry_price', 'current_price', 'take_profit', 'stop_loss',
      'highest_profit', 'lowest_loss', 'final_profit_loss',
      'success_score', 'profitable_seconds', 'loss_seconds',
      'total_duration_seconds', 'max_favorable_excursion', 'max_drawdown'
    ];

    let invalidCount = 0;
    const invalidFields: string[] = [];

    // Check each critical field for invalid values
    for (const field of criticalFields) {
      const value = trade[field];
      
      if (this.isInvalidValue(value)) {
        invalidCount++;
        invalidFields.push(field);
      }
    }

    // Check for string representations of invalid values
    if (this.hasStringInvalidValues(trade)) {
      invalidCount++;
      invalidFields.push('string_invalid_values');
    }

    // Delete if 2 or more invalid values found
    if (invalidCount >= this.MIN_INVALID_COUNT) {
      return `${invalidCount} invalid values found in fields: ${invalidFields.join(', ')}`;
    }

    return null;
  }

  /**
   * Check if a specific trade should be deleted based on quality criteria
   */
  public static shouldDeleteTrade(trade: any): boolean {
    const cleanupReason = this.analyzeTradeDataQuality(trade);
    return cleanupReason !== null;
  }

  /**
   * Checks if a value is considered invalid (0.0, null, undefined, N/A)
   */
  private static isInvalidValue(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (value === 0.0 || value === '0.0') return true;
    if (typeof value === 'string' && ['N/A', 'null', 'undefined', ''].includes(value)) return true;
    return false;
  }

  /**
   * Checks for string representations of invalid values in text fields
   */
  private static hasStringInvalidValues(trade: any): boolean {
    const textFields = ['notes', 'completion_reason', 'market_conditions'];
    
    for (const field of textFields) {
      const value = trade[field];
      if (typeof value === 'string' && (value.includes('N/A') || value.includes('null') || value.includes('undefined'))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Deletes a trade and all associated chart data
   */
  private static async deleteTradeAndChartData(tradeId: number): Promise<void> {
    try {
      // Delete chart data first (foreign key constraint)
      await db.delete(tradeChartData)
        .where(eq(tradeChartData.tradeId, tradeId));
      
      // Delete the trade itself
      await db.delete(tradeSimulations)
        .where(eq(tradeSimulations.id, tradeId));
      
    } catch (error) {
      console.error(`❌ [DATA CLEANUP] Error deleting trade ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Manual cleanup trigger for specific trade ID
   */
  public static async cleanupSpecificTrade(tradeId: number): Promise<boolean> {
    try {
      const trades = await db.select()
        .from(tradeSimulations)
        .where(eq(tradeSimulations.id, tradeId));
      
      if (trades.length === 0) {
        console.log(`🚫 [DATA CLEANUP] Trade ${tradeId} not found`);
        return false;
      }

      const cleanupReason = this.analyzeTradeDataQuality(trades[0]);
      
      if (cleanupReason) {
        await this.deleteTradeAndChartData(tradeId);
        console.log(`🗑️ [DATA CLEANUP] Manually deleted trade ${tradeId}: ${cleanupReason}`);
        return true;
      } else {
        console.log(`✅ [DATA CLEANUP] Trade ${tradeId} data quality is acceptable`);
        return false;
      }

    } catch (error) {
      console.error(`❌ [DATA CLEANUP] Error cleaning specific trade ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics without performing deletion
   */
  public static async getCleanupPreview(): Promise<{
    totalTrades: number;
    problematicTrades: number;
    previewReasons: string[];
  }> {
    try {
      const completedTrades = await db.select()
        .from(tradeSimulations)
        .where(ne(tradeSimulations.status, 'IN_PROGRESS'));

      let problematicTrades = 0;
      const previewReasons: string[] = [];

      for (const trade of completedTrades) {
        const cleanupReason = this.analyzeTradeDataQuality(trade);
        if (cleanupReason) {
          problematicTrades++;
          previewReasons.push(`Trade ${trade.id} (${trade.symbol}): ${cleanupReason}`);
        }
      }

      return {
        totalTrades: completedTrades.length,
        problematicTrades,
        previewReasons
      };

    } catch (error) {
      console.error('❌ [DATA CLEANUP] Error getting cleanup preview:', error);
      throw error;
    }
  }
}