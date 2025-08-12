import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString, ssl: false });
const db = drizzle(pool);

(async () => {
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations applied");
  } catch (e) {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
