import { Router } from 'express';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

const router = Router();

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * GET /api/forecasts/latest/:symbol
 * 
 * Retrieves the latest ML forecast for a given symbol with prediction vectors,
 * confidence scores, and validation status for chart overlay display.
 */
router.get('/latest/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const query = `
      SELECT 
        id,
        symbol,
        forecast_timestamp,
        input_window_start,
        input_window_end,
        prediction_horizon_minutes,
        predictions,
        confidence_scores,
        model_details,
        volatility,
        validation_status,
        validation_reason,
        filtered_outliers,
        created_at
      FROM forecasts 
      WHERE symbol = $1 
      ORDER BY forecast_timestamp DESC 
      LIMIT 1
    `;
    
    const result = await pool.query(query, [symbol]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: `No forecasts found for ${symbol}`,
        data: null
      });
    }
    
    const forecast = result.rows[0];
    
    // Parse JSON fields
    forecast.predictions = JSON.parse(forecast.predictions);
    forecast.confidence_scores = JSON.parse(forecast.confidence_scores);
    forecast.model_details = JSON.parse(forecast.model_details);
    
    // Calculate prediction timestamps (1-minute intervals from forecast time)
    const baseTime = new Date(forecast.forecast_timestamp);
    const predictionTimestamps: string[] = [];
    
    for (let i = 1; i <= forecast.prediction_horizon_minutes; i++) {
      const predTime = new Date(baseTime.getTime() + (i * 60 * 1000));
      predictionTimestamps.push(predTime.toISOString());
    }
    
    // Combine predictions with timestamps and confidence
    const forecastData = forecast.predictions.map((price: any, index: number) => ({
      timestamp: predictionTimestamps[index],
      price: parseFloat(price),
      confidence: forecast.confidence_scores[index],
      minutesAhead: index + 1
    }));
    
    res.json({
      success: true,
      data: {
        id: forecast.id,
        symbol: forecast.symbol,
        forecastTimestamp: forecast.forecast_timestamp,
        inputWindowStart: forecast.input_window_start,
        inputWindowEnd: forecast.input_window_end,
        predictionHorizon: forecast.prediction_horizon_minutes,
        volatility: parseFloat(forecast.volatility),
        validationStatus: forecast.validation_status,
        validationReason: forecast.validation_reason,
        filteredOutliers: forecast.filtered_outliers,
        modelDetails: forecast.model_details,
        predictions: forecastData,
        createdAt: forecast.created_at
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching latest forecast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast data',
      error: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/forecasts/history/:symbol
 * 
 * Retrieves historical forecasts for audit and accuracy analysis.
 * Includes comparison with realized prices when available.
 */
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = '10', offset = '0' } = req.query;
    
    const query = `
      SELECT 
        id,
        symbol,
        forecast_timestamp,
        prediction_horizon_minutes,
        predictions,
        confidence_scores,
        validation_status,
        validation_reason,
        filtered_outliers,
        volatility,
        created_at
      FROM forecasts 
      WHERE symbol = $1 
      ORDER BY forecast_timestamp DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [symbol, String(limit), String(offset)]);
    
    const forecasts = result.rows.map(forecast => {
      const predictions = JSON.parse(forecast.predictions);
      const confidence_scores = JSON.parse(forecast.confidence_scores);
      
      return {
        id: forecast.id,
        symbol: forecast.symbol,
        forecastTimestamp: forecast.forecast_timestamp,
        predictionHorizon: forecast.prediction_horizon_minutes,
        predictions: predictions.map((price: any, index: number) => ({
          minutesAhead: index + 1,
          predictedPrice: parseFloat(price),
          confidence: confidence_scores[index]
        })),
        validationStatus: forecast.validation_status,
        validationReason: forecast.validation_reason,
        filteredOutliers: forecast.filtered_outliers,
        volatility: parseFloat(forecast.volatility),
        createdAt: forecast.created_at
      };
    });
    
    res.json({
      success: true,
      data: forecasts,
      pagination: {
        limit: parseInt(String(limit)),
        offset: parseInt(String(offset)),
        total: forecasts.length
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching forecast history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast history',
      error: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/forecasts/accuracy/:symbol
 * 
 * Analyzes forecast accuracy by comparing predictions with realized prices.
 * Useful for model performance evaluation and audit trails.
 */
router.get('/accuracy/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 7 } = req.query;
    
    // Get forecasts from the last N days
    const forecastQuery = `
      SELECT 
        forecast_timestamp,
        predictions,
        confidence_scores,
        validation_status,
        filtered_outliers
      FROM forecasts 
      WHERE symbol = $1 
        AND forecast_timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY forecast_timestamp DESC
    `;
    
    const forecastResult = await pool.query(forecastQuery, [symbol]);
    
    // Get actual price data for comparison
    const priceQuery = `
      SELECT 
        timestamp,
        close
      FROM "rollingChartData" 
      WHERE symbol = $1 
        AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp ASC
    `;
    
    const priceResult = await pool.query(priceQuery, [symbol]);
    
    const accuracyAnalysis = [];
    
    for (const forecast of forecastResult.rows) {
      const predictions = JSON.parse(forecast.predictions);
      const confidenceScores = JSON.parse(forecast.confidence_scores);
      const forecastTime = new Date(forecast.forecast_timestamp);
      
      interface PredictionAccuracy {
        minutesAhead: number;
        predictedPrice: number;
        actualPrice: number;
        confidence: number;
        absoluteError: number;
        errorPercent: number;
        predictionTime: string;
      }

      const forecastAccuracy: {
        forecastTimestamp: string;
        validationStatus: string;
        filteredOutliers: number;
        predictions: PredictionAccuracy[];
      } = {
        forecastTimestamp: forecast.forecast_timestamp,
        validationStatus: forecast.validation_status,
        filteredOutliers: forecast.filtered_outliers,
        predictions: []
      };
      
      // Compare each prediction with actual prices
      for (let i = 0; i < predictions.length; i++) {
        const predictionTime = new Date(forecastTime.getTime() + ((i + 1) * 60 * 1000));
        const predictedPrice = parseFloat(predictions[i]);
        const confidence = confidenceScores[i];
        
        // Find actual price at prediction time
        const actualPriceData = priceResult.rows.find(row => {
          const rowTime = new Date(row.timestamp);
          return Math.abs(rowTime.getTime() - predictionTime.getTime()) < 30000; // Within 30 seconds
        });
        
        if (actualPriceData) {
          const actualPrice = parseFloat(actualPriceData.close);
          const error = Math.abs(predictedPrice - actualPrice);
          const errorPercent = (error / actualPrice) * 100;
          
          forecastAccuracy.predictions.push({
            minutesAhead: i + 1,
            predictedPrice,
            actualPrice,
            confidence,
            absoluteError: error,
            errorPercent,
            predictionTime: predictionTime.toISOString()
          });
        }
      }
      
      accuracyAnalysis.push(forecastAccuracy);
    }
    
    // Calculate overall accuracy metrics
    const allPredictions = accuracyAnalysis.flatMap(f => f.predictions);
    const avgError = allPredictions.reduce((sum, p) => sum + p.errorPercent, 0) / allPredictions.length;
    const avgConfidence = allPredictions.reduce((sum, p) => sum + p.confidence, 0) / allPredictions.length;
    
    res.json({
      success: true,
      data: {
        symbol,
        analysisWindow: `${days} days`,
        totalForecasts: forecastResult.rows.length,
        totalPredictions: allPredictions.length,
        avgErrorPercent: avgError,
        avgConfidence,
        forecasts: accuracyAnalysis
      }
    });
    
  } catch (error: any) {
    console.error('Error analyzing forecast accuracy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze forecast accuracy',
      error: error?.message || 'Unknown error'
    });
  }
});

export default router;