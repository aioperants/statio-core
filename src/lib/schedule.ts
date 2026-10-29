import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireBusiness } from "./booking";
import { freeGaps, minutesInside, withinOpening } from "./gaps";
import type { Interval } from "./slots";
import { addDays, localToUtc, utcToLocal, weekdayOf } from "./time";

export interface StaffDay {
  hours: Interval[];
  /** Time off and salon closures (onlineOnly included, flagged). */
  blocks: (Interval & { id: string; reason: string | null; salon: boolean; onlineOnly: boolean })[];
  booked: Interval[];
  gaps: Interval[];
  openMin: number;
  bookedMin: number;
}

/** Working hours, blocks, bookings and free gaps per person for a run of local days. */
export async function schedule(from: string, count: number, opts: { staffId?: string; gapMin?: number; now?: Date } = {}) {
  const business = await requireBusiness();
  const tz = business.timezone;
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  const start = localToUtc(from, 0, tz);
  const end = localToUtc(addDays(from, count), 0, tz);

  const people = await db.query.staff.findMany({
    where: and(eq(schema.staff.active, true), opts.staffId ? eq(schema.staff.id, opts.staffId) : undefined),
    orderBy: asc(schema.staff.sortOrder),
  });
  const ids = people.map((p) => p.id);
  if (!ids.length) return { people, days, map: {} as Record<string, Record<string, StaffDay>> };

  const [opening, hours, offs, appts] = await Promise.all([
    db.query.businessHours.findMany(),
    db.query.workingHours.findMany({ where: inArray(schema.workingHours.staffId, ids) }),
    db.query.timeOff.findMany({
      where: and(lt(schema.timeOff.startsAt, end), gt(schema.timeOff.endsAt, start), or(isNull(schema.timeOff.staffId), inArray(schema.timeOff.staffId, ids))),
    }),
    db.query.appointment.findMany({
      where: and(
        inArray(schema.appointment.staffId, ids),
        sql`${schema.appointment.status} in ('pending','confirmed','completed')`,
        lt(schema.appointment.startsAt, end),
        gt(schema.appointment.endsAt, start),
      ),
      columns: { staffId: true, startsAt: true, endsAt: true, occupiedFrom: true, occupiedTo: true },
    }),
  ]);

  const clip = (a: Date, b: Date, day: string): Interval | null => {
    const s = utcToLocal(a, tz);
    const e = utcToLocal(b, tz);
    const startMin = s.day < day ? 0 : s.day > day ? null : s.minutes;
    const endMin = e.day > day ? 1440 : e.day < day ? null : e.minutes;
    if (startMin === null || endMin === null || endMin <= startMin) return null;
    return { start: startMin, end: endMin };
  };

  const now = opts.now ?? new Date();
  const nowLocal = utcToLocal(now, tz);
  const map: Record<string, Record<string, StaffDay>> = {};
  for (const day of days) {
    map[day] = {};
    const wd = weekdayOf(day);
    for (const p of people) {
      const h = withinOpening(
        hours
          .filter((w) => w.staffId === p.id && w.weekday === wd && (!w.validFrom || w.validFrom <= day) && (!w.validTo || w.validTo >= day))
          .map((w) => ({ start: w.startMin, end: w.endMin })),
        opening.length ? opening.filter((o) => o.weekday === wd).map((o) => ({ start: o.startMin, end: o.endMin })) : null,
      );
      const blocks = offs
        .filter((o) => o.staffId === p.id || o.staffId === null)
        .map((o) => {
          const i = clip(o.startsAt, o.endsAt, day);
          return i && { ...i, id: o.id, reason: o.reason, salon: o.staffId === null, onlineOnly: o.onlineOnly };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      const booked = appts
        .filter((a) => a.staffId === p.id)
        .map((a) => clip(a.occupiedFrom, a.occupiedTo, day))
        .filter((x): x is Interval => Boolean(x));
      const hardBlocks = blocks.filter((b) => !b.onlineOnly);
      const openHours = freeGaps(h, hardBlocks, 1);
      const openMin = openHours.reduce((t, i) => t + i.end - i.start, 0);
      const from = day === nowLocal.day ? nowLocal.minutes : day < nowLocal.day ? 1440 : 0;
      map[day][p.id] = {
        hours: h,
        blocks,
        booked,
        gaps: freeGaps(h, [...blocks, ...booked], opts.gapMin ?? 60, from),
        openMin,
        bookedMin: minutesInside(openHours, booked),
      };
    }
  }
  return { people, days, map };
}
