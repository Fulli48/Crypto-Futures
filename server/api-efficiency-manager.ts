// API EFFICIENCY MANAGER - REDUCES REDUNDANT CALLS AND OPTIMIZES SYSTEM PERFORMANCE

class APIEfficiencyManager {
  private globalPriceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private requestQueue: Map<string, Promise<any>> = new Map();
  private readonly GLOBAL_CACHE_DURATION = 60000; // 1 minute global cache
  private readonly BATCH_DELAY = 500; // 500ms batch window
  
  // Smart price fetching with deduplication
  async getOptimizedPrice(symbol: string): Promise<number | null> {
    const cacheKey = `price_${symbol}`;
    const now = Date.now();
    
    // Check global cache first
    const cached = this.globalPriceCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.GLOBAL_CACHE_DURATION) {
      console.log(`⚡ GLOBAL CACHE HIT: ${symbol}`);
      return cached.price;
    }
    
    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      console.log(`🔄 DEDUPLICATING REQUEST: ${symbol}`);
      return await this.requestQueue.get(cacheKey);
    }
    
    // Create new request and cache the promise
    const request = this.fetchPriceWithTimeout(symbol);
    this.requestQueue.set(cacheKey, request);
    
    try {
      const price = await request;
      
      // Cache the result
      if (price) {
        this.globalPriceCache.set(cacheKey, { price, timestamp: now });
      }
      
      return price;
    } finally {
      // Remove from queue when complete
      this.requestQueue.delete(cacheKey);
    }
  }
  
  private async fetchPriceWithTimeout(symbol: string): Promise<number | null> {
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 10000); // 10 second timeout
    });
    
    const pricePromise = (async () => {
      const { realPriceAPI } = await import('./real-price-api');
      return await realPriceAPI.getRealPrice(symbol);
    })();
    
    return Promise.race([pricePromise, timeout]);
  }
  
  // Batch optimization for multiple symbols
  async getOptimizedPrices(symbols: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    
    // Use Promise.all to fetch all prices concurrently
    const promises = symbols.map(async (symbol) => {
      const price = await this.getOptimizedPrice(symbol);
      if (price !== null) {
        results[symbol] = price;
      }
    });
    
    await Promise.all(promises);
    return results;
  }
  
  // Clean old cache entries
  cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.globalPriceCache.entries()) {
      if (now - entry.timestamp > this.GLOBAL_CACHE_DURATION) {
        this.globalPriceCache.delete(key);
      }
    }
  }
  
  // Get efficiency statistics
  getStats(): { cacheSize: number; activeRequests: number } {
    return {
      cacheSize: this.globalPriceCache.size,
      activeRequests: this.requestQueue.size
    };
  }
}

export const apiEfficiencyManager = new APIEfficiencyManager();

// Clean cache every 2 minutes
setInterval(() => {
  apiEfficiencyManager.cleanCache();
}, 120000);

export default apiEfficiencyManager;