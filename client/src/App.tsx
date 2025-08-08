import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import BinanceDashboard from "@/pages/binance-dashboard";
import { queryClient } from "@/lib/queryClient";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-cyan-900/20">
        <Switch>
          <Route path="/" component={BinanceDashboard} />
        </Switch>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}