import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartLine } from "lucide-react";

const timeIntervals = [
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d", active: true },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
];

export default function PriceChart() {
  const [activeInterval, setActiveInterval] = useState("1d");

  return (
    <Card className="neon-border glass-effect">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white">Bitcoin Price Chart</CardTitle>
          <div className="flex space-x-2">
            {timeIntervals.map((interval) => (
              <Button
                key={interval.value}
                variant={activeInterval === interval.value ? "default" : "ghost"}
                size="sm"
                className={
                  activeInterval === interval.value
                    ? "bg-neon-green text-black hover:bg-neon-green/80"
                    : "glass-effect text-gray-400 hover:text-white"
                }
                onClick={() => setActiveInterval(interval.value)}
              >
                {interval.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="chart-container rounded-lg p-4 h-64 flex items-center justify-center bg-gradient-to-br from-slate-900/90 to-slate-800/90">
          <div className="text-center">
            <ChartLine className="text-neon-green text-4xl mb-4 mx-auto" />
            <p className="text-gray-400">Interactive price chart will be implemented here</p>
            <p className="text-sm text-gray-500 mt-2">Real-time data visualization with candlestick patterns</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
