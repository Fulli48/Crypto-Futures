import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cryptoService } from "@/lib/crypto-service";

interface HoldingWithCrypto {
  id: number;
  userId: number;
  symbol: string;
  amount: string;
  averagePrice: string;
  currentPrice: string;
  value: number;
  change24h: number;
  crypto: any;
}

const getCryptoIcon = (symbol: string) => {
  const icons: Record<string, { color: string; icon: string }> = {
    BTC: { color: "bg-orange-500", icon: "₿" },
    ETH: { color: "bg-blue-500", icon: "Ξ" },
    SOL: { color: "bg-purple-500", icon: "SOL" },
    ADA: { color: "bg-blue-600", icon: "ADA" },
  };
  return icons[symbol] || { color: "bg-gray-500", icon: symbol };
};

export default function PortfolioHoldings() {
  const { data: holdings, isLoading } = useQuery<HoldingWithCrypto[]>({
    queryKey: ["/api/portfolio/holdings"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="neon-border glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Portfolio Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 glass-effect rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                  <div>
                    <div className="h-4 bg-gray-700 rounded w-12 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!holdings?.length) {
    return (
      <Card className="neon-border glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Portfolio Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400">No holdings found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="neon-border glass-effect">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-white">Portfolio Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {holdings.map((holding) => {
            const { color, icon } = getCryptoIcon(holding.symbol);
            const isPositive = holding.change24h >= 0;
            
            return (
              <div key={holding.id} className="flex items-center justify-between p-3 glass-effect rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{icon}</span>
                  </div>
                  <div>
                    <div className="font-medium text-white">{holding.symbol}</div>
                    <div className="text-xs text-gray-400">{parseFloat(holding.amount).toFixed(4)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {cryptoService.formatPrice(holding.value)}
                  </div>
                  <div className={`text-xs ${isPositive ? 'price-up glow-text' : 'price-down'}`}>
                    {cryptoService.formatChange(holding.change24h)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
