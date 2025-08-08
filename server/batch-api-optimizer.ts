import realPriceAPI from './real-price-api';

// BATCH API OPTIMIZATION SYSTEM
// Reduces redundant API calls by intelligently batching and caching requests

interface BatchRequest {
  symbols: string[];
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

class BatchAPIOptimizer {
  private pendingRequests: Map<string, BatchRequest> = new Map();
  private batchCache: Map<string, { data: Record<string, number>; timestamp: number }> = new Map();
  private readonly BATCH_WINDOW = 2000; // 2 seconds to collect batches
  private readonly CACHE_DURATION = 45000; // 45 seconds cache
  private batchTimer: NodeJS.Timeout | null = null;

  // Smart batch collector - groups requests and executes efficiently
  async getOptimizedPrices(symbols: string[], priority: 'high' | 'medium' | 'low' = 'medium'): Promise<Record<string, number>> {
    const batchKey = symbols.sort().join('_');
    const now = Date.now();

    // Check if we have recent cached data for this exact batch
    const cached = this.batchCache.get(batchKey);
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`🚀 BATCH CACHE HIT: ${symbols.length} symbols from cache`);
      return cached.data;
    }

    // Add request to pending batch
    this.pendingRequests.set(batchKey, {
      symbols,
      timestamp: now,
      priority
    });

    // If high priority or batch window expired, execute immediately
    if (priority === 'high' || !this.batchTimer) {
      this.scheduleBatchExecution();
    }

    // Wait for batch execution
    return this.waitForBatchResult(batchKey);
  }

  private scheduleBatchExecution(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(async () => {
      await this.executeBatch();
      this.batchTimer = null;
    }, this.BATCH_WINDOW);
  }

  private async executeBatch(): Promise<void> {
    if (this.pendingRequests.size === 0) return;

    console.log(`🔄 EXECUTING BATCH: ${this.pendingRequests.size} pending requests`);

    // Collect all unique symbols from pending requests
    const allSymbols = new Set<string>();
    for (const request of this.pendingRequests.values()) {
      request.symbols.forEach(symbol => allSymbols.add(symbol));
    }

    const symbolsArray = Array.from(allSymbols);
    console.log(`🎯 BATCH FETCH: ${symbolsArray.length} unique symbols`);

    try {
      // Single API call for all symbols
      const prices = await realPriceAPI.fetchRealPrices(symbolsArray);

      // Cache results for all pending requests
      for (const [batchKey, request] of this.pendingRequests.entries()) {
        const requestPrices: Record<string, number> = {};
        for (const symbol of request.symbols) {
          if (prices[symbol]) {
            requestPrices[symbol] = prices[symbol];
          }
        }

        this.batchCache.set(batchKey, {
          data: requestPrices,
          timestamp: Date.now()
        });
      }

      console.log(`✅ BATCH COMPLETE: ${Object.keys(prices).length}/${symbolsArray.length} prices cached`);
    } catch (error) {
      console.error('❌ BATCH FAILED:', error);
    }

    // Clear pending requests
    this.pendingRequests.clear();
  }

  private async waitForBatchResult(batchKey: string): Promise<Record<string, number>> {
    // Wait for batch execution with timeout
    const maxWait = this.BATCH_WINDOW + 5000; // 7 seconds max wait
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkResult = () => {
        const cached = this.batchCache.get(batchKey);
        if (cached) {
          resolve(cached.data);
          return;
        }

        if (Date.now() - startTime > maxWait) {
          console.warn(`⚠️ BATCH TIMEOUT for ${batchKey}`);
          resolve({});
          return;
        }

        // Check again in 100ms
        setTimeout(checkResult, 100);
      };

      checkResult();
    });
  }

  // Clean old cache entries
  cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.batchCache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.batchCache.delete(key);
      }
    }
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.batchCache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

export const batchOptimizer = new BatchAPIOptimizer();

// Clean cache every 2 minutes
setInterval(() => {
  batchOptimizer.cleanCache();
}, 120000);

export default batchOptimizer;