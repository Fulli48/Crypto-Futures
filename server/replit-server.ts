import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Enable trust proxy for Replit
app.set('trust proxy', true);

// CORS and headers for Replit compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle Replit's preview requests
  if (req.headers['x-replit-user-agent']) {
    console.log('[REPLIT] Preview request detected:', req.path);
  }
  
  next();
});

// JSON parsing
app.use(express.json());

// Import API routes
import('./routes.js').then(routes => {
  routes.registerRoutes(app);
}).catch(err => {
  console.error('[REPLIT-SERVER] Failed to load routes:', err);
});

// Serve simple HTML directly - no complex builds
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crypto Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #00ff41;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #00ff41;
        }
        .title {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 0 0 20px #00ff41;
            animation: glow 2s ease-in-out infinite alternate;
        }
        @keyframes glow {
            from { text-shadow: 0 0 20px #00ff41; }
            to { text-shadow: 0 0 30px #00ff41, 0 0 40px #00ff41; }
        }
        .status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0, 255, 65, 0.1);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 30px;
            border: 1px solid #00ff41;
        }
        .crypto-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .crypto-card {
            background: rgba(0, 255, 65, 0.05);
            border: 2px solid #00ff41;
            border-radius: 15px;
            padding: 20px;
            transition: all 0.3s ease;
            cursor: pointer;
        }
        .crypto-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 255, 65, 0.3);
            background: rgba(0, 255, 65, 0.1);
        }
        .crypto-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .symbol {
            font-size: 1.8rem;
            font-weight: bold;
        }
        .price {
            font-size: 1.6rem;
            color: white;
        }
        .change {
            font-size: 1.2rem;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .positive { color: #00ff41; }
        .negative { color: #ff4444; }
        .signal {
            text-align: center;
            padding: 10px;
            border-radius: 8px;
            margin: 15px 0;
            font-weight: bold;
            font-size: 1.1rem;
        }
        .signal-long {
            background: rgba(0, 255, 65, 0.2);
            color: #00ff41;
            border: 2px solid #00ff41;
        }
        .signal-short {
            background: rgba(255, 68, 68, 0.2);
            color: #ff4444;
            border: 2px solid #ff4444;
        }
        .metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 15px;
        }
        .metric {
            padding: 5px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            font-size: 0.9rem;
        }
        .loading {
            text-align: center;
            font-size: 1.5rem;
            padding: 50px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .accuracy {
            background: rgba(0, 255, 65, 0.1);
            border: 2px solid #00ff41;
            border-radius: 15px;
            padding: 20px;
            text-align: center;
        }
        .accuracy-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .accuracy-stat {
            background: rgba(0, 0, 0, 0.5);
            padding: 15px;
            border-radius: 8px;
        }
        .stat-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #00ff41;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">CRYPTO DASHBOARD</h1>
            <p>Real-time Trading Analysis & AI Predictions</p>
        </div>
        
        <div class="status">
            <div>🟢 Connected to Live API</div>
            <div id="time">Loading...</div>
            <div id="update-status">Auto-updating every 30s</div>
        </div>
        
        <div id="crypto-container" class="crypto-grid">
            <div class="loading">Loading cryptocurrency data...</div>
        </div>
        
        <div class="accuracy">
            <h2>AI Learning System Performance</h2>
            <div class="accuracy-grid" id="accuracy-stats">
                <div class="accuracy-stat">
                    <div>Overall</div>
                    <div class="stat-value" id="overall-acc">---%</div>
                </div>
                <div class="accuracy-stat">
                    <div>LONG</div>
                    <div class="stat-value" id="long-acc">---%</div>
                </div>
                <div class="accuracy-stat">
                    <div>SHORT</div>
                    <div class="stat-value" id="short-acc">---%</div>
                </div>
                <div class="accuracy-stat">
                    <div>Total</div>
                    <div class="stat-value" id="total-pred">---</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function updateTime() {
            document.getElementById('time').textContent = new Date().toLocaleTimeString();
        }
        
        async function loadCryptoData() {
            try {
                const response = await fetch('/api/binance/chart-data');
                const data = await response.json();
                
                if (!data || data.length === 0) {
                    document.getElementById('crypto-container').innerHTML = 
                        '<div class="loading">No data available</div>';
                    return;
                }
                
                const sortedData = [...data].sort((a, b) => 
                    (b.profitLikelihood || 0) - (a.profitLikelihood || 0)
                );
                
                document.getElementById('crypto-container').innerHTML = sortedData.map(crypto => \`
                    <div class="crypto-card">
                        <div class="crypto-header">
                            <div class="symbol">\${crypto.symbol}</div>
                            <div class="price">$\${(crypto.price || 0).toFixed(4)}</div>
                        </div>
                        
                        <div class="change \${(crypto.change24h || 0) >= 0 ? 'positive' : 'negative'}">
                            \${(crypto.change24h || 0) >= 0 ? '+' : ''}\${(crypto.change24h || 0).toFixed(2)}%
                        </div>
                        
                        <div class="signal \${crypto.signal === 'LONG' ? 'signal-long' : 'signal-short'}">
                            \${crypto.signal || 'ANALYZING'} SIGNAL
                        </div>
                        
                        <div class="metrics">
                            <div class="metric">
                                <strong>Confidence:</strong> \${(crypto.confidence || 0).toFixed(1)}%
                            </div>
                            <div class="metric">
                                <strong>Profit:</strong> \${(crypto.profitLikelihood || 0).toFixed(1)}%
                            </div>
                            <div class="metric">
                                <strong>TP:</strong> $\${(crypto.takeProfit || 0).toFixed(4)}
                            </div>
                            <div class="metric">
                                <strong>SL:</strong> $\${(crypto.stopLoss || 0).toFixed(4)}
                            </div>
                        </div>
                    </div>
                \`).join('');
                
                updateTime();
            } catch (error) {
                console.error('Error loading crypto data:', error);
                document.getElementById('crypto-container').innerHTML = 
                    '<div class="loading" style="color: #ff4444;">Connection error. Retrying...</div>';
            }
        }
        
        async function loadAccuracy() {
            try {
                const response = await fetch('/api/binance/learning/accuracy');
                const data = await response.json();
                
                document.getElementById('overall-acc').textContent = 
                    (data.overallAccuracy || 0).toFixed(1) + '%';
                document.getElementById('long-acc').textContent = 
                    (data.longAccuracy || 0).toFixed(1) + '%';
                document.getElementById('short-acc').textContent = 
                    (data.shortAccuracy || 0).toFixed(1) + '%';
                document.getElementById('total-pred').textContent = 
                    data.totalPredictions || 0;
            } catch (error) {
                console.error('Error loading accuracy:', error);
            }
        }
        
        // Initial load
        loadCryptoData();
        loadAccuracy();
        updateTime();
        
        // Update intervals
        setInterval(updateTime, 1000);
        setInterval(loadCryptoData, 30000);
        setInterval(loadAccuracy, 60000);
        
        // Test connection
        fetch('/api/binance/symbols')
            .then(r => r.json())
            .then(data => console.log('API connected:', data.length, 'symbols'))
            .catch(e => console.error('API error:', e));
    </script>
</body>
</html>
  `);
});

// Create HTTP server explicitly
const server = http.createServer(app);

// Start server with explicit binding
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[REPLIT-SERVER] Listening on 0.0.0.0:${PORT}`);
  console.log(`[REPLIT-SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[REPLIT-SERVER] Ready for preview at port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('[REPLIT-SERVER] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[REPLIT-SERVER] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[REPLIT-SERVER] Server closed');
    process.exit(0);
  });
});