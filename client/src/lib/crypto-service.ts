import { queryClient } from "./queryClient";

export const cryptoService = {
  // Simulate real-time price updates
  startPriceUpdates: () => {
    const updatePrices = async () => {
      try {
        const response = await fetch("/api/cryptocurrencies/update-prices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (response.ok) {
          // Invalidate all crypto-related queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ["/api/cryptocurrencies"] });
          queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
        }
      } catch (error) {
        console.error("Failed to update prices:", error);
      }
    };

    // Update prices every 30 seconds
    const interval = setInterval(updatePrices, 30000);
    
    return () => clearInterval(interval);
  },

  formatPrice: (price: string | number): string => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    
    if (numPrice >= 10000) {
      // For very large prices (like BTC), show no decimals with commas
      return `$${numPrice.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    } else if (numPrice >= 1000) {
      // For prices in thousands, show 2 decimals with commas
      return `$${numPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (numPrice >= 100) {
      // For prices 100-999, show 2 decimals with commas
      return `$${numPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    } else if (numPrice >= 1) {
      // For prices between 1-99, show 4 decimals
      return `$${numPrice.toFixed(4)}`;
    } else {
      // For prices under 1, show more decimals
      return `$${numPrice.toFixed(8)}`;
    }
  },

  formatChange: (change: string | number): string => {
    const numChange = typeof change === "string" ? parseFloat(change) : change;
    const sign = numChange >= 0 ? "+" : "";
    return `${sign}${numChange.toFixed(2)}%`;
  },

  formatVolume: (volume: string | number): string => {
    const numVolume = typeof volume === "string" ? parseFloat(volume) : volume;
    
    if (numVolume >= 1e9) {
      return `$${(numVolume / 1e9).toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}B`;
    } else if (numVolume >= 1e6) {
      return `$${(numVolume / 1e6).toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}M`;
    } else if (numVolume >= 1e3) {
      return `$${(numVolume / 1e3).toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}K`;
    } else {
      return `$${numVolume.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  },

  getTimeAgo: (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return `${diffDays} days ago`;
    }
  },
};
