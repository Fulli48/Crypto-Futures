# DEPRECATED WORKERS - DO NOT USE

The following Python workers have been DEPRECATED due to conflicting technical indicator calculations that produced incorrect values:

## Deprecated Files:
- `data_quality_worker.py` - Replaced by authoritative technical-indicators-service.ts
- `simplified_technical_worker.py` - Conflicting RSI/MACD calculations 
- `sql_technical_indicators_fixer.py` - Multiple conflicting calculation methods
- `sql_windowed_corrector.py` - Inconsistent with standardized approach
- `technical_indicators_worker.py` - Legacy implementation with errors

## Reason for Deprecation:
These workers used different calculation methods for the same indicators, causing:
- RSI values stuck at 100.0 or 0.0
- Invalid Stochastic values (NaN, >100, <0) 
- Inconsistent MACD calculations across workers
- Data quality issues affecting ML predictions

## Replacement:
All technical indicator calculations now use the single, authoritative source:
- `server/technical-indicators-service.ts` - Industry-standard calculations
- `server/technical-indicators-monitor.ts` - Continuous validation and correction
- `server/comprehensive-indicator-corrector.ts` - Database cleanup

## Status:
✅ FIXED: All technical indicators now calculated using consistent, validated methods
✅ MONITORING: Continuous scanning and correction of bad values
✅ VALIDATED: All calculations follow industry standards

**DO NOT RUN THESE DEPRECATED WORKERS - THEY WILL CORRUPT DATA**