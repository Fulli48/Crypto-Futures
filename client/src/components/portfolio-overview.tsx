import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ChartLine, TrendingUp, Coins, Star } from "lucide-react";
import { cryptoService } from "@/lib/crypto-service";
import type { PortfolioOverview } from "@shared/schema";

export default function PortfolioOverview() {
  const { data: overview, isLoading } = useQuery<PortfolioOverview>({
    queryKey: ["/api/portfolio/overview"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="neon-border glass-effect">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!overview) return null;

  const portfolioCards = [
    {
      title: "Total Portfolio Value",
      value: cryptoService.formatPrice(overview.totalValue),
      change: cryptoService.formatChange(overview.dailyPLPercentage),
      icon: ChartLine,
      isPositive: overview.dailyPLPercentage >= 0,
    },
    {
      title: "24h P&L",
      value: cryptoService.formatPrice(overview.dailyPL),
      change: cryptoService.formatChange(overview.dailyPLPercentage),
      icon: TrendingUp,
      isPositive: overview.dailyPL >= 0,
    },
    {
      title: "Active Positions",
      value: overview.activePositions.toString(),
      change: "cryptocurrencies",
      icon: Coins,
      isPositive: true,
    },
    {
      title: "Best Performer",
      value: overview.bestPerformer.symbol,
      change: cryptoService.formatChange(overview.bestPerformer.change),
      icon: Star,
      isPositive: overview.bestPerformer.change >= 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {portfolioCards.map((card, index) => (
        <Card key={index} className="neon-border glass-effect">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">{card.title}</h3>
              <card.icon className="text-neon-green w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-white glow-text">{card.value}</div>
            <div className="flex items-center mt-2">
              <span className={`text-sm ${card.isPositive ? 'price-up' : 'price-down'} ${card.isPositive ? 'glow-text' : ''}`}>
                {card.change}
              </span>
              <span className="text-xs text-gray-400 ml-2">
                {card.title === "Active Positions" ? "" : card.title === "Best Performer" ? "24h" : "change"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
