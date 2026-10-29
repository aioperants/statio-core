import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { staffSlugs } from "./staff-link";

/** People clients can book online (they take bookings and have working hours), with their link names. */
export async function onlineStaff() {
  const [staff, hours] = await Promise.all([
    db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder) }),
    db.query.workingHours.findMany({ columns: { staffId: true } }),
  ]);
  const withHours = new Set(hours.map((w) => w.staffId));
  const people = staff.filter((s) => s.bookable && withHours.has(s.id));
  return { people, slugs: staffSlugs(people) };
}
