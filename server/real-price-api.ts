import { callApiWithControl } from './api-control';
import * as crypto from 'crypto';

// Interfaces and Types for Price API
interface OHLCVData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ApiSource {
  name: string;
  url: string;
  transformer: (data: any, symbol: string) => OHLCVData | null;
  requiresAuth?: boolean;
  retryOnError?: boolean;
  retryDelay?: number;
  headers?: Record<string, string>;
}

// COINBASE ONLY API - NO FALLBACKS
export class RealPriceAPI {
  private readonly COINBASE_API_KEY = process.env.COINBASE_API_KEY || '';
  private readonly COINBASE_API_SECRET = process.env.COINBASE_API_SECRET || '';

  private sources: ApiSource[] = [
    // BINANCE US SPOT: Primary source for authentic Binance pricing (US accessible)
    {
      name: 'Binance-US-Authentic-Spot',
      url: 'https://api.binance.us/api/v3/ticker/24hr?symbol={symbol}',
      transformer: (data: any, symbol: string) => {
        if (data?.lastPrice) {
          const spotPrice = parseFloat(data.lastPrice);
          console.log(`🎯 [BINANCE US] ${symbol}: $${spotPrice.toFixed(2)} (authentic Binance US pricing)`);
          
          return {
            open: parseFloat(data.openPrice) || spotPrice,
            high: parseFloat(data.highPrice) || spotPrice,
            low: parseFloat(data.lowPrice) || spotPrice,
            close: spotPrice,
            volume: parseFloat(data.volume) || 0
          };
        }
        return null;
      },
      requiresAuth: false,
      retryOnError: true,
      retryDelay: 2000
    }
  ];

  // Cache to store recent prices
  private priceCache = new Map<string, { data: OHLCVData; timestamp: number; }>(); 
  private readonly CACHE_DURATION = 5000; // 5 seconds cache

  // Convert symbols to Coinbase futures contract format
  private convertToFuturesSymbol(symbol: string): string {
    // Use spot symbols for now since futures contracts may not be available
    const futuresConversions: Record<string, string> = {
      'BTCUSDT': 'BTC-USD',    // Use spot until futures are verified
      'ETHUSDT': 'ETH-USD',    // Use spot until futures are verified
      'SOLUSDT': 'SOL-USD',    // Use spot until futures are verified
      'XRPUSDT': 'XRP-USD',    // Use spot until futures are verified
      'ADAUSDT': 'ADA-USD',    // Use spot until futures are verified
      'HBARUSDT': 'HBAR-USD'   // Use spot until futures are verified
    };
    
    return futuresConversions[symbol] || symbol;
  }

  // Generate authentication headers for Coinbase Advanced Trade API
  private generateCoinbaseAuthHeaders(method: string, path: string, body: string = ''): Record<string, string> {
    if (!this.COINBASE_API_KEY || !this.COINBASE_API_SECRET) {
      throw new Error('Coinbase API credentials not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}${method.toUpperCase()}${path}${body}`;
    
    // Create the signature using HMAC SHA256
    const signature = crypto.createHmac('sha256', this.COINBASE_API_SECRET).update(message).digest('hex');
    
    return {
      'CB-ACCESS-KEY': this.COINBASE_API_KEY,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json'
    };
  }

  // Enhanced symbol conversion for Coinbase Advanced API
  private convertToCoinbaseSymbol(symbol: string): string {
    const conversions: Record<string, string> = {
      'BTCUSDT': 'BTC-USD',
      'ETHUSDT': 'ETH-USD', 
      'SOLUSDT': 'SOL-USD',
      'XRPUSDT': 'XRP-USD',
      'ADAUSDT': 'ADA-USD',
      'HBARUSDT': 'HBAR-USD'
    };
    return conversions[symbol] || symbol.replace('USDT', '-USD');
  }

  // Symbol conversion for Binance API - symbols are used directly
  private convertToBinanceSymbol(symbol: string): string {
    // Binance uses symbols directly (e.g., BTCUSDT, ETHUSDT)
    return symbol;
  }

  // Fetch real-time OHLCV data with Coinbase-only approach
  async fetchRealOHLCVData(symbols: string[]): Promise<Record<string, OHLCVData>> {
    const results: Record<string, OHLCVData> = {};
    console.log(`🎯 [REAL PRICE API] Fetching spot prices for minute-by-minute data collection`);

    // Try each symbol with Coinbase API
    for (const symbol of symbols) {
      try {
        const data = await this.fetchOHLCVFromSources([symbol]);
        if (data[symbol]) {
          results[symbol] = data[symbol];
        }
      } catch (error) {
        console.warn(`❌ Failed to fetch ${symbol}: ${error}`);
      }
    }

    return results;
  }

  // Fetch from Coinbase sources only
  private async fetchOHLCVFromSources(symbols: string[]): Promise<Record<string, OHLCVData>> {
    const results: Record<string, OHLCVData> = {};

    for (const source of this.sources) {
      console.log(`🔄 Fetching ${symbols.length}/${symbols.length} fresh OHLCV data`);
      
      try {
        const sourceResults = await this.fetchOHLCVFromSource(source, symbols);
        
        // Merge successful results
        for (const [symbol, data] of Object.entries(sourceResults)) {
          if (data && !results[symbol]) {
            results[symbol] = data;
          }
        }

        // If we got all symbols, return
        if (Object.keys(results).length === symbols.length) {
          console.log(`✅ ${source.name}: ${Object.keys(results).length}/${symbols.length} OHLCV data`);
          console.log(`🎯 Batch result: ${Object.keys(results).length}/${symbols.length} OHLCV data (${((Object.keys(results).length / symbols.length) * 100).toFixed(0)}%)`);
          return results;
        }
      } catch (error) {
        console.warn(`❌ Error fetching from ${source.name}:`, error);
      }
    }

    console.log(`🎯 Batch result: ${Object.keys(results).length}/${symbols.length} OHLCV data (${((Object.keys(results).length / symbols.length) * 100).toFixed(0)}%)`);
    return results;
  }

  // Fetch from individual source
  private async fetchOHLCVFromSource(source: ApiSource, symbols: string[]): Promise<Record<string, OHLCVData>> {
    return await this.fetchWithRetry(source, symbols);
  }

  // Fetch with retry logic
  private async fetchWithRetry(source: ApiSource, symbols: string[], maxRetries: number = 1): Promise<Record<string, OHLCVData>> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 Making fresh API call for ${source.name}-${symbols[0]}`);
        
        // Generate unique cache key with timestamp for fresh minute-by-minute data
        const currentMinute = Math.floor(Date.now() / 60000); // Round to current minute
        const cacheKey = `${source.name}-${symbols.join(',')}-${currentMinute}`;
        
        const data = await callApiWithControl(cacheKey, async () => {
          let url = source.url;
          const options: RequestInit = {};

          // Handle Binance US Spot API
          if (source.name === 'Binance-US-Authentic-Spot') {
            if (symbols.length === 1) {
              const binanceSymbol = this.convertToBinanceSymbol(symbols[0]);
              url = url.replace('{symbol}', binanceSymbol);
            }
          }

          if (source.headers) {
            options.headers = { ...options.headers, ...source.headers };
          }

          const response = await fetch(url, options);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        });

        // Transform the response
        const results: Record<string, OHLCVData> = {};
        
        if (symbols.length === 1) {
          const transformedData = source.transformer(data, symbols[0]);
          if (transformedData) {
            results[symbols[0]] = transformedData;
          }
        } else {
          // Handle multiple symbols
          for (const symbol of symbols) {
            if (data[symbol]) {
              const transformedData = source.transformer(data[symbol], symbol);
              if (transformedData) {
                results[symbol] = transformedData;
              }
            }
          }
        }

        return results;
        
      } catch (error: any) {
        console.error(`❌ API call failed for ${source.name}-${symbols[0]}: ${error}`);
        
        // If it's the last attempt or source doesn't support retry, throw error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (only for sources with retry enabled)
        if (source.retryOnError && source.retryDelay) {
          console.log(`⏳ ${source.name} retrying in ${source.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, source.retryDelay));
        }
      }
    }
    
    return {};
  }

  // Get single price with Coinbase only
  async getRealPrice(symbol: string): Promise<number | null> {
    const ohlcvData = await this.fetchRealOHLCVData([symbol]);
    return ohlcvData[symbol]?.close || null;
  }

  // Backward compatibility method for simple price fetching
  async fetchRealPrices(symbols: string[]): Promise<Record<string, number>> {
    const ohlcvData = await this.fetchRealOHLCVData(symbols);
    const prices: Record<string, number> = {};
    
    for (const [symbol, data] of Object.entries(ohlcvData)) {
      prices[symbol] = data.close;
    }
    
    return prices;
  }

  // Clear cache (useful for testing)
  clearCache(): void {
    this.priceCache.clear();
    console.log('🧹 Price cache cleared');
  }
}

// Export singleton instance
export const realPriceAPI = new RealPriceAPI();