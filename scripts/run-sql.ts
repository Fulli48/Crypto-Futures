import 'dotenv/config';
import { readFile } from 'fs/promises';
import { Client } from 'pg';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/run-sql.ts <file.sql>');
    process.exit(1);
  }

  const sql = await readFile(file, 'utf8');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log('✅ SQL applied');
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
