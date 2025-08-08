import { useState, useEffect } from "react";
import { Brain, TrendingUp, BarChart3, Zap, Bot, Database } from "lucide-react";
import axios from "axios";

interface TrainingMetrics {
  trainingCycles: number;
  lastTrainingTime: number;
  weightAdjustments: number;
  activeModels: number;
  confidence: number;
}

interface ConfidenceMetrics {
  averageConfidence: number;
  confidenceRange: {
    min: number;
    max: number;
  };
  symbols: number;
  learningActive: boolean;
}

export const LiveLearningMetrics = () => {
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics | null>(null);
  const [confidenceMetrics, setConfidenceMetrics] = useState<ConfidenceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [trainingResponse, confidenceResponse] = await Promise.all([
          axios.get('/api/learning/training-cycles'),
          axios.get('/api/learning/confidence-metrics')
        ]);
        
        setTrainingMetrics(trainingResponse.data);
        setConfidenceMetrics(confidenceResponse.data);
      } catch (error) {
        console.error('Error fetching learning metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Update every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <>
        <div className="stat-card animate-pulse">
          <div className="stat-label">Training Cycles</div>
          <div className="h-6 bg-muted rounded w-8 mx-auto"></div>
        </div>
        <div className="stat-card animate-pulse">
          <div className="stat-label">System Confidence</div>
          <div className="h-6 bg-muted rounded w-12 mx-auto"></div>
        </div>
        <div className="stat-card animate-pulse">
          <div className="stat-label">Active Models</div>
          <div className="h-6 bg-muted rounded w-4 mx-auto"></div>
        </div>
        <div className="stat-card animate-pulse">
          <div className="stat-label">Learning Status</div>
          <div className="h-6 bg-muted rounded w-16 mx-auto"></div>
        </div>
      </>
    );
  }

  const trainingCycles = trainingMetrics?.trainingCycles || 0;
  const averageConfidence = confidenceMetrics?.averageConfidence || 0;
  const activeModels = trainingMetrics?.activeModels || 6;
  const learningActive = confidenceMetrics?.learningActive || false;

  // Debug log to check the data
  if (trainingMetrics) {
    console.log('📊 Training Metrics:', trainingMetrics);
  }
  if (confidenceMetrics) {
    console.log('🧠 Confidence Metrics:', confidenceMetrics);
    console.log('🔍 Average Confidence Value:', averageConfidence);
    console.log('🔍 Direct Confidence Value:', confidenceMetrics.averageConfidence);
  }

  console.log('🔍 LIVE LEARNING METRICS RENDER:', {
    trainingMetrics,
    confidenceMetrics,
    loading,
    trainingCycles,
    averageConfidence,
    activeModels,
    learningActive
  });

  return (
    <>
      <div className="stat-card">
        <div className="stat-value text-green-500">
          {trainingMetrics?.trainingCycles?.toLocaleString() || 'No Data'}
        </div>
        <div className="stat-label flex items-center justify-center gap-1">
          <BarChart3 className="w-3 h-3" />
          Training Cycles
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-value text-blue-500">
          {confidenceMetrics?.averageConfidence ? `${confidenceMetrics.averageConfidence.toFixed(1)}%` : 'No Data'}
        </div>
        <div className="stat-label flex items-center justify-center gap-1">
          <Brain className="w-3 h-3" />
          System Confidence
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-value text-purple-500">
          {activeModels}
        </div>
        <div className="stat-label flex items-center justify-center gap-1">
          <Bot className="w-3 h-3" />
          Active Models
        </div>
      </div>

      <div className="stat-card">
        <div className={`stat-value ${learningActive ? 'text-green-500' : 'text-red-500'}`}>
          {learningActive ? 'ACTIVE' : 'INACTIVE'}
        </div>
        <div className="stat-label flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" />
          Learning Status
        </div>
      </div>
    </>
  );
};