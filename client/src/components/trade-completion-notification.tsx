import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface CompletedTrade {
  id: number;
  symbol: string;
  simulationType: 'SHORT' | 'MEDIUM' | 'LONG';
  outcome: string;
  profitLoss: number;
  duration: string;
}

interface TradeCompletionNotificationProps {
  completedTrades: CompletedTrade[];
  onDismiss: (tradeId: number) => void;
}

const getDurationLabel = (simulationType: 'SHORT' | 'MEDIUM' | 'LONG') => {
  switch (simulationType) {
    case 'SHORT': return '5min';
    case 'MEDIUM': return '10min';
    case 'LONG': return '15min';
  }
};

const getOutcomeIcon = (outcome: string, profitLoss: number) => {
  if (outcome === 'TP_HIT' || profitLoss > 0) {
    return <CheckCircle className="w-5 h-5 text-green-300" />;
  } else if (outcome === 'SL_HIT' || profitLoss < 0) {
    return <XCircle className="w-5 h-5 text-red-300" />;
  } else {
    return <Clock className="w-5 h-5 text-yellow-300" />;
  }
};

const getOutcomeColor = (outcome: string, profitLoss: number) => {
  if (outcome === 'TP_HIT' || profitLoss > 0) {
    return 'border-green-400/20 bg-green-400/5';
  } else if (outcome === 'SL_HIT' || profitLoss < 0) {
    return 'border-red-400/20 bg-red-400/5';
  } else {
    return 'border-yellow-400/20 bg-yellow-400/5';
  }
};

export function TradeCompletionNotification({ 
  completedTrades, 
  onDismiss 
}: TradeCompletionNotificationProps) {
  const [visibleTrades, setVisibleTrades] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Show new completed trades
    const newTradeIds = completedTrades.map(t => t.id).filter(id => !visibleTrades.has(id));
    if (newTradeIds.length > 0) {
      setVisibleTrades(prev => new Set([...Array.from(prev), ...newTradeIds]));
      
      // Auto-dismiss after 4 seconds for smaller notifications
      newTradeIds.forEach(tradeId => {
        setTimeout(() => {
          setVisibleTrades(prev => {
            const updated = new Set(prev);
            updated.delete(tradeId);
            return updated;
          });
          onDismiss(tradeId);
        }, 4000);
      });
    }
  }, [completedTrades, visibleTrades, onDismiss]);

  const visibleTradesList = completedTrades.filter(trade => visibleTrades.has(trade.id));

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {visibleTradesList.map((trade) => (
          <motion.div
            key={trade.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              duration: 0.5
            }}
            className={`
              min-w-[200px] max-w-sm p-3 rounded-lg border backdrop-blur-lg
              ${getOutcomeColor(trade.outcome, trade.profitLoss)}
              shadow-lg pointer-events-auto cursor-pointer
              hover:scale-105 transition-all duration-200
            `}
            onClick={() => {
              setVisibleTrades(prev => {
                const updated = new Set(prev);
                updated.delete(trade.id);
                return updated;
              });
              onDismiss(trade.id);
            }}
          >
            <div className="flex items-center gap-2">
              {getOutcomeIcon(trade.outcome, trade.profitLoss)}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-bold text-white mb-1">
                  <span className="bg-blue-500/30 px-1.5 py-0.5 rounded text-xs text-blue-200">
                    {getDurationLabel(trade.simulationType)}
                  </span>
                  <span>{trade.symbol}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      trade.profitLoss >= 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {trade.profitLoss >= 0 ? 'PROFIT' : 'LOSS'}
                    </span>
                    <span className={`text-sm font-bold ${
                      trade.profitLoss >= 0 ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)}%
                    </span>
                  </div>
                  
                  <span className="text-xs text-gray-300 bg-white/10 px-1.5 py-0.5 rounded">
                    {trade.duration}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}