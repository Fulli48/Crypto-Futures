/*
 * OPTIMIZED SIMULATION PRICE CACHE SYSTEM
 * Designed for efficient real-time price updates for active simulation trades
 * Reduces API calls while maintaining data freshness
 */

import { realPriceAPI } from './real-price-api';

interface PriceCacheEntry {
  price: number;
  timestamp: number;
  retryCount: number;
}

export class SimulationPriceCache {
  private cache: Map<string, PriceCacheEntry> = new Map();
  private batchUpdateInProgress = false;
  private lastBatchUpdate = 0;
  
  // Cache settings optimized for simulation trades
  private readonly CACHE_DURATION = 3000; // 3 seconds - more frequent updates for simulation
  private readonly BATCH_INTERVAL = 2000; // 2 seconds minimum between batch updates
  private readonly MAX_RETRY_COUNT = 3;
  private readonly BATCH_SIZE = 5; // Process 5 symbols at once

  async getCurrentPrice(symbol: string): Promise<number> {
    const cached = this.cache.get(symbol);
    const now = Date.now();
    
    // Return fresh cached price if available
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION && cached.retryCount < this.MAX_RETRY_COUNT) {
      return cached.price;
    }
    
    // Trigger batch update if needed
    if (!this.batchUpdateInProgress && (now - this.lastBatchUpdate) > this.BATCH_INTERVAL) {
      this.triggerBatchUpdate();
    }
    
    // Return cached price if available, even if slightly stale
    if (cached && cached.price > 0) {
      return cached.price;
    }
    
    // Fallback: direct API call for this symbol
    try {
      const prices = await realPriceAPI.fetchRealPrices([symbol]);
      const price = prices[symbol];
      if (price && price > 0) {
        this.updateCache(symbol, price, 0);
        return price;
      }
    } catch (error) {
      console.warn(`⚠️ Direct API fallback failed for ${symbol}:`, error);
    }
    
    // Return last known price or 0
    return cached?.price || 0;
  }

  async getBatchPrices(symbols: string[], forceRefresh: boolean = false): Promise<Record<string, number>> {
    const now = Date.now();
    const result: Record<string, number> = {};
    const symbolsNeedingUpdate: string[] = [];
    
    // Check cache for each symbol
    for (const symbol of symbols) {
      const cached = this.cache.get(symbol);
      const isCacheFresh = cached && (now - cached.timestamp) < this.CACHE_DURATION && cached.retryCount < this.MAX_RETRY_COUNT;
      
      if (!forceRefresh && isCacheFresh) {
        result[symbol] = cached.price;
      } else {
        symbolsNeedingUpdate.push(symbol);
        // Use cached price as fallback
        if (cached && cached.price > 0) {
          result[symbol] = cached.price;
        }
      }
    }
    
    // Batch update stale symbols
    if (symbolsNeedingUpdate.length > 0) {
      try {
        console.log(`🔄 SIMULATION CACHE: Updating ${symbolsNeedingUpdate.length} stale prices: ${symbolsNeedingUpdate.join(', ')}`);
        const freshPrices = await realPriceAPI.fetchRealPrices(symbolsNeedingUpdate);
        
        for (const symbol of symbolsNeedingUpdate) {
          const price = freshPrices[symbol];
          if (price && price > 0) {
            result[symbol] = price;
            this.updateCache(symbol, price, 0);
          }
        }
      } catch (error) {
        console.warn(`⚠️ SIMULATION CACHE: Batch update failed for symbols: ${symbolsNeedingUpdate.join(', ')}`, error);
        // Increment retry count for failed symbols
        symbolsNeedingUpdate.forEach(symbol => {
          const cached = this.cache.get(symbol);
          if (cached) {
            this.updateCache(symbol, cached.price, cached.retryCount + 1);
          }
        });
      }
    }
    
    return result;
  }

  private async triggerBatchUpdate(): Promise<void> {
    if (this.batchUpdateInProgress) return;
    
    this.batchUpdateInProgress = true;
    this.lastBatchUpdate = Date.now();
    
    try {
      // Get all symbols that need updating
      const now = Date.now();
      const staleSymbols: string[] = [];
      
      for (const [symbol, entry] of Array.from(this.cache.entries())) {
        if ((now - entry.timestamp) > this.CACHE_DURATION && entry.retryCount < this.MAX_RETRY_COUNT) {
          staleSymbols.push(symbol);
        }
      }
      
      if (staleSymbols.length > 0) {
        // Process in batches to avoid overwhelming the API
        for (let i = 0; i < staleSymbols.length; i += this.BATCH_SIZE) {
          const batch = staleSymbols.slice(i, i + this.BATCH_SIZE);
          
          try {
            const prices = await realPriceAPI.fetchRealPrices(batch);
            
            for (const symbol of batch) {
              const price = prices[symbol];
              if (price && price > 0) {
                this.updateCache(symbol, price, 0);
              } else {
                const cached = this.cache.get(symbol);
                if (cached) {
                  this.updateCache(symbol, cached.price, cached.retryCount + 1);
                }
              }
            }
            
            // Small delay between batches
            if (i + this.BATCH_SIZE < staleSymbols.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.warn(`⚠️ SIMULATION CACHE: Batch ${i / this.BATCH_SIZE + 1} failed:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ SIMULATION CACHE: Batch update error:', error);
    } finally {
      this.batchUpdateInProgress = false;
    }
  }

  private updateCache(symbol: string, price: number, retryCount: number): void {
    this.cache.set(symbol, {
      price,
      timestamp: Date.now(),
      retryCount
    });
  }

  // Preload symbols for upcoming trades
  async preloadSymbols(symbols: string[]): Promise<void> {
    try {
      console.log(`🔄 SIMULATION CACHE: Preloading ${symbols.length} symbols`);
      const prices = await realPriceAPI.fetchRealPrices(symbols);
      
      for (const symbol of symbols) {
        const price = prices[symbol];
        if (price && price > 0) {
          this.updateCache(symbol, price, 0);
        }
      }
    } catch (error) {
      console.warn('⚠️ SIMULATION CACHE: Preload failed:', error);
    }
  }

  // Get cache stats for monitoring
  getCacheStats(): { totalSymbols: number; freshSymbols: number; staleSymbols: number } {
    const now = Date.now();
    let freshSymbols = 0;
    let staleSymbols = 0;
    
    for (const [, entry] of Array.from(this.cache.entries())) {
      if ((now - entry.timestamp) < this.CACHE_DURATION) {
        freshSymbols++;
      } else {
        staleSymbols++;
      }
    }
    
    return {
      totalSymbols: this.cache.size,
      freshSymbols,
      staleSymbols
    };
  }

  // Clear old entries to prevent memory bloat
  cleanup(): void {
    const now = Date.now();
    const maxAge = this.CACHE_DURATION * 10; // Keep entries for up to 80 seconds
    
    for (const [symbol, entry] of Array.from(this.cache.entries())) {
      if ((now - entry.timestamp) > maxAge || entry.retryCount >= this.MAX_RETRY_COUNT) {
        this.cache.delete(symbol);
      }
    }
  }
}

// Export singleton instance
export const simulationPriceCache = new SimulationPriceCache();