import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { cryptoService } from "@/lib/crypto-service";
import type { Transaction } from "@shared/schema";

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "buy":
      return { icon: ArrowUp, color: "bg-green-500" };
    case "sell":
      return { icon: ArrowDown, color: "bg-red-500" };
    case "swap":
      return { icon: RefreshCw, color: "bg-blue-500" };
    default:
      return { icon: ArrowUp, color: "bg-gray-500" };
  }
};

export default function RecentTransactions() {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="neon-border glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 glass-effect rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse"></div>
                  <div>
                    <div className="h-4 bg-gray-700 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-gray-700 rounded w-12 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transactions?.length) {
    return (
      <Card className="neon-border glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400">No transactions found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="neon-border glass-effect">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-white">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => {
            const { icon: Icon, color } = getTransactionIcon(transaction.type);
            
            return (
              <div key={transaction.id} className="flex items-center justify-between p-3 glass-effect rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center`}>
                    <Icon className="text-white w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white capitalize">
                      {transaction.type} {transaction.symbol}
                    </div>
                    <div className="text-xs text-gray-400">
                      {cryptoService.getTimeAgo(new Date(transaction.createdAt))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {parseFloat(transaction.amount).toFixed(4)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {cryptoService.formatPrice(transaction.total)}
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
