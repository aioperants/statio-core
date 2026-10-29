import { sql } from "drizzle-orm";
import { db } from "@/db";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/** For uptime monitoring across all salons: is the app up and can it reach its database? */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, version: pkg.version });
  } catch {
    return Response.json({ ok: false, version: pkg.version }, { status: 503 });
  }
}
