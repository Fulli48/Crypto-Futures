/**
 * CONTINUOUS RSI MONITORING AND CORRECTION SYSTEM
 * 
 * This worker continuously monitors for suspicious RSI patterns:
 * - Identical RSI values across multiple records
 * - RSI values that haven't changed for multiple periods
 * - RSI values outside realistic market ranges
 * - Pattern detection for fake/generated RSI data
 */

import { db } from "./db";
import { rollingChartData } from "@shared/schema";
import { eq, sql, and, gte } from "drizzle-orm";

// RSI monitoring configuration
const RSI_MONITORING_CONFIG = {
  // How often to run the monitoring (every 2 minutes)
  MONITOR_INTERVAL: 2 * 60 * 1000,
  
  // Maximum identical RSI values allowed before flagging as suspicious
  MAX_IDENTICAL_RSI: 5,
  
  // Realistic RSI bounds
  RSI_MIN: 0.01,
  RSI_MAX: 99.99,
  
  // Common fake RSI values to detect
  SUSPICIOUS_RSI_VALUES: [
    50.0, 50.00, 50.000, 50.0000,
    79.9580, 80.10204081632644,
    0, 0.0, 0.00, 0.000,
    100, 100.0, 100.00, 100.000
  ],
  
  // Symbols to monitor
  SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT']
};

interface RSI_Issue {
  type: 'IDENTICAL_RSI' | 'SUSPICIOUS_RSI' | 'OUT_OF_BOUNDS' | 'NULL_RSI';
  symbol: string;
  value?: number;
  count: number;
  description: string;
}

interface MonitoringStats {
  totalScans: number;
  suspiciousDetected: number;
  recordsFixed: number;
  lastScanTime: string | null;
}

class ContinuousRSIMonitor {
  private isRunning: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private monitoringStats: MonitoringStats = {
    totalScans: 0,
    suspiciousDetected: 0,
    recordsFixed: 0,
    lastScanTime: null
  };

  async start() {
    if (this.isRunning) {
      console.log('🔍 [RSI MONITOR] Already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 [RSI MONITOR] Continuous RSI monitoring started');
    
    // Initial scan
    await this.performRSIHealthCheck();
    
    // Set up continuous monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        await this.performRSIHealthCheck();
      } catch (error) {
        console.error('❌ [RSI MONITOR] Error during health check:', error);
      }
    }, RSI_MONITORING_CONFIG.MONITOR_INTERVAL);
    
    console.log(`⏰ [RSI MONITOR] Scheduled to run every ${RSI_MONITORING_CONFIG.MONITOR_INTERVAL / 1000} seconds`);
  }

  async stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 [RSI MONITOR] Stopped');
  }

  async performRSIHealthCheck() {
    const scanStartTime = Date.now();
    this.monitoringStats.totalScans++;
    this.monitoringStats.lastScanTime = new Date().toISOString();

    console.log(`🔍 [RSI MONITOR] Starting health check #${this.monitoringStats.totalScans}`);

    try {
      const issues = await this.detectRSIIssues();
      
      if (issues.length > 0) {
        console.log(`⚠️ [RSI MONITOR] Found ${issues.length} RSI issues:`);
        issues.forEach(issue => {
          console.log(`   ${issue.type}: ${issue.symbol} - ${issue.description}`);
        });

        const fixedCount = await this.fixRSIIssues(issues);
        this.monitoringStats.recordsFixed += fixedCount;
        this.monitoringStats.suspiciousDetected += issues.length;

        console.log(`✅ [RSI MONITOR] Fixed ${fixedCount} RSI records`);
      } else {
        console.log('✅ [RSI MONITOR] No RSI issues detected - all systems healthy');
      }

      const scanDuration = Date.now() - scanStartTime;
      console.log(`📊 [RSI MONITOR] Health check completed in ${scanDuration}ms`);
      console.log(`📈 [RSI MONITOR] Stats: ${this.monitoringStats.totalScans} scans, ${this.monitoringStats.suspiciousDetected} issues detected, ${this.monitoringStats.recordsFixed} records fixed`);

    } catch (error) {
      console.error('❌ [RSI MONITOR] Health check failed:', error);
    }
  }

  async detectRSIIssues(): Promise<RSI_Issue[]> {
    const issues: RSI_Issue[] = [];

    for (const symbol of RSI_MONITORING_CONFIG.SYMBOLS) {
      try {
        // Check for identical RSI values using raw SQL for better control
        const identicalRSIResult = await db.execute(sql`
          SELECT rsi, COUNT(*) as count
          FROM rolling_chart_data 
          WHERE symbol = ${symbol}
            AND rsi IS NOT NULL 
            AND timestamp >= NOW() - INTERVAL '2 hours'
          GROUP BY rsi 
          HAVING COUNT(*) > ${RSI_MONITORING_CONFIG.MAX_IDENTICAL_RSI}
          ORDER BY count DESC
          LIMIT 10
        `);

        for (const row of identicalRSIResult.rows) {
          issues.push({
            type: 'IDENTICAL_RSI',
            symbol: symbol,
            value: Number(row.rsi),
            count: Number(row.count),
            description: `${row.count} identical RSI values of ${row.rsi}`
          });
        }

        // Check for suspicious RSI values
        for (const suspiciousValue of RSI_MONITORING_CONFIG.SUSPICIOUS_RSI_VALUES) {
          const suspiciousResult = await db.execute(sql`
            SELECT COUNT(*) as count
            FROM rolling_chart_data 
            WHERE symbol = ${symbol}
              AND rsi = ${suspiciousValue}
              AND timestamp >= NOW() - INTERVAL '1 hour'
          `);

          const count = Number(suspiciousResult.rows[0]?.count || 0);
          if (count > 0) {
            issues.push({
              type: 'SUSPICIOUS_RSI',
              symbol: symbol,
              value: suspiciousValue,
              count: count,
              description: `${count} suspicious RSI values of ${suspiciousValue}`
            });
          }
        }

        // Check for RSI values outside realistic bounds
        const boundsResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM rolling_chart_data 
          WHERE symbol = ${symbol}
            AND (rsi <= ${RSI_MONITORING_CONFIG.RSI_MIN} OR rsi >= ${RSI_MONITORING_CONFIG.RSI_MAX})
            AND rsi IS NOT NULL
            AND timestamp >= NOW() - INTERVAL '1 hour'
        `);

        const boundsCount = Number(boundsResult.rows[0]?.count || 0);
        if (boundsCount > 0) {
          issues.push({
            type: 'OUT_OF_BOUNDS',
            symbol: symbol,
            count: boundsCount,
            description: `${boundsCount} RSI values outside realistic bounds (${RSI_MONITORING_CONFIG.RSI_MIN}-${RSI_MONITORING_CONFIG.RSI_MAX})`
          });
        }

        // Check for NULL RSI values
        const nullResult = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM rolling_chart_data 
          WHERE symbol = ${symbol}
            AND rsi IS NULL
            AND timestamp >= NOW() - INTERVAL '30 minutes'
        `);

        const nullCount = Number(nullResult.rows[0]?.count || 0);
        if (nullCount > 0) {
          issues.push({
            type: 'NULL_RSI',
            symbol: symbol,
            count: nullCount,
            description: `${nullCount} NULL RSI values in recent data`
          });
        }

      } catch (error) {
        console.error(`❌ [RSI MONITOR] Error detecting issues for ${symbol}:`, error);
      }
    }

    return issues;
  }

  async fixRSIIssues(issues: RSI_Issue[]): Promise<number> {
    let totalFixed = 0;

    for (const issue of issues) {
      try {
        let fixedCount = 0;

        switch (issue.type) {
          case 'IDENTICAL_RSI':
          case 'SUSPICIOUS_RSI':
            // Clear suspicious RSI values so they can be recalculated
            const clearResult = await db.execute(sql`
              UPDATE rolling_chart_data 
              SET rsi = NULL 
              WHERE symbol = ${issue.symbol}
                AND rsi = ${issue.value}
                AND timestamp >= NOW() - INTERVAL '2 hours'
            `);
            fixedCount = clearResult.rowCount || 0;
            console.log(`🔧 [RSI FIX] ${issue.symbol}: Cleared ${fixedCount} identical/suspicious RSI values (${issue.value})`);
            break;

          case 'OUT_OF_BOUNDS':
            // Clear out-of-bounds RSI values
            const boundsResult = await db.execute(sql`
              UPDATE rolling_chart_data 
              SET rsi = NULL 
              WHERE symbol = ${issue.symbol}
                AND (rsi <= ${RSI_MONITORING_CONFIG.RSI_MIN} OR rsi >= ${RSI_MONITORING_CONFIG.RSI_MAX})
                AND timestamp >= NOW() - INTERVAL '1 hour'
            `);
            fixedCount = boundsResult.rowCount || 0;
            console.log(`🔧 [RSI FIX] ${issue.symbol}: Cleared ${fixedCount} out-of-bounds RSI values`);
            break;

          case 'NULL_RSI':
            // NULL RSI values will be recalculated by the rolling chart service
            console.log(`🔧 [RSI FIX] ${issue.symbol}: ${issue.count} NULL RSI values detected - will be recalculated automatically`);
            fixedCount = 0; // Don't count NULL fixes since they're handled by other systems
            break;
        }

        totalFixed += fixedCount;

      } catch (error) {
        console.error(`❌ [RSI FIX] Failed to fix ${issue.type} for ${issue.symbol}:`, error);
      }
    }

    return totalFixed;
  }

  getStats() {
    return {
      ...this.monitoringStats,
      isRunning: this.isRunning,
      nextScanIn: this.isRunning && this.monitoringStats.lastScanTime ? 
        Math.max(0, RSI_MONITORING_CONFIG.MONITOR_INTERVAL - (Date.now() - new Date(this.monitoringStats.lastScanTime).getTime())) / 1000 : 
        null
    };
  }
}

// Create and export the monitor instance
export const rsiMonitor = new ContinuousRSIMonitor();

// Auto-start the monitor after a delay to allow other systems to initialize
setTimeout(() => {
  rsiMonitor.start().catch(error => {
    console.error('❌ [RSI MONITOR] Auto-start failed:', error);
  });
}, 5000); // Start after 5 seconds