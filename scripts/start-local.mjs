import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (err) {
    // ignore
  }
}

async function canConnect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch (err) {
    try { await client.end(); } catch (e) {}
    return false;
  }
}

function runDockerCompose() {
  return new Promise((resolve, reject) => {
    const p = spawn('docker compose up -d', { stdio: 'inherit', shell: true });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('docker compose failed'))));
  });
}

function runMigrateScript() {
  return new Promise((resolve, reject) => {
    const script = `"${process.execPath}" "${path.join(process.cwd(), 'scripts', 'migrate.mjs')}"`;
    const p = spawn(script, { stdio: 'inherit', shell: true });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('migrate script failed'))));
  });
}

function startDev() {
  const p = spawn('npm run dev', { stdio: 'inherit', shell: true });
  p.on('close', (code) => process.exit(code));
}

(async () => {
  loadDotenv(path.resolve(process.cwd(), '.env'));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  console.log('Checking database connectivity...');
  if (await canConnect(databaseUrl)) {
    console.log('Database reachable.');
  } else {
    console.log('Database unreachable. Attempting to start via Docker Compose...');
    try {
      await runDockerCompose();
    } catch (err) {
      console.error('Failed to start docker compose:', err);
    }

    const maxAttempts = 60;
    let attempt = 0;
    while (!(await canConnect(databaseUrl)) && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempt++;
      process.stdout.write('.');
    }
    console.log('\n');
    if (!(await canConnect(databaseUrl))) {
      console.error('Database still unreachable after waiting. Aborting.');
      process.exit(1);
    }
  }

  console.log('Applying migrations...');
  try {
    await runMigrateScript();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }

  console.log('Starting dev server...');
  startDev();
})();
