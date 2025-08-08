import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Database, Clock, TrendingUp } from "lucide-react";
import axios from "axios";

interface LearningAnalytics {
  totalAnalyzedTrades: number;
  shortTypeAnalyzed: number;
  mediumTypeAnalyzed: number;
  longTypeAnalyzed: number;
  lastAnalyzedAt: string | null;
  message: string;
}

export const LearningAnalytics = () => {
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get('/api/learning/analytics');
        setAnalytics(response.data);
      } catch (error) {
        console.error('Error fetching learning analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    // Update every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !analytics) {
    return (
      <Card className="bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-300 dark:text-slate-300 text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-400" />
            Learning Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400 dark:text-slate-500">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="section-container">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold text-white">Learning Analytics</h2>
      </div>
        {/* Total Analyzed Trades */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-green-400" />
            <span className="text-slate-300 dark:text-slate-300 text-sm">Analyzed Trades</span>
          </div>
          <Badge variant="outline" className="bg-green-500/10 border-green-500 text-green-400">
            {analytics.totalAnalyzedTrades.toLocaleString()}
          </Badge>
        </div>

        {/* Breakdown by Type */}
        <div className="space-y-2">
          <div className="text-slate-400 dark:text-slate-500 text-xs font-medium">Breakdown by Duration:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="stat-card !min-w-0">
              <div className="stat-value text-orange-500">
                {analytics.shortTypeAnalyzed}
              </div>
              <div className="stat-label">SHORT</div>
            </div>
            <div className="stat-card !min-w-0">
              <div className="stat-value text-yellow-500">
                {analytics.mediumTypeAnalyzed}
              </div>
              <div className="stat-label">MEDIUM</div>
            </div>
            <div className="stat-card !min-w-0">
              <div className="stat-value text-green-500">
                {analytics.longTypeAnalyzed}
              </div>
              <div className="stat-label">LONG</div>
            </div>
          </div>
        </div>

        {/* Last Analyzed Time */}
        {analytics.lastAnalyzedAt && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-slate-400 dark:text-slate-500 text-xs">
              Last analysis: {new Date(analytics.lastAnalyzedAt).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* System Message */}
        <div className="bg-slate-700 dark:bg-slate-800 rounded p-3">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="text-slate-300 dark:text-slate-300 text-xs leading-relaxed">
              {analytics.message}
            </div>
          </div>
        </div>
    </div>
  );
};