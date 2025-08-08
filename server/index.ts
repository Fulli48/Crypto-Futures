import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { BackgroundAdaptiveLearning } from "./background-adaptive-learning";
import { continuousLearningScheduler } from "./continuous-learning-scheduler";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register API routes FIRST
  const server = await registerRoutes(app);

  // Start continuous learning scheduler for automated model retraining
  try {
    continuousLearningScheduler.start();
    log('✅ [CONTINUOUS LEARNING] Automated learning scheduler started successfully');
  } catch (error) {
    log(`❌ [CONTINUOUS LEARNING] Failed to start scheduler: ${error}`);
  }

  // Start forecast performance tracking worker
  try {
    const { default: forecastWorker } = await import('./forecast-background-worker');
    log('✅ [FORECAST TRACKER] Background forecast processing started successfully');
  } catch (error) {
    log(`❌ [FORECAST TRACKER] Failed to start forecast worker: ${error}`);
  }

  // Start learning feedback test
  try {
    await import('./test-learning-feedback');
    log('✅ [LEARNING TEST] Learning feedback test initialized - will trigger accuracy-based learning');
  } catch (error) {
    log(`❌ [LEARNING TEST] Failed to start learning test: ${error}`);
  }

  // Start manual learning demonstration
  try {
    await import('./manual-learning-trigger');
    log('✅ [LEARNING DEMO] Manual learning demonstration initialized - will show dramatic learning patterns');
  } catch (error) {
    log(`❌ [LEARNING DEMO] Failed to start learning demo: ${error}`);
  }

  // Start comprehensive learning validation test
  try {
    await import('./test-learning-validation');
    log('✅ [LEARNING VALIDATION] Comprehensive learning test initialized - will validate actual learning behavior');
  } catch (error) {
    log(`❌ [LEARNING VALIDATION] Failed to start learning validation: ${error}`);
  }

  // Start trade completion monitoring
  try {
    const { TradeCompletionMonitor } = await import('./trade-completion-monitor');
    TradeCompletionMonitor.start();
    log('✅ [STARTUP] Trade completion monitoring started successfully');
  } catch (error) {
    log(`❌ [STARTUP] Failed to start trade completion monitoring: ${error}`);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files for production
  log("Serving built static files (production mode)");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  log(`Looking for build directory at: ${distPath}`);
  
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    
    // SPA fallback - only for non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    log("Build directory not found, using development mode");
    await setupVite(app, server);
  }

  // Start background adaptive learning service
  const backgroundAdaptiveLearning = new BackgroundAdaptiveLearning();
  await backgroundAdaptiveLearning.start();
  log("🧠 [STARTUP] Background adaptive learning service started");

  // Start continuous aggressive backfill service for faster data accumulation
  const { continuousAggressiveBackfillService } = await import("./continuous-aggressive-backfill-service");
  await continuousAggressiveBackfillService.startContinuousBackfill();
  log("🚀 [STARTUP] Continuous aggressive backfill service started");

  // Start continuous RSI worker
  try {
    const { ContinuousRSIWorkerService } = await import('./rsi-worker-service');
    const rsiWorker = new ContinuousRSIWorkerService();
    rsiWorker.start();
    log("🔄 [STARTUP] Continuous RSI worker started - monitoring for missing/stale RSI values");
  } catch (error) {
    log("⚠️ [STARTUP] Failed to start RSI worker:", String(error));
  }

  // Start moderate backfill service for gradual data accumulation
  const { moderateBackfillService } = await import('./moderate-backfill-service');
  setTimeout(async () => {
    try {
      await moderateBackfillService.startModerateBackfill();
      log("📊 [STARTUP] Moderate backfill service started (3 minutes every 30 seconds)");
    } catch (error) {
      log(`❌ [STARTUP] Failed to start moderate backfill service: ${error}`);
    }
  }, 15000); // Start after 15 seconds to allow system to initialize

  // Start continuous mass trade data backfill service for comprehensive data fixes
  const { massTradeDataBackfillService } = await import('./mass-trade-data-backfill-service');
  setTimeout(() => {
    try {
      massTradeDataBackfillService.startContinuousBackfill();
      log("🚀 [STARTUP] Continuous mass trade data backfill service started (every 2 minutes)");
    } catch (error) {
      log(`❌ [STARTUP] Failed to start continuous mass backfill service: ${error}`);
    }
  }, 20000); // Start after 20 seconds to avoid conflicts with other services

  // Start comprehensive data validator to fix N/A values and incomplete data
  const { comprehensiveDataValidator } = await import('./comprehensive-data-validator');
  setTimeout(() => {
    try {
      comprehensiveDataValidator.startContinuousValidation();
      log("🔍 [STARTUP] Comprehensive data validator started - fixing N/A values and incomplete data");
    } catch (error) {
      log(`❌ [STARTUP] Failed to start data validator: ${error}`);
    }
  }, 25000); // Start after 25 seconds to allow other services first

  // Start ML training data sampler
  try {
    const { mlTrainingDataSampler } = await import('./ml-training-data-sampler');
    log("🧠 [STARTUP] ML training data sampler service started");
  } catch (error) {
    log("⚠️ [STARTUP] Failed to start ML training data sampler:", String(error));
  }

  // Start Trade Completion Monitor for real-time TP/SL detection
  try {
    const { TradeCompletionMonitor } = await import('./trade-completion-monitor');
    TradeCompletionMonitor.start();
    log("🎯 [STARTUP] Trade Completion Monitor started - real-time TP/SL detection every 10 seconds");
  } catch (error) {
    log("❌ [STARTUP] Failed to start Trade Completion Monitor:", String(error));
  }

  // Start Trade Expiration Service for 20-minute timeout handling
  try {
    const { TradeExpirationService } = await import('./trade-expiration-service');
    TradeExpirationService.start();
    log("⏰ [STARTUP] Trade Expiration Service started - timeout monitoring every 30 seconds");
  } catch (error) {
    log("❌ [STARTUP] Failed to start Trade Expiration Service:", String(error));
  }

  // Background ML filtering is now handled by the dynamic live ML engine

  // Initialize Coinbase historical data before starting Dynamic Live ML Engine
  log("🔧 [STARTUP] Initializing Coinbase historical data...");
  const { coinbaseHistoricalInit } = await import('./coinbase-historical-initialization');
  await coinbaseHistoricalInit.initializeHistoricalData();
  log("✅ [STARTUP] Coinbase historical data initialization completed");

  // Start Dynamic Live ML Engine with auto-restart
  log("🔍 [STARTUP] About to import Dynamic Live ML Engine...");
  const { dynamicLiveMLEngine } = await import('./dynamic-live-ml-engine');
  log("🔍 [STARTUP] Dynamic Live ML Engine imported successfully");
  log("🔍 [STARTUP] About to call startWithAutoRestart()...");
  await dynamicLiveMLEngine.startWithAutoRestart();
  log("🚀 [STARTUP] Dynamic Live ML Engine started with auto-restart");

  // Start server
  const port = parseInt(process.env.PORT ?? '5000', 10);
  
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
    log(`preview available at: https://${process.env.REPL_SLUG || 'app'}.${process.env.REPL_OWNER || 'user'}.replit.dev/`);
  });
})();