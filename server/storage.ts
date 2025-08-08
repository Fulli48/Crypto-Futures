import { 
  users, 
  cryptocurrencies,
  portfolioHoldings,
  transactions,
  marketAlerts,
  type User, 
  type InsertUser,
  type Cryptocurrency,
  type PortfolioHolding,
  type Transaction,
  type MarketAlert,
  type InsertCryptocurrency,
  type InsertPortfolioHolding,
  type InsertTransaction,
  type InsertMarketAlert,
  type PortfolioOverview
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Cryptocurrency methods
  getAllCryptocurrencies(): Promise<Cryptocurrency[]>;
  getCryptocurrency(symbol: string): Promise<Cryptocurrency | undefined>;
  updateCryptocurrency(symbol: string, data: Partial<InsertCryptocurrency>): Promise<Cryptocurrency>;
  createCryptocurrency(data: InsertCryptocurrency): Promise<Cryptocurrency>;
  
  // Portfolio methods
  getPortfolioHoldings(userId: number): Promise<PortfolioHolding[]>;
  getPortfolioOverview(userId: number): Promise<PortfolioOverview>;
  updateHolding(userId: number, symbol: string, data: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding>;
  
  // Transaction methods
  getRecentTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  
  // Market alert methods
  getMarketAlerts(userId: number): Promise<MarketAlert[]>;
  createMarketAlert(data: InsertMarketAlert): Promise<MarketAlert>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private cryptocurrencies: Map<string, Cryptocurrency>;
  private portfolioHoldings: Map<string, PortfolioHolding>;
  private transactions: Map<number, Transaction>;
  private marketAlerts: Map<number, MarketAlert>;
  private currentUserId: number;
  private currentCryptoId: number;
  private currentHoldingId: number;
  private currentTransactionId: number;
  private currentAlertId: number;

  constructor() {
    this.users = new Map();
    this.cryptocurrencies = new Map();
    this.portfolioHoldings = new Map();
    this.transactions = new Map();
    this.marketAlerts = new Map();
    this.currentUserId = 1;
    this.currentCryptoId = 1;
    this.currentHoldingId = 1;
    this.currentTransactionId = 1;
    this.currentAlertId = 1;
    
    this.initializeMockData();
  }

  private initializeMockData() {
    // Initialize cryptocurrencies
    const cryptos: InsertCryptocurrency[] = [
      {
        symbol: "BTC",
        name: "Bitcoin",
        price: "43287.92",
        marketCap: "847200000000",
        volume24h: "28400000000",
        change24h: "5.72",
        logoUrl: null
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        price: "2689.45",
        marketCap: "323400000000",
        volume24h: "15200000000",
        change24h: "3.21",
        logoUrl: null
      },
      {
        symbol: "SOL",
        name: "Solana",
        price: "98.72",
        marketCap: "44200000000",
        volume24h: "2800000000",
        change24h: "-2.14",
        logoUrl: null
      },
      {
        symbol: "ADA",
        name: "Cardano",
        price: "0.4921",
        marketCap: "17300000000",
        volume24h: "892000000",
        change24h: "7.83",
        logoUrl: null
      }
    ];

    cryptos.forEach(crypto => {
      const id = this.currentCryptoId++;
      this.cryptocurrencies.set(crypto.symbol, {
        id,
        ...crypto,
        lastUpdated: new Date()
      });
    });

    // Initialize portfolio holdings for user 1
    const holdings: InsertPortfolioHolding[] = [
      {
        userId: 1,
        symbol: "BTC",
        amount: "0.2843",
        averagePrice: "42000.00"
      },
      {
        userId: 1,
        symbol: "ETH",
        amount: "4.7521",
        averagePrice: "2600.00"
      },
      {
        userId: 1,
        symbol: "SOL",
        amount: "124.32",
        averagePrice: "95.00"
      }
    ];

    holdings.forEach(holding => {
      const id = this.currentHoldingId++;
      const key = `${holding.userId}-${holding.symbol}`;
      this.portfolioHoldings.set(key, {
        id,
        ...holding,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Initialize transactions
    const txns: InsertTransaction[] = [
      {
        userId: 1,
        symbol: "BTC",
        type: "buy",
        amount: "0.0234",
        price: "43250.00",
        total: "1012.34"
      },
      {
        userId: 1,
        symbol: "ETH",
        type: "sell",
        amount: "1.2500",
        price: "2689.25",
        total: "3361.56"
      },
      {
        userId: 1,
        symbol: "ADA",
        type: "swap",
        amount: "2000",
        price: "0.4921",
        total: "984.20"
      }
    ];

    txns.forEach(txn => {
      const id = this.currentTransactionId++;
      this.transactions.set(id, {
        id,
        ...txn,
        createdAt: new Date()
      });
    });

    // Initialize market alerts
    const alerts: InsertMarketAlert[] = [
      {
        userId: 1,
        symbol: "BTC",
        type: "price_above",
        targetValue: "43000.00",
        isActive: true,
        message: "BTC Above $43,000"
      },
      {
        userId: 1,
        symbol: "ETH",
        type: "volume_spike",
        targetValue: "15000000000",
        isActive: true,
        message: "ETH Volume Spike"
      },
      {
        userId: 1,
        symbol: "SOL",
        type: "price_below",
        targetValue: "95.00",
        isActive: true,
        message: "SOL Support Level"
      }
    ];

    alerts.forEach(alert => {
      const id = this.currentAlertId++;
      this.marketAlerts.set(id, {
        id,
        ...alert,
        createdAt: new Date()
      });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllCryptocurrencies(): Promise<Cryptocurrency[]> {
    return Array.from(this.cryptocurrencies.values());
  }

  async getCryptocurrency(symbol: string): Promise<Cryptocurrency | undefined> {
    return this.cryptocurrencies.get(symbol);
  }

  async updateCryptocurrency(symbol: string, data: Partial<InsertCryptocurrency>): Promise<Cryptocurrency> {
    const existing = this.cryptocurrencies.get(symbol);
    if (!existing) {
      throw new Error(`Cryptocurrency ${symbol} not found`);
    }
    
    const updated = { ...existing, ...data, lastUpdated: new Date() };
    this.cryptocurrencies.set(symbol, updated);
    return updated;
  }

  async createCryptocurrency(data: InsertCryptocurrency): Promise<Cryptocurrency> {
    const id = this.currentCryptoId++;
    const crypto: Cryptocurrency = {
      id,
      ...data,
      lastUpdated: new Date()
    };
    this.cryptocurrencies.set(data.symbol, crypto);
    return crypto;
  }

  async getPortfolioHoldings(userId: number): Promise<PortfolioHolding[]> {
    return Array.from(this.portfolioHoldings.values()).filter(h => h.userId === userId);
  }

  async getPortfolioOverview(userId: number): Promise<PortfolioOverview> {
    const holdings = await this.getPortfolioHoldings(userId);
    let totalValue = 0;
    let totalCost = 0;
    let bestPerformer = { symbol: "", change: 0 };

    for (const holding of holdings) {
      const crypto = this.cryptocurrencies.get(holding.symbol);
      if (crypto) {
        const currentPrice = parseFloat(crypto.price);
        const holdingValue = parseFloat(holding.amount) * currentPrice;
        const cost = parseFloat(holding.amount) * parseFloat(holding.averagePrice);
        
        totalValue += holdingValue;
        totalCost += cost;

        const change = parseFloat(crypto.change24h);
        if (change > bestPerformer.change) {
          bestPerformer = { symbol: holding.symbol, change };
        }
      }
    }

    const dailyPL = totalValue - totalCost;
    const dailyPLPercentage = totalCost > 0 ? (dailyPL / totalCost) * 100 : 0;

    return {
      totalValue,
      dailyPL,
      dailyPLPercentage,
      activePositions: holdings.length,
      bestPerformer
    };
  }

  async updateHolding(userId: number, symbol: string, data: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding> {
    const key = `${userId}-${symbol}`;
    const existing = this.portfolioHoldings.get(key);
    if (!existing) {
      throw new Error(`Holding ${symbol} not found for user ${userId}`);
    }
    
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.portfolioHoldings.set(key, updated);
    return updated;
  }

  async getRecentTransactions(userId: number, limit: number = 10): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = {
      id,
      ...data,
      createdAt: new Date()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getMarketAlerts(userId: number): Promise<MarketAlert[]> {
    return Array.from(this.marketAlerts.values())
      .filter(a => a.userId === userId && a.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createMarketAlert(data: InsertMarketAlert): Promise<MarketAlert> {
    const id = this.currentAlertId++;
    const alert: MarketAlert = {
      id,
      ...data,
      createdAt: new Date()
    };
    this.marketAlerts.set(id, alert);
    return alert;
  }
}

export const storage = new MemStorage();
