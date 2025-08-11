const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
    const p = spawn('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('docker compose failed'))));
  });
}

async function runMigrate(databaseUrl) {
  const migrateScript = path.join(process.cwd(), 'scripts', 'migrate.cjs');
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [migrateScript], { stdio: 'inherit' });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('migrate script failed'))));
  });
}

async function startDev() {
  const { spawn } = require('child_process');
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { stdio: 'inherit' });
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
    await runMigrate(databaseUrl);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }

  console.log('Starting dev server...');
  await startDev();
})();
