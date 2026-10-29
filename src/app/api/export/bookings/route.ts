import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { AccessError, audit, requirePermission } from "@/lib/access";
import { csv } from "../csv";

/** Every booking of the salon as CSV (Download my data): theirs to take anywhere. */
export async function GET() {
  let me;
  try {
    me = await requirePermission("clientData", "view");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not allowed", { status: 403 });
    throw err;
  }
  const rows = await db.query.appointment.findMany({
    with: { client: { columns: { name: true, email: true, phone: true } }, staff: { columns: { name: true } } },
    orderBy: asc(schema.appointment.startsAt),
  });
  await audit(me.userId, "booking.export", `${rows.length}`);
  return csv(
    "bookings.csv",
    ["starts_at", "ends_at", "status", "client", "client_email", "client_phone", "with", "price_cents", "paid_cents", "notes"],
    rows.map((a) => [a.startsAt.toISOString(), a.endsAt.toISOString(), a.status, a.client?.name, a.client?.email, a.client?.phone, a.staff?.name, a.priceCents, a.paidCents, a.notes]),
  );
}
