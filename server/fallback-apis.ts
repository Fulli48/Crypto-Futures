// Fallback API implementations for when primary sources fail
import axios from 'axios';

interface CryptoPrice {
  symbol: string;
  price: number;
  change24h?: number;
}

// Bybit API fallback
export async function fetchBybitPrices(): Promise<CryptoPrice[]> {
  try {
    const response = await axios.get('https://api.bybit.com/v5/market/tickers', {
      params: {
        category: 'spot'
      },
      timeout: 10000
    });

    // COINBASE FUTURES APPROVED SYMBOLS ONLY (2025): BTC, ETH, SOL, XRP, ADA, HBAR
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'HBARUSDT'];
    const prices: CryptoPrice[] = [];

    response.data.result.list.forEach((ticker: any) => {
      if (symbols.includes(ticker.symbol)) {
        prices.push({
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          change24h: parseFloat(ticker.price24hPcnt) * 100
        });
      }
    });

    return prices;
  } catch (error) {
    console.error('Bybit API failed:', error);
    throw error;
  }
}

// KuCoin API fallback
export async function fetchKuCoinPrices(): Promise<CryptoPrice[]> {
  try {
    const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers', {
      timeout: 10000
    });

    // COINBASE FUTURES APPROVED SYMBOLS ONLY (2025): BTC, ETH, SOL, XRP, ADA, HBAR
    const symbolMap: { [key: string]: string } = {
      'BTC-USDT': 'BTCUSDT',
      'ETH-USDT': 'ETHUSDT', 
      'SOL-USDT': 'SOLUSDT',
      'XRP-USDT': 'XRPUSDT',
      'ADA-USDT': 'ADAUSDT',
      'HBAR-USDT': 'HBARUSDT'
    };

    const prices: CryptoPrice[] = [];

    response.data.data.ticker.forEach((ticker: any) => {
      const mappedSymbol = symbolMap[ticker.symbol];
      if (mappedSymbol) {
        prices.push({
          symbol: mappedSymbol,
          price: parseFloat(ticker.last),
          change24h: parseFloat(ticker.changeRate) * 100
        });
      }
    });

    return prices;
  } catch (error) {
    console.error('KuCoin API failed:', error);
    throw error;
  }
}

// Mock data as last resort (only when all APIs fail)
// COINBASE FUTURES APPROVED SYMBOLS ONLY (2025): BTC, ETH, SOL, XRP, ADA, HBAR
export function getMockPrices(): CryptoPrice[] {
  return [
    { symbol: 'BTCUSDT', price: 99500.50, change24h: 2.5 },
    { symbol: 'ETHUSDT', price: 3450.75, change24h: 1.8 },
    { symbol: 'SOLUSDT', price: 195.25, change24h: -0.5 },
    { symbol: 'XRPUSDT', price: 2.45, change24h: 1.2 },
    { symbol: 'ADAUSDT', price: 1.05, change24h: -0.8 },
    { symbol: 'HBARUSDT', price: 0.28, change24h: 3.5 }
  ];
}

// Main fallback function that tries all sources
export async function fetchCryptoPricesWithFallback(): Promise<CryptoPrice[]> {
  console.log('🔄 Attempting to fetch crypto prices with fallback...');

  // Try Bybit first
  try {
    console.log('📡 Trying Bybit API...');
    const bybitPrices = await fetchBybitPrices();
    if (bybitPrices.length >= 3) {
      console.log(`✅ Bybit API success: ${bybitPrices.length} prices fetched`);
      return bybitPrices;
    }
  } catch (error) {
    console.log('❌ Bybit API failed');
  }

  // Try KuCoin second
  try {
    console.log('📡 Trying KuCoin API...');
    const kucoinPrices = await fetchKuCoinPrices();
    if (kucoinPrices.length >= 3) {
      console.log(`✅ KuCoin API success: ${kucoinPrices.length} prices fetched`);
      return kucoinPrices;
    }
  } catch (error) {
    console.log('❌ KuCoin API failed');
  }

  // Use mock data as last resort
  console.log('⚠️ All APIs failed, using mock data');
  return getMockPrices();
}