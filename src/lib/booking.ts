import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { cache } from "react";
import { currentSalonId, db, schema } from "@/db";
import { withinOpening } from "./gaps";
import { toE164 } from "./phone";
import { findSlots, type Interval, type Slot, type SlotInput } from "./slots";
import { addDays, localToUtc, todayIn, utcToLocal, weekdayOf } from "./time";

export type Business = typeof schema.business.$inferSelect;

/** This copy's salon, or null before setup. */
export async function getBusiness(): Promise<Business | null> {
  const id = await currentSalonId();
  return id ? businessById(id) : null;
}

// Read once per request and salon (jobs switch between salons within one request).
const businessById = cache(async (id: string) => (await db.query.business.findFirst({ where: eq(schema.business.id, id) })) ?? null);

export async function requireBusiness(): Promise<Business> {
  const b = await getBusiness();
  if (!b) throw new Error("The salon has not been set up yet");
  return b;
}

/** Minutes from local midnight of `day` for a UTC instant, clipped to the day. */
function toDayMinutes(instant: Date, day: string, tz: string): number {
  const local = utcToLocal(instant, tz);
  if (local.day < day) return 0;
  if (local.day > day) return 24 * 60;
  return local.minutes;
}

function dayBounds(day: string, tz: string) {
  return { from: localToUtc(day, 0, tz), to: localToUtc(addDays(day, 1), 0, tz) };
}

const ACTIVE = ["pending", "confirmed"] as const;

export type BookingMode = "online" | "admin";

/** Everything the slot engine needs for one day, read from the database. */
export async function loadSlotInput(opts: {
  day: string;
  serviceIds: string[];
  staffId: string | null;
  mode: BookingMode;
  now?: Date;
  /** Leave this visit out (when moving it). */
  excludeAppointmentId?: string;
}): Promise<SlotInput | null> {
  const business = await requireBusiness();
  const tz = business.timezone;
  const now = opts.now ?? new Date();
  const today = todayIn(tz, now);

  if (opts.day < today) return null;
  // Online: within the booking window.
  if (opts.mode === "online" && opts.day > addDays(today, business.horizonDays)) return null;

  const services = await db.query.service.findMany({
    where: and(inArray(schema.service.id, opts.serviceIds), eq(schema.service.active, true)),
  });
  if (services.length !== opts.serviceIds.length || services.length === 0) return null;
  const ordered = opts.serviceIds.map((id) => services.find((s) => s.id === id)!);

  const people = await db.query.staff.findMany({
    where: and(
      eq(schema.staff.active, true),
      opts.mode === "online" ? eq(schema.staff.bookable, true) : undefined,
      opts.staffId ? eq(schema.staff.id, opts.staffId) : undefined,
    ),
    orderBy: asc(schema.staff.sortOrder),
  });
  const staffIds = people.map((p) => p.id);
  if (staffIds.length === 0) return null;

  const { from, to } = dayBounds(opts.day, tz);
  const weekday = weekdayOf(opts.day);

  const [opening, online, links, hours, offs, appts] = await Promise.all([
    openingOn(weekday),
    opts.mode === "online" && business.onlineHoursOn ? onlineOn(weekday) : null,
    db.query.staffService.findMany({
      where: and(inArray(schema.staffService.staffId, staffIds), inArray(schema.staffService.serviceId, opts.serviceIds)),
    }),
    db.query.workingHours.findMany({
      where: and(
        inArray(schema.workingHours.staffId, staffIds),
        eq(schema.workingHours.weekday, weekday),
        or(isNull(schema.workingHours.validFrom), sql`${schema.workingHours.validFrom} <= ${opts.day}`),
        or(isNull(schema.workingHours.validTo), sql`${schema.workingHours.validTo} >= ${opts.day}`),
      ),
    }),
    db.query.timeOff.findMany({
      where: and(
        lt(schema.timeOff.startsAt, to),
        gt(schema.timeOff.endsAt, from),
        or(isNull(schema.timeOff.staffId), inArray(schema.timeOff.staffId, staffIds)),
        opts.mode === "admin" ? eq(schema.timeOff.onlineOnly, false) : undefined,
      ),
    }),
    db.query.appointment.findMany({
      where: and(
        inArray(schema.appointment.staffId, staffIds),
        inArray(schema.appointment.status, [...ACTIVE]),
        lt(schema.appointment.occupiedFrom, to),
        gt(schema.appointment.occupiedTo, from),
        opts.excludeAppointmentId ? ne(schema.appointment.id, opts.excludeAppointmentId) : undefined,
      ),
    }),
  ]);

  const interval = (a: Date, b: Date): Interval => ({ start: toDayMinutes(a, opts.day, tz), end: toDayMinutes(b, opts.day, tz) });

  const stationKinds = [...new Set(ordered.map((s) => s.stationKind).filter((k): k is string => Boolean(k)))];
  let stations: SlotInput["stations"] = [];
  if (stationKinds.length) {
    const chairs = await db.query.chair.findMany({
      where: and(inArray(schema.chair.kind, stationKinds), eq(schema.chair.active, true)),
      orderBy: asc(schema.chair.sortOrder),
    });
    const lines = chairs.length
      ? await db.query.appointmentLine.findMany({
          where: and(
            inArray(schema.appointmentLine.chairId, chairs.map((c) => c.id)),
            eq(schema.appointmentLine.active, true),
            lt(schema.appointmentLine.startsAt, to),
            gt(schema.appointmentLine.endsAt, from),
            opts.excludeAppointmentId ? ne(schema.appointmentLine.appointmentId, opts.excludeAppointmentId) : undefined,
          ),
        })
      : [];
    stations = chairs.map((c) => ({
      id: c.id,
      kind: c.kind,
      booked: lines.filter((l) => l.chairId === c.id).map((l) => interval(l.startsAt, l.endsAt)),
    }));
  }

  const nowMinutes = opts.day === today ? utcToLocal(now, tz).minutes : 0;
  return {
    services: ordered.map((s) => ({
      id: s.id,
      durationMin: s.durationMin,
      bufferBeforeMin: s.bufferBeforeMin,
      bufferAfterMin: s.bufferAfterMin,
      stationKind: s.stationKind,
    })),
    staff: people.map((p) => ({
      id: p.id,
      services: Object.fromEntries(
        links.filter((l) => l.staffId === p.id).map((l) => [l.serviceId, { durationMin: l.durationMin }]),
      ),
      // Nobody is bookable while the salon is closed, whatever their own hours say.
      hours: withinOpening(
        hours.filter((w) => w.staffId === p.id).map((w) => ({ start: w.startMin, end: w.endMin })),
        opening,
      ).flatMap((h) => (online ? withinOpening([h], online) : [h])),
      off: offs.filter((o) => o.staffId === p.id).map((o) => interval(o.startsAt, o.endsAt)),
      booked: appts.filter((a) => a.staffId === p.id).map((a) => interval(a.occupiedFrom, a.occupiedTo)),
    })),
    stations,
    closed: offs.filter((o) => o.staffId === null).map((o) => interval(o.startsAt, o.endsAt)),
    rules: {
      stepMin: business.slotStepMin,
      earliestStart: opts.mode === "online" ? (opts.day === today ? nowMinutes + business.leadMinutes : 0) : 0,
      // How times are offered online: recommend the ones that fill gaps, only those, or all alike.
      compactDay: opts.mode === "online" && business.slotMode === "only",
      exactNeighbours: opts.mode === "online" && business.slotMode === "recommend",
      dailyLimit: opts.mode === "online" ? business.dailyLimit : null,
    },
    staffId: opts.staffId,
  };
}

export async function getSlots(opts: Parameters<typeof loadSlotInput>[0]): Promise<Slot[]> {
  const input = await loadSlotInput(opts);
  return input ? findSlots(input) : [];
}

export type BookingError = "slot_unavailable" | "blocked" | "too_many_bookings" | "not_set_up" | "outside_hours";

/** The salon's opening hours on a weekday (0 = Monday); null when it hasn't set any. */
export async function openingOn(weekday: number): Promise<Interval[] | null> {
  const rows = await db.query.businessHours.findMany();
  if (rows.length === 0) return null;
  return rows
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: r.startMin, end: r.endMin }))
    .sort((a, b) => a.start - b.start);
}

/** When clients can book online on a weekday (only used while business.onlineHoursOn is set). */
async function onlineOn(weekday: number): Promise<Interval[]> {
  const rows = await db.query.onlineHours.findMany({ where: eq(schema.onlineHours.weekday, weekday) });
  return rows.map((r) => ({ start: r.startMin, end: r.endMin })).sort((a, b) => a.start - b.start);
}

export class BookingFailure extends Error {
  constructor(public code: BookingError) {
    super(code);
  }
}

/** Creates a visit after re-checking the slot. The database constraint is the final guard against races. */
export async function createBooking(opts: {
  day: string;
  start: number;
  serviceIds: string[];
  staffId: string | null;
  clientId: string;
  mode: BookingMode;
  bookedForName?: string | null;
  /** Booked online at a recommended time. */
  suggested?: boolean;
  /** When the client confirmed the patch test / allergy check. */
  consentAt?: Date | null;
  notes?: string | null;
  /** Admin only: book exactly this time and person, even over another visit or outside hours. */
  force?: boolean;
}) {
  const business = await getBusiness();
  if (!business) throw new BookingFailure("not_set_up");
  if (opts.force && (opts.mode !== "admin" || !opts.staffId)) throw new Error("A forced booking needs the admin and a person");
  const tz = business.timezone;

  const client = await db.query.client.findFirst({ where: eq(schema.client.id, opts.clientId) });
  if (!client) throw new Error("Client not found");

  let status: "pending" | "confirmed" = "confirmed";
  if (opts.mode === "online") {
    if (client.status === "blocked") throw new BookingFailure("blocked");
    const [{ completed, future }] = await db
      .select({
        completed: sql<number>`count(*) filter (where ${schema.appointment.status} = 'completed')`.mapWith(Number),
        future: sql<number>`count(*) filter (where ${schema.appointment.status} in ('pending','confirmed') and ${schema.appointment.startsAt} > now())`.mapWith(Number),
      })
      .from(schema.appointment)
      .where(eq(schema.appointment.clientId, client.id));
    const isNew = completed === 0;
    if (isNew && future >= business.maxFutureBookingsNewClient) throw new BookingFailure("too_many_bookings");
    const needsApproval =
      (isNew && !business.autoApprove) ||
      client.status === "needs_approval" ||
      client.noShowCount >= business.noShowApprovalThreshold;
    if (needsApproval) status = "pending";
  }

  const slot = opts.force
    ? await forcedSlot(opts.day, opts.start, opts.serviceIds, opts.staffId!)
    : (await getSlots({ day: opts.day, serviceIds: opts.serviceIds, staffId: opts.staffId, mode: opts.mode })).find((s) => s.start === opts.start);
  if (!slot) throw new BookingFailure("slot_unavailable");
  // Even a squeezed-in visit has to fit inside the salon's opening hours.
  if (opts.force) {
    const opening = await openingOn(weekdayOf(opts.day));
    if (opening && !opening.some((o) => slot.start >= o.start && slot.end <= o.end)) throw new BookingFailure("outside_hours");
  }

  const [services, links] = await Promise.all([
    db.query.service.findMany({ where: inArray(schema.service.id, opts.serviceIds) }),
    db.query.staffService.findMany({
      where: and(eq(schema.staffService.staffId, slot.staffId), inArray(schema.staffService.serviceId, opts.serviceIds)),
    }),
  ]);
  const price = (serviceId: string) =>
    links.find((l) => l.serviceId === serviceId)?.priceCents ?? services.find((s) => s.id === serviceId)!.priceCents;
  const at = (min: number) => localToUtc(opts.day, min, tz);
  const priced = slot.lines.map((l) => ({ serviceId: l.serviceId, priceCents: price(l.serviceId) }));

  try {
    return await db.transaction(async (tx) => {
      const [appt] = await tx
        .insert(schema.appointment)
        .values({
          clientId: client.id,
          staffId: slot.staffId,
          startsAt: at(slot.start),
          endsAt: at(slot.end),
          occupiedFrom: at(slot.occupied.start),
          occupiedTo: at(slot.occupied.end),
          status,
          source: opts.mode === "admin" ? "admin" : "web",
          bookedForName: opts.bookedForName || null,
          suggested: opts.suggested ?? false,
          consentAt: opts.consentAt ?? null,
          notes: opts.notes || null,
          priceCents: priced.reduce((t, l) => t + l.priceCents, 0),
          manageToken: randomBytes(24).toString("base64url"),
          allowOverlap: opts.force ?? false,
        })
        .returning();
      await tx.insert(schema.appointmentLine).values(
        slot.lines.map((l) => ({
          appointmentId: appt.id,
          serviceId: l.serviceId,
          startsAt: at(l.start),
          endsAt: at(l.end),
          priceCents: price(l.serviceId),
          chairId: l.stationId,
        })),
      );
      // A first visit with someone who owns their clients makes the client theirs.
      if (!client.ownerStaffId && !client.guest) {
        const [person, [{ earlier }]] = await Promise.all([
          tx.query.staff.findFirst({ where: eq(schema.staff.id, slot.staffId), columns: { ownsClients: true } }),
          tx.select({ earlier: sql<number>`count(*)`.mapWith(Number) }).from(schema.appointment).where(and(eq(schema.appointment.clientId, client.id), ne(schema.appointment.id, appt.id))),
        ]);
        if (person?.ownsClients && earlier === 0) await tx.update(schema.client).set({ ownerStaffId: slot.staffId }).where(eq(schema.client.id, client.id));
      }
      return appt;
    });
  } catch (err) {
    // 23P01 = exclusion constraint: someone else took the slot a moment ago.
    if ((err as { code?: string }).code === "23P01" || (err as { cause?: { code?: string } }).cause?.code === "23P01") {
      throw new BookingFailure("slot_unavailable");
    }
    throw err;
  }
}

/** A walk-in or squeezed-in visit: services back to back from `start`, no checks. Shared stations are left unassigned. */
async function forcedSlot(day: string, start: number, serviceIds: string[], staffId: string): Promise<Slot | null> {
  const [services, links] = await Promise.all([
    db.query.service.findMany({ where: inArray(schema.service.id, serviceIds) }),
    db.query.staffService.findMany({ where: and(eq(schema.staffService.staffId, staffId), inArray(schema.staffService.serviceId, serviceIds)) }),
  ]);
  if (services.length !== serviceIds.length) return null;
  let t = start;
  const lines = serviceIds.map((id) => {
    const s = services.find((x) => x.id === id)!;
    const d = links.find((l) => l.serviceId === id)?.durationMin ?? s.durationMin;
    const line = { serviceId: id, start: t, end: t + d, stationId: null };
    t += d;
    return line;
  });
  const last = services.find((x) => x.id === serviceIds[serviceIds.length - 1])!;
  return { start, end: t, staffId, occupied: { start, end: t + last.bufferAfterMin }, lines, fit: 0 };
}

/** Changes a visit's status, keeping station reservations in step. */
export async function setAppointmentStatus(id: string, status: (typeof schema.appointmentStatus.enumValues)[number]) {
  await db.transaction(async (tx) => {
    const [appt] = await tx.update(schema.appointment).set({ status }).where(eq(schema.appointment.id, id)).returning();
    if (!appt) return;
    const active = status === "pending" || status === "confirmed" || status === "completed";
    await tx.update(schema.appointmentLine).set({ active }).where(eq(schema.appointmentLine.appointmentId, id));
    if (status === "no_show") {
      await tx
        .update(schema.client)
        .set({ noShowCount: sql`${schema.client.noShowCount} + 1` })
        .where(eq(schema.client.id, appt.clientId));
    }
  });
}

/** Finds the client record for a signed-in user, creating or linking it on first booking. */
export async function clientForUser(user: { id: string; email: string; name: string; emailVerified: boolean }, raw: { name?: string; phone?: string; locale?: string }) {
  // One standard form for phone numbers (+34611222333), so the same person always matches.
  const details = { ...raw, phone: toE164(raw.phone, (await getBusiness())?.country) ?? undefined };
  const byUser = await db.query.client.findFirst({ where: eq(schema.client.userId, user.id) });
  if (byUser) {
    if (details.phone && !byUser.phone) {
      await db.update(schema.client).set({ phone: details.phone }).where(eq(schema.client.id, byUser.id));
    }
    return byUser;
  }
  // Only a proven email may claim an existing client record (their history and notes).
  const byEmail = user.emailVerified
    ? await db.query.client.findFirst({ where: and(isNull(schema.client.userId), sql`lower(${schema.client.email}) = lower(${user.email})`) })
    : null;
  if (byEmail) {
    // An imported or admin-created client signing in for the first time.
    const [linked] = await db
      .update(schema.client)
      .set({ userId: user.id, phone: byEmail.phone ?? details.phone ?? null })
      .where(eq(schema.client.id, byEmail.id))
      .returning();
    return linked;
  }
  const [created] = await db
    .insert(schema.client)
    .values({
      name: details.name?.trim() || user.name || user.email,
      email: user.email,
      phone: details.phone || null,
      userId: user.id,
      locale: details.locale,
      source: "online",
    })
    .returning();
  return created;
}

/** Active visits overlapping a local day, with client and service names, for the calendar. */
export async function dayAppointments(day: string, opts: { staffId?: string; days?: number } = {}) {
  const business = await requireBusiness();
  const from = dayBounds(day, business.timezone).from;
  const to = dayBounds(addDays(day, (opts.days ?? 1) - 1), business.timezone).to;
  const rows = await db.query.appointment.findMany({
    where: and(
      lt(schema.appointment.startsAt, to),
      gt(schema.appointment.endsAt, from),
      inArray(schema.appointment.status, ["pending", "confirmed", "completed", "no_show"]),
      opts.staffId ? eq(schema.appointment.staffId, opts.staffId) : undefined,
    ),
    with: { client: true, staff: true, lines: { with: { service: true } } },
    orderBy: asc(schema.appointment.startsAt),
  });
  return rows.map((r) => {
    const local = utcToLocal(r.startsAt, business.timezone);
    return {
      ...r,
      day: local.day,
      startMin: local.minutes,
      endMin: local.minutes + Math.round((+r.endsAt - +r.startsAt) / 60000),
    };
  });
}

export async function pendingAppointments() {
  return db.query.appointment.findMany({
    where: and(eq(schema.appointment.status, "pending"), gte(schema.appointment.startsAt, new Date())),
    with: { client: true, staff: true, lines: { with: { service: true } } },
    orderBy: asc(schema.appointment.startsAt),
    limit: 20,
  });
}

/**
 * New clients with a confirmed upcoming visit who haven't been welcomed (or skipped) yet:
 * no completed visit before, and no "welcome" in the message log for any of their visits.
 */
export async function clientsToWelcome() {
  const welcomed = db
    .select({ clientId: schema.appointment.clientId })
    .from(schema.messageLog)
    .innerJoin(schema.appointment, eq(schema.messageLog.appointmentId, schema.appointment.id))
    .where(eq(schema.messageLog.template, "welcome"));
  const regulars = db.select({ clientId: schema.appointment.clientId }).from(schema.appointment).where(eq(schema.appointment.status, "completed"));
  return db.query.appointment.findMany({
    where: and(
      eq(schema.appointment.status, "confirmed"),
      gte(schema.appointment.startsAt, new Date()),
      gte(schema.appointment.createdAt, new Date(Date.now() - 30 * 86_400_000)),
      notInArray(schema.appointment.clientId, welcomed),
      notInArray(schema.appointment.clientId, regulars),
      notInArray(schema.appointment.clientId, db.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.guest, true))),
    ),
    with: { client: true, staff: true, lines: { with: { service: true } } },
    orderBy: asc(schema.appointment.startsAt),
    limit: 20,
  });
}

/** Moves a visit to a new day/time and/or person, keeping its services. Admin only. */
export async function moveBooking(opts: { id: string; day: string; start: number; staffId: string | null; mode?: BookingMode }) {
  const business = await requireBusiness();
  const appt = await db.query.appointment.findFirst({
    where: eq(schema.appointment.id, opts.id),
    with: { lines: true },
  });
  if (!appt) throw new Error("Visit not found");
  const serviceIds = [...appt.lines].sort((a, b) => +a.startsAt - +b.startsAt).map((l) => l.serviceId);
  const slot = (
    await getSlots({ day: opts.day, serviceIds, staffId: opts.staffId, mode: opts.mode ?? "admin", excludeAppointmentId: appt.id })
  ).find((s) => s.start === opts.start);
  if (!slot) throw new BookingFailure("slot_unavailable");
  const at = (min: number) => localToUtc(opts.day, min, business.timezone);
  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.appointmentLine).where(eq(schema.appointmentLine.appointmentId, appt.id));
      await tx
        .update(schema.appointment)
        .set({
          staffId: slot.staffId,
          startsAt: at(slot.start),
          endsAt: at(slot.end),
          occupiedFrom: at(slot.occupied.start),
          occupiedTo: at(slot.occupied.end),
        })
        .where(eq(schema.appointment.id, appt.id));
      await tx.insert(schema.appointmentLine).values(
        slot.lines.map((l) => ({
          appointmentId: appt.id,
          serviceId: l.serviceId,
          startsAt: at(l.start),
          endsAt: at(l.end),
          priceCents: appt.lines.find((x) => x.serviceId === l.serviceId)?.priceCents ?? 0,
          chairId: l.stationId,
          active: appt.status === "pending" || appt.status === "confirmed",
        })),
      );
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23P01" || (err as { cause?: { code?: string } }).cause?.code === "23P01") {
      throw new BookingFailure("slot_unavailable");
    }
    throw err;
  }
}

/** A visit with everything needed to show or email it. */
export async function appointmentDetails(where: { id: string } | { token: string }) {
  return db.query.appointment.findFirst({
    where: "id" in where ? eq(schema.appointment.id, where.id) : eq(schema.appointment.manageToken, where.token),
    with: { client: true, staff: true, lines: { with: { service: true } } },
  });
}
export type AppointmentDetails = NonNullable<Awaited<ReturnType<typeof appointmentDetails>>>;

/**
 * Give a visit to someone else at the same time, even if they are busy (the owner decides,
 * as with a squeeze-in). Used when the booked person can't come.
 */
export async function reassignVisit(id: string, staffId: string) {
  await db.update(schema.appointment).set({ staffId, allowOverlap: true }).where(eq(schema.appointment.id, id));
}

/** Upcoming visits whose person is off (time off or salon closed) at that time: the owner has to sort them out. */
export async function visitsWithAbsentStaff() {
  const rows = await db.execute<{ id: string }>(sql`
    select a.id from appointment a
    where a.status in ('pending','confirmed') and a.ends_at > now()
      and exists (
        select 1 from time_off o
        where not o.online_only and o.starts_at < a.ends_at and o.ends_at > a.starts_at
          and (o.staff_id = a.staff_id or o.staff_id is null)
      )
    order by a.starts_at
    limit 200
  `);
  const all = await Promise.all(rows.rows.map((r) => appointmentDetails({ id: r.id })));
  return all.filter((a): a is NonNullable<typeof a> => !!a);
}

/** True when the visit's person (or the whole salon) is off at that time. */
export async function staffIsOff(a: { staffId: string; startsAt: Date; endsAt: Date }) {
  const hit = await db.query.timeOff.findFirst({
    where: and(
      eq(schema.timeOff.onlineOnly, false),
      lt(schema.timeOff.startsAt, a.endsAt),
      gt(schema.timeOff.endsAt, a.startsAt),
      or(eq(schema.timeOff.staffId, a.staffId), isNull(schema.timeOff.staffId)),
    ),
  });
  return !!hit;
}

