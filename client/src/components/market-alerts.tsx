import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { MarketAlert } from "@shared/schema";

const getAlertColor = (type: string) => {
  switch (type) {
    case "price_above":
      return "bg-neon-green";
    case "price_below":
      return "bg-neon-cyan";
    case "volume_spike":
      return "bg-neon-pink";
    default:
      return "bg-gray-500";
  }
};

export default function MarketAlerts() {
  const { data: alerts, isLoading } = useQuery<MarketAlert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="neon-border glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white">Market Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 glass-effect rounded-lg">
                <div className="w-2 h-2 bg-gray-700 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="neon-border glass-effect">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-white">Market Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts?.map((alert) => {
            const colorClass = getAlertColor(alert.type);
            
            return (
              <div key={alert.id} className="flex items-center space-x-3 p-3 glass-effect rounded-lg">
                <div className={`w-2 h-2 ${colorClass} rounded-full animate-pulse`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{alert.message}</div>
                  <div className="text-xs text-gray-400">
                    {alert.type === "price_above" && "Price target reached"}
                    {alert.type === "price_below" && `Price approaching $${alert.targetValue}`}
                    {alert.type === "volume_spike" && "Unusual trading activity"}
                  </div>
                </div>
              </div>
            );
          })}
          
          {(!alerts || alerts.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-400">No active alerts</p>
            </div>
          )}
        </div>
        
        <Button className="w-full mt-4 bg-neon-green text-black hover:bg-neon-green/80 font-medium">
          <Plus className="w-4 h-4 mr-2" />
          Add Alert
        </Button>
      </CardContent>
    </Card>
  );
}
