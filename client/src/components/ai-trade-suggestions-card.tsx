import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Target, 
  Shield, 
  DollarSign, 
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import TradeSuggestions from './TradeSuggestions';

interface AITradeSuggestionsCardProps {
  className?: string;
}

export const AITradeSuggestionsCard: React.FC<AITradeSuggestionsCardProps> = ({ 
  className = "" 
}) => {
  return (
    <div className={`section-container ${className}`} data-testid="ai-trade-suggestions-card">
      <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-purple-600/30 to-blue-600/30 border-2 border-purple-500/40 flex-shrink-0 shadow-lg">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-purple-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-purple-400 via-purple-300 to-blue-400 bg-clip-text text-transparent mb-2 truncate leading-tight">AI Trade Suggestions</h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium line-clamp-2 tracking-wide">Machine learning powered trade recommendations with technical analysis</p>
          </div>
        </div>
      </div>
      
      <div className="w-full">
        <TradeSuggestions />
      </div>

      <style>{`
        .ai-trade-suggestions-card .section-container {
          background: linear-gradient(135deg, 
            rgba(15, 23, 42, 0.95) 0%, 
            rgba(30, 41, 59, 0.85) 50%, 
            rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(12px);
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.3),
            0 2px 4px -1px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          position: relative;
          overflow: hidden;
        }

        .ai-trade-suggestions-card .section-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(59, 130, 246, 0.3) 20%, 
            rgba(59, 130, 246, 0.6) 50%, 
            rgba(59, 130, 246, 0.3) 80%, 
            transparent 100%);
        }

        .ai-trade-suggestions-card .section-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 50% 0%, 
            rgba(59, 130, 246, 0.03) 0%, 
            transparent 70%);
          pointer-events: none;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .ai-trade-suggestions-card .section-container {
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AITradeSuggestionsCard;