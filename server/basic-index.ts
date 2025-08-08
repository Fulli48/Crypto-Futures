import express from "express";

const app = express();
const port = parseInt(process.env.PORT ?? '5000', 10);

// Basic middleware
app.use(express.json());
app.use(express.static('client/dist'));

// Test route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    port,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Simple HTML route
app.get('/basic', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Basic Test</title>
      <meta charset="utf-8">
    </head>
    <body style="background:#000;color:#0f0;font-family:monospace;padding:2rem;">
      <h1 style="font-size:4rem;">✓ WORKING</h1>
      <p>Port: ${port}</p>
      <p>Time: ${new Date().toISOString()}</p>
      <script>
        fetch('/health')
          .then(r => r.json())
          .then(data => {
            document.body.innerHTML += '<div>API Status: ' + data.status + '</div>';
          })
          .catch(e => {
            document.body.innerHTML += '<div>API Error: ' + e.message + '</div>';
          });
      </script>
    </body>
    </html>
  `);
});

// Catch all for SPA
app.get('*', (req, res) => {
  res.redirect('/basic');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Basic server running on ${port}`);
  console.log(`Host: 0.0.0.0`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});