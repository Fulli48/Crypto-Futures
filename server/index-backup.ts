import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Add working crypto dashboard route
  app.get("/working", (req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, "..", "dist", "public", "working.html"));
  });

  // Add diagnostic route to check what's happening
  app.get("/diagnostic", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Diagnostic Test</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="background:#0a0a0a;color:#00ff41;font-family:'Courier New',monospace;padding:2rem;">
        <h1 style="color:#00ff41;font-size:2.5rem;margin-bottom:1rem;">🔍 DIAGNOSTIC CHECK</h1>
        
        <div id="status" style="background:#1a1a1a;padding:1.5rem;border:1px solid #00ff41;border-radius:8px;margin-bottom:2rem;">
          <p><strong>Server Status:</strong> ✓ Connected</p>
          <p><strong>Port:</strong> ${server.address()?.port || 'Unknown'}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        </div>

        <div style="background:#1a1a1a;padding:1.5rem;border:1px solid #00ff41;border-radius:8px;margin-bottom:2rem;">
          <h3 style="color:#00ff41;">JavaScript Test</h3>
          <div id="js-status">Testing JavaScript...</div>
        </div>

        <div style="background:#1a1a1a;padding:1.5rem;border:1px solid #00ff41;border-radius:8px;margin-bottom:2rem;">
          <h3 style="color:#00ff41;">API Test</h3>
          <div id="api-status">Testing API connection...</div>
        </div>

        <div style="background:#1a1a1a;padding:1.5rem;border:1px solid #00ff41;border-radius:8px;">
          <h3 style="color:#00ff41;">Console Logs</h3>
          <div id="console-output" style="font-size:12px;max-height:200px;overflow-y:auto;"></div>
        </div>

        <script>
          // Override console to capture logs
          const originalLog = console.log;
          const originalError = console.error;
          const consoleOutput = document.getElementById('console-output');
          
          function addToConsole(type, message) {
            const div = document.createElement('div');
            div.style.color = type === 'error' ? '#ff4444' : '#00ff41';
            div.textContent = type.toUpperCase() + ': ' + message;
            consoleOutput.appendChild(div);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
          }
          
          console.log = function(...args) {
            originalLog.apply(console, args);
            addToConsole('log', args.join(' '));
          };
          
          console.error = function(...args) {
            originalError.apply(console, args);
            addToConsole('error', args.join(' '));
          };

          // Test JavaScript functionality
          try {
            document.getElementById('js-status').innerHTML = '✓ JavaScript is working';
            console.log('JavaScript test passed');
          } catch(e) {
            document.getElementById('js-status').innerHTML = '✗ JavaScript error: ' + e.message;
            console.error('JavaScript test failed:', e.message);
          }

          // Test API connectivity
          fetch('/api/binance/symbols')
            .then(response => {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(data => {
              const msg = '✓ API working - ' + data.length + ' symbols loaded';
              document.getElementById('api-status').innerHTML = msg;
              console.log('API test passed:', data.length, 'symbols');
            })
            .catch(error => {
              const msg = '✗ API error: ' + error.message;
              document.getElementById('api-status').innerHTML = msg;
              console.error('API test failed:', error.message);
            });

          // Test if we can access the root of the site
          fetch('/')
            .then(response => response.text())
            .then(html => {
              if (html.includes('id="root"')) {
                console.log('Root page contains React mount point');
              } else {
                console.log('Root page missing React mount point');
              }
            })
            .catch(e => console.error('Root page test failed:', e.message));

          console.log('Diagnostic page loaded successfully');
        </script>
      </body>
      </html>
    `);
  });

  // Serve static files for production
  log("Serving built static files (production mode)");
  
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  log(`Looking for build directory at: ${distPath}`);
          h1 { font-size: 3rem; margin-bottom: 1rem; }
          .status { background: #1a1a1a; padding: 1.5rem; border: 1px solid #00ff41; border-radius: 8px; margin: 1rem 0; }
          .loading { animation: pulse 2s infinite; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 CRYPTO DASHBOARD</h1>
          <div class="status">
            <p><strong>Server Status:</strong> ✓ Running</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          </div>
          <div class="status">
            <p class="loading">Loading real-time crypto data...</p>
            <div id="crypto-data"></div>
          </div>
        </div>
        
        <script>
          // Load crypto data from API
          fetch('/api/binance/symbols')
            .then(r => r.json())
            .then(data => {
              document.getElementById('crypto-data').innerHTML = 
                '✓ Connected to ' + data.length + ' cryptocurrency symbols';
            })
            .catch(e => {
              document.getElementById('crypto-data').innerHTML = 
                '⚠ API Error: ' + e.message;
            });
        </script>
      </body>
      </html>
    `);
  }
  
  // Serve static files
  app.use(express.static(distPath));
  
  // SPA fallback - only for non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT ?? '5000', 10);
  
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
    log(`preview available at: https://${process.env.REPL_SLUG || 'app'}.${process.env.REPL_OWNER || 'user'}.replit.dev/`);
  });
})();
