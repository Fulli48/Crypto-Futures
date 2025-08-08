import { Card, CardContent } from "@/components/ui/card";
import { cryptoService } from "@/lib/crypto-service";
import type { Cryptocurrency } from "@shared/schema";
import { IdealEntryBadge } from "./ideal-entry-badge";

interface CryptoCardProps {
  crypto: Cryptocurrency;
  logoColor: string;
  logoIcon: string;
  onClick?: () => void;
}

export default function CryptoCard({ crypto, logoColor, logoIcon, onClick }: CryptoCardProps) {
  const isPositive = parseFloat(crypto.change24h) >= 0;

  return (
    <Card className="coinbase-card cursor-pointer" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${logoColor} rounded-full flex items-center justify-center`}>
              <span className="text-white text-lg font-bold">{logoIcon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-foreground coinbase-text-base">{crypto.name}</h3>
              <p className="text-sm text-muted-foreground">{crypto.symbol}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {cryptoService.formatPrice(crypto.price)}
            </div>
            <div className={`text-sm font-medium ${isPositive ? 'text-coinbase-green' : 'text-coinbase-red'}`}>
              {cryptoService.formatChange(crypto.change24h)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground coinbase-text-sm">Market Cap</span>
            <div className="font-medium text-foreground">
              {cryptoService.formatVolume(crypto.marketCap)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground coinbase-text-sm">24h Volume</span>
            <div className="font-medium text-foreground">
              {cryptoService.formatVolume(crypto.volume24h)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
