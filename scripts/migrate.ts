/**
 * Runs on every deploy (see "vercel-build"). Migrations only ever add to the schema,
 * so rolling back to the previous app version is always safe.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  // The owner of the tables runs migrations; the app itself may use a login with fewer rights (see .env.example).
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  await pool.end();
  console.log("Database migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
