const fs = require('fs');
const path = require('path');

// Simple .env loader used only for local development when the 'dotenv' package
// is not installed or network access is restricted. It mimics dotenv's
// basic behavior: read KEY=VALUE lines and set process.env entries.

function loadDotenv(envPath) {
  try {
    const content = fs.readFileSync(envPath, { encoding: 'utf8' });
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    // Fail silently — missing .env is not fatal here.
  }
}

const envPath = path.resolve(process.cwd(), '.env');
loadDotenv(envPath);

module.exports = {};

