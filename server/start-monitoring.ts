/**
 * START MONITORING SERVICES
 * 
 * Initializes all monitoring services that ensure data quality
 */

import { technicalIndicatorsMonitor } from './technical-indicators-monitor';
import './comprehensive-indicator-corrector'; // Auto-runs database correction

export async function startAllMonitoring(): Promise<void> {
  console.log('🚀 [MONITORING] Starting all monitoring services...');
  
  try {
    // Start technical indicators monitoring
    await technicalIndicatorsMonitor.startMonitoring();
    
    console.log('✅ [MONITORING] All monitoring services started successfully');
  } catch (error) {
    console.error('❌ [MONITORING] Failed to start monitoring services:', error);
  }
}

// Auto-start monitoring on module load
startAllMonitoring();