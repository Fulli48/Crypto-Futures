import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import MiniChart from "@/components/mini-chart";
import { safePrice } from "@/lib/safe-format";

interface SafeCryptoCardProps {
  crypto: any;
  onClick: () => void;
  getSignalColor: (signal: string) => string;
  getProfitLikelihoodColor: (profitLikelihood: number) => string;
  getProfitWindowColor: (profitWindow: number) => string;
}

export function SafeCryptoCard({
  crypto,
  onClick,
  getSignalColor,
  getProfitLikelihoodColor,
  getProfitWindowColor
}: SafeCryptoCardProps) {
  try {
    // Ensure all data is safe before rendering
    const safeSymbol = crypto?.symbol || 'UNKNOWN';
    const safeSignal = crypto?.signal || 'NO DATA';
    const safeProfitLikelihood = typeof crypto?.profitLikelihood === 'number' ? crypto.profitLikelihood : 0;
    const safeProfitWindow = typeof crypto?.profit_window_percentage === 'number' ? crypto.profit_window_percentage : 
                             typeof crypto?.profitablePercentage === 'string' ? parseFloat(crypto.profitablePercentage) : 50;
    const safeCurrentPrice = crypto?.currentPrice || 0;

    return (
      <Card
        className="coinbase-card cursor-pointer relative overflow-hidden min-h-[180px] sm:min-h-[200px] h-full"
        onClick={onClick}
        data-testid={`crypto-card-${safeSymbol.toLowerCase()}`}
      >
        <MiniChart symbol={safeSymbol} signal={safeSignal} isBackground={true} />
        
        <CardContent className="p-3 sm:p-4 relative z-10 flex flex-col h-full">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <span className="font-bold text-foreground text-sm sm:text-base truncate max-w-[60%]">
              {safeSymbol.replace('USDT', '')}
            </span>
            <div className="text-xs sm:text-sm font-semibold text-foreground text-right">
              {safePrice(safeCurrentPrice)}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-start">
            <div className="space-y-1.5 sm:space-y-2 w-full">
              <Badge className={`text-xs border border-coinbase-blue/30 ${getProfitLikelihoodColor(safeProfitLikelihood)} font-semibold w-full justify-center`}>
                <span className="hidden sm:inline">Profit: </span>{safeProfitLikelihood}%
              </Badge>
              <Badge className={`text-xs border border-coinbase-blue/30 ${getProfitWindowColor(safeProfitWindow)} font-semibold w-full justify-center`}>
                <span className="hidden sm:inline">Profit Window: </span>{safeProfitWindow.toFixed(1)}%
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3">
            <span className={`text-xs sm:text-sm font-bold ${getSignalColor(safeSignal)} coinbase-button-primary`}>
              {safeSignal}
            </span>
            {safeSignal === "LONG" ? (
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-coinbase-green" />
            ) : safeSignal === "SHORT" ? (
              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-coinbase-red" />
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  } catch (error) {
    console.error('Error rendering crypto card:', error, crypto);
    return (
      <Card className="glass-effect crypto-card cursor-pointer">
        <CardContent className="p-4">
          <div className="text-center text-gray-400">Error loading crypto data</div>
        </CardContent>
      </Card>
    );
  }
}