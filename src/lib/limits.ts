import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Limits counted in the database, so every server counts together (on Vercel, requests spread over
 * many short-lived servers and a count kept in memory hardly limits anything). Keys are hashed:
 * the table never holds an email or a connection's address.
 *
 * `tooMany("code:" + email, 10, 3600)` counts one try and says whether it went over 10 in the hour.
 */
export async function tooMany(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const hashed = createHash("sha256").update(key).digest("hex");
  const { rows } = await db.execute<{ count: number }>(sql`
      insert into attempt_limit (key, count, window_start) values (${hashed}, 1, now())
      on conflict (key) do update set
        count = case when attempt_limit.window_start <= now() - make_interval(secs => ${windowSeconds}) then 1 else attempt_limit.count + 1 end,
        window_start = case when attempt_limit.window_start <= now() - make_interval(secs => ${windowSeconds}) then now() else attempt_limit.window_start end
      returning count`);
  // Old rows go now and then (about one call in fifty), so the table stays small.
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from attempt_limit where window_start < now() - interval '1 day'`).catch(() => undefined);
  }
  return Number(rows[0]?.count ?? 0) > max;
}

/** The connection a request came from: Vercel sets these headers itself (a browser can't choose them there). */
export const requestIp = (h: Headers) => h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
