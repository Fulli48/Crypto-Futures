/**
 * ML DIAGNOSTICS API ROUTES
 * 
 * Provides real-time access to ML diagnostics data for monitoring and debugging.
 * Includes internal API endpoints for model state review and system health checks.
 */

import { Router } from 'express';
import { mlDiagnosticsService } from './ml-diagnostics-service';

const router = Router();

/**
 * Get recent ML diagnostics entries
 * Query params: component, hours, limit
 */
router.get('/ml-diagnostics', async (req, res) => {
  try {
    const component = req.query.component as any;
    const hours = parseInt(req.query.hours as string) || 24;
    const limit = parseInt(req.query.limit as string) || 100;

    const diagnostics = await mlDiagnosticsService.getRecentDiagnostics(component, hours, limit);
    
    res.json({
      success: true,
      data: diagnostics,
      count: diagnostics.length,
      filters: { component, hours, limit }
    });
    
  } catch (error) {
    console.error('❌ [API] Error fetching ML diagnostics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ML diagnostics',
      details: error.message
    });
  }
});

/**
 * Get comprehensive system health summary
 */
router.get('/ml-diagnostics/health', async (req, res) => {
  try {
    const healthSummary = await mlDiagnosticsService.getSystemHealthSummary();
    
    res.json({
      success: true,
      data: healthSummary
    });
    
  } catch (error) {
    console.error('❌ [API] Error fetching system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health summary',
      details: error.message
    });
  }
});

/**
 * Get recent regime changes across all components
 */
router.get('/ml-diagnostics/regime-changes', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    
    const regimeChanges = await mlDiagnosticsService.getRecentDiagnostics(
      undefined, 
      hours, 
      50
    );
    
    const filteredRegimeChanges = regimeChanges.filter(d => d.regimeChangeDetected === true);
    
    res.json({
      success: true,
      data: filteredRegimeChanges,
      count: filteredRegimeChanges.length,
      totalPeriod: `${hours} hours`
    });
    
  } catch (error) {
    console.error('❌ [API] Error fetching regime changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regime changes',
      details: error.message
    });
  }
});

/**
 * Get recent errors by severity and component
 */
router.get('/ml-diagnostics/errors', async (req, res) => {
  try {
    const severity = req.query.severity as string;
    const component = req.query.component as any;
    const hours = parseInt(req.query.hours as string) || 24;
    
    const diagnostics = await mlDiagnosticsService.getRecentDiagnostics(component, hours, 200);
    
    const errors = diagnostics
      .filter(d => d.diagnosticType === 'error_alert')
      .filter(d => !severity || d.errorSeverity === severity);
    
    res.json({
      success: true,
      data: errors,
      count: errors.length,
      filters: { severity, component, hours }
    });
    
  } catch (error) {
    console.error('❌ [API] Error fetching ML errors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ML errors',
      details: error.message
    });
  }
});

/**
 * Get feature weight trends over time
 */
router.get('/ml-diagnostics/feature-weights', async (req, res) => {
  try {
    const component = req.query.component as any || 'MLTradeSignalEngine';
    const hours = parseInt(req.query.hours as string) || 48;
    
    const diagnostics = await mlDiagnosticsService.getRecentDiagnostics(component, hours, 100);
    
    const trainingCycles = diagnostics
      .filter(d => d.diagnosticType === 'training_cycle' && d.featureWeights)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Extract weight progression
    const weightProgression = trainingCycles.map(cycle => ({
      timestamp: cycle.timestamp,
      featureWeights: cycle.featureWeights,
      topFeatures: cycle.topFeatures,
      modelAccuracy: cycle.modelAccuracy,
      tradesAnalyzed: cycle.tradesAnalyzed
    }));
    
    res.json({
      success: true,
      data: weightProgression,
      count: weightProgression.length,
      component,
      period: `${hours} hours`
    });
    
  } catch (error) {
    console.error('❌ [API] Error fetching feature weights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature weight trends',
      details: error.message
    });
  }
});

/**
 * Force trigger a diagnostic analysis for testing
 */
router.post('/ml-diagnostics/trigger-analysis', async (req, res) => {
  try {
    const { component, symbol } = req.body;
    
    if (!component) {
      return res.status(400).json({
        success: false,
        error: 'Component is required'
      });
    }
    
    // Trigger performance regime analysis
    await mlDiagnosticsService.analyzePerformanceRegime(component, symbol);
    
    res.json({
      success: true,
      message: `Triggered diagnostic analysis for ${component}${symbol ? ` (${symbol})` : ''}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API] Error triggering diagnostic analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger diagnostic analysis',
      details: error.message
    });
  }
});

export { router as mlDiagnosticsRouter };