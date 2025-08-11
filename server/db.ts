import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Support local Postgres (localhost) using 'pg' + drizzle node-postgres adapter,
// and Neon Serverless when using a Neon connection string. This avoids runtime
// errors when running locally against Docker/Postgres.
let pool: any;
let db: any;

/**
 * Initialize database connections. This is async and must be awaited before
 * using `db` or `pool`. Avoids top-level await so the file can be bundled.
 */
async function initDb() {
  if (db && pool) return { pool, db };

  if (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')) {
    // Local Postgres - use native pg client
    const { Pool } = await import('pg');
    const drizzleModule = await import('drizzle-orm/node-postgres');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzleModule.drizzle(pool, { schema });
  } else {
    // Fallback to Neon serverless (websocket) for hosted environments
    const { Pool: NeonPool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle: neonDrizzle } = await import('drizzle-orm/neon-serverless');
    const ws = (await import('ws')).default;
    neonConfig.webSocketConstructor = ws;
    pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
    db = neonDrizzle({ client: pool, schema });
  }

  return { pool, db };
}

export { pool, db, initDb };

