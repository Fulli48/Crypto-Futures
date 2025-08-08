// Safe formatting functions to prevent toFixed errors
export const safeToFixed = (value: any, decimals: number = 2): string => {
  try {
    if (value === null || value === undefined || value === '') return '0';
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (isNaN(num)) return '0';
      return num.toFixed(decimals);
    }
    if (typeof value === 'number') {
      if (isNaN(value)) return '0';
      return value.toFixed(decimals);
    }
    return '0';
  } catch (error) {
    console.error('Error in safeToFixed:', error, 'value:', value);
    return '0';
  }
};

export const safePrice = (value: any): string => {
  try {
    if (value === null || value === undefined || value === '') return '$0';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0';
    
    // Format based on price magnitude to avoid excessive decimal places
    if (num >= 1000) {
      return `$${Math.round(num).toLocaleString()}`; // No decimals for $1000+ with commas
    } else if (num >= 100) {
      return `$${num.toFixed(1)}`; // 1 decimal for $100-$999
    } else if (num >= 1) {
      return `$${num.toFixed(2)}`; // 2 decimals for $1-$99
    } else if (num >= 0.1) {
      return `$${num.toFixed(3)}`; // 3 decimals for $0.10-$0.99
    } else {
      return `$${num.toFixed(4)}`; // 4 decimals for < $0.10
    }
  } catch (error) {
    console.error('Error in safePrice:', error, 'value:', value);
    return '$0';
  }
};

export const safePercentage = (value: any): string => {
  const formatted = safeToFixed(value, 2);
  const num = parseFloat(formatted);
  return `${num > 0 ? '+' : ''}${formatted}%`;
};