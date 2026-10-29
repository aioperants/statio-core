import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { AccessError, requirePermission } from "@/lib/access";
import { csv } from "../csv";

/** The salon's services and prices as CSV (Download my data). */
export async function GET() {
  try {
    await requirePermission("settings", "view");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not allowed", { status: 403 });
    throw err;
  }
  const rows = await db.query.service.findMany({ orderBy: asc(schema.service.sortOrder) });
  return csv(
    "services.csv",
    ["name", "minutes", "price_cents", "active"],
    rows.map((s) => [s.nameEs, s.durationMin, s.priceCents, s.active]),
  );
}
