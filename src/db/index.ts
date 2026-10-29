import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** One small pool per server; development reloads reuse it instead of opening new connections. */
const g = globalThis as unknown as { pool?: Pool };
const pool =
  g.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    // Wait at most this long for a free connection, then fail the request instead of hanging.
    connectionTimeoutMillis: 10_000,
  });
// A dropped idle connection (database restart, serverless sleep) must not crash the app; the pool reconnects.
pool.on("error", (err) => console.error("Database connection lost:", err.message));
if (process.env.NODE_ENV !== "production") g.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let salonId: string | null = null;

/** The salon this copy runs (one per copy), or null before setup. Remembered once found. */
export async function currentSalonId(): Promise<string | null> {
  if (salonId) return salonId;
  const row = await db.query.business.findFirst({ columns: { id: true } });
  salonId = row?.id ?? null;
  return salonId;
}

/** Forget the remembered salon, e.g. right after setup creates it. */
export function forgetSalon() {
  salonId = null;
}
