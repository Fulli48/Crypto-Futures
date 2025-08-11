import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

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

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

(async () => {
  loadDotenv(path.resolve(process.cwd(), '.env'));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const fileArg = process.argv[2] || path.join('server', 'sql', 'init_db.sql');
  if (!fs.existsSync(fileArg)) {
    console.error('SQL file not found:', fileArg);
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database. Applying SQL:', fileArg);
    await runSqlFile(client, fileArg);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Failed to apply migration:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
