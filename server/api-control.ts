import { createHash } from 'crypto';

// Control variables for cryptocurrency API calls
let lastApiCall = 0;
const API_CALL_INTERVAL = 0; // Disable throttling for real-time prices
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 0; // Disable caching for real-time prices

// Control variables for intensive calculations
let lastCalculationCall = 0;
const CALCULATION_INTERVAL = 1000; // Reduce to 1 second for better responsiveness
const calculationCache = new Map<string, { result: any; timestamp: number }>();
const CALCULATION_CACHE_DURATION = 30000; // Increase to 30 seconds cache

export function shouldCallApi(): boolean {
  const now = Date.now();
  if (now - lastApiCall >= API_CALL_INTERVAL) {
    lastApiCall = now;
    return true;
  }
  return false;
}

export function shouldRunCalculation(): boolean {
  const now = Date.now();
  if (now - lastCalculationCall >= CALCULATION_INTERVAL) {
    lastCalculationCall = now;
    return true;
  }
  return false;
}

export async function callApiWithControl<T>(
  cacheKey: string,
  apiFunction: () => Promise<T>
): Promise<T | null> {
  const now = Date.now();
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Using cached API data for ${cacheKey}`);
    return cached.data;
  }

  // Check throttle - allow more calls to restore functionality
  if (!shouldCallApi()) {
    console.log(`⏳ API throttled for ${cacheKey}, using cached data if available`);
    // If no cached data and this is critical, allow the call anyway
    if (!cached?.data) {
      console.log(`🚨 No cached data available for ${cacheKey}, forcing API call`);
      lastApiCall = Date.now();
    } else {
      return cached.data;
    }
  }

  try {
    console.log(`🌐 Making fresh API call for ${cacheKey}`);
    const result = await apiFunction();
    
    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: now });
    
    // Clean old cache entries
    cleanCache();
    
    return result;
  } catch (error) {
    console.error(`❌ API call failed for ${cacheKey}:`, error);
    // Return cached data if available during error
    return cached?.data || null;
  }
}

export async function runCalculationWithControl<T>(
  prompt: string,
  calculationFunction: () => Promise<T>
): Promise<T | null> {
  const now = Date.now();
  const key = createHash('sha256').update(prompt).digest('hex').substring(0, 16);

  // Check cache first
  const cached = calculationCache.get(key);
  if (cached && now - cached.timestamp < CALCULATION_CACHE_DURATION) {
    console.log(`🧠 Using cached calculation for ${key}`);
    return cached.result;
  }

  // Check throttle
  if (!shouldRunCalculation()) {
    console.log(`⏳ Calculation throttled for ${key}, using cached result if available`);
    return cached?.result || null;
  }

  try {
    console.log(`🔧 Running fresh calculation for ${key}`);
    const result = await calculationFunction();
    
    // Cache the result
    calculationCache.set(key, { result, timestamp: now });
    
    // Clean old cache entries
    cleanCalculationCache();
    
    return result;
  } catch (error) {
    console.error(`❌ Calculation failed for ${key}:`, error);
    return cached?.result || null;
  }
}

function cleanCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_DURATION * 2) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => cache.delete(key));
}

function cleanCalculationCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  calculationCache.forEach((value, key) => {
    if (now - value.timestamp > CALCULATION_CACHE_DURATION * 2) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => calculationCache.delete(key));
}

// Rate limiting for frontend requests
const userRequestLimits = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 100;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

export function checkRateLimit(userId: string = 'default'): boolean {
  const now = Date.now();
  const userLimit = userRequestLimits.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    userRequestLimits.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  userLimit.count++;
  return true;
}

export function getRemainingRequests(userId: string = 'default'): number {
  const userLimit = userRequestLimits.get(userId);
  if (!userLimit || Date.now() > userLimit.resetTime) {
    return MAX_REQUESTS_PER_MINUTE;
  }
  return Math.max(0, MAX_REQUESTS_PER_MINUTE - userLimit.count);
}