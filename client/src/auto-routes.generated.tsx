import React from "react";
import { Switch, Route } from "wouter";
import binancedashboardbackup from "@/pages/binance-dashboard-backup";
import binancedashboardbroken from "@/pages/binance-dashboard-broken";
import binancedashboard from "@/pages/binance-dashboard";

export function AppRoutes() {
  return (
    <Switch>
        <Route path={"/binance-dashboard-backup"} component={binancedashboardbackup} />
        <Route path={"/binance-dashboard-broken"} component={binancedashboardbroken} />
        <Route path={"/binance-dashboard"} component={binancedashboard} />
    </Switch>
  );
}

export function AppNav() {
  return (
    <nav className="w-full border-b border-border/40 px-4 py-2 text-sm flex gap-2">
        <a href={"/binance-dashboard-backup"} className="px-3 py-2 hover:underline">binance-dashboard-backup</a>
        <a href={"/binance-dashboard-broken"} className="px-3 py-2 hover:underline">binance-dashboard-broken</a>
        <a href={"/binance-dashboard"} className="px-3 py-2 hover:underline">binance-dashboard</a>
    </nav>
  );
}
