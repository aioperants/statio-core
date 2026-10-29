"use server";
import { and, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type en from "../../../../../messages/en.json";
import { db, schema } from "@/db";
import { messagesFor } from "@/i18n/messages";
import { audit, canSeeClient, clientsVisibleTo, managesAllVisits, requirePermission, requireStaff } from "@/lib/access";
import { appointmentDetails, BookingFailure, createBooking, getSlots, moveBooking, requireBusiness, setAppointmentStatus } from "@/lib/booking";
import { toE164 } from "@/lib/phone";
import { emailClient } from "@/lib/notify";
import { isValidDay, localToUtc } from "@/lib/time";

const uuid = z.uuid();
const day = z.string().refine(isValidDay);

type Result = { ok: true } | { ok: false; error: string };

async function visitFor(id: string, me: Awaited<ReturnType<typeof requireStaff>>) {
  const appt = await appointmentDetails({ id: uuid.parse(id) });
  if (!appt) throw new Error("Visit not found");
  // Staff only manage their own visits; owners and managers manage all.
  if (!managesAllVisits(me) && appt.staffId !== me.id) throw new Error("Not allowed");
  return appt;
}

/** Approve, decline, mark done or no-show, cancel, or restore a visit. */
export async function changeVisit(id: string, action: "approve" | "decline" | "done" | "no_show" | "cancel" | "confirm"): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(id, me);
  const to = { approve: "confirmed", confirm: "confirmed", decline: "declined", done: "completed", no_show: "no_show", cancel: "cancelled" } as const;
  // Done or no-show only once the visit has started.
  if ((action === "done" || action === "no_show") && appt.startsAt > new Date()) return { ok: false, error: "invalid" };
  if (action === "approve" || action === "confirm") {
    // Bring back a cancelled visit only if the time is still free.
    if (!["pending", "confirmed"].includes(appt.status)) return { ok: false, error: "slot_unavailable" };
  }
  await setAppointmentStatus(appt.id, to[action]);
  // A no-show that is corrected back to done should not count against the client.
  if (appt.status === "no_show" && action === "done") {
    await db
      .update(schema.client)
      .set({ noShowCount: sql`greatest(${schema.client.noShowCount} - 1, 0)` })
      .where(eq(schema.client.id, appt.clientId));
  }
  if (action === "approve" && appt.status === "pending") await emailClient(appt.id, "approved");
  if (action === "decline") await emailClient(appt.id, "declined");
  if (action === "cancel" && appt.startsAt > new Date()) await emailClient(appt.id, "cancelled_by_salon");
  await audit(me.userId, `visit.${action}`, appt.id);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

export async function saveVisitNote(id: string, notes: string): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(id, me);
  await db.update(schema.appointment).set({ notes: notes.slice(0, 1000) || null }).where(eq(schema.appointment.id, appt.id));
  return { ok: true };
}

/** Free times for the admin (no notice period, compact-day or daily limit). */
export async function adminSlots(input: { day: string; serviceIds: string[]; staffId: string | null; excludeId?: string }) {
  await requireStaff();
  const p = z
    .object({ day, serviceIds: z.array(uuid).min(1).max(5), staffId: uuid.nullable(), excludeId: uuid.optional() })
    .safeParse(input);
  if (!p.success) return [];
  const slots = await getSlots({ day: p.data.day, serviceIds: p.data.serviceIds, staffId: p.data.staffId, mode: "admin", excludeAppointmentId: p.data.excludeId });
  return slots.map((s) => ({ start: s.start, staffId: s.staffId }));
}

export async function moveVisit(input: { id: string; day: string; start: number; staffId: string | null; notify: boolean }): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(input.id, me);
  if (!day.safeParse(input.day).success) return { ok: false, error: "invalid" };
  try {
    await moveBooking({ id: appt.id, day: input.day, start: input.start, staffId: managesAllVisits(me) ? input.staffId : me.id });
  } catch (err) {
    if (err instanceof BookingFailure) return { ok: false, error: err.code };
    throw err;
  }
  if (input.notify) await emailClient(appt.id, "moved");
  await audit(me.userId, "visit.move", appt.id);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

const bookInput = z.object({
  clientId: uuid,
  day,
  start: z.number().int().min(0).max(1440),
  serviceIds: z.array(uuid).min(1).max(5),
  staffId: uuid.nullable(),
  notify: z.boolean(),
  notes: z.string().max(1000).optional(),
  /** Walk-ins and favourites: any time, even over another visit. */
  force: z.boolean().optional(),
  /** A guest (no client record): an optional first name for the calendar. */
  guestName: z.string().trim().max(60).optional(),
});

export async function adminBook(input: z.input<typeof bookInput>): Promise<Result & { id?: string }> {
  const me = await requireStaff();
  const p = bookInput.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  // Only for a client this person may see (a chair renter's clients are theirs).
  const forClient = await db.query.client.findFirst({ where: eq(schema.client.id, p.data.clientId), columns: { ownerStaffId: true } });
  if (!forClient || !canSeeClient(me, forClient)) return { ok: false, error: "invalid" };
  try {
    const appt = await createBooking({
      day: p.data.day,
      start: p.data.start,
      serviceIds: p.data.serviceIds,
      staffId: managesAllVisits(me) ? p.data.staffId : me.id,
      clientId: p.data.clientId,
      mode: "admin",
      notes: p.data.notes,
      bookedForName: p.data.guestName || null,
      force: p.data.force && (!managesAllVisits(me) || p.data.staffId != null),
    });
    if (p.data.notify) await emailClient(appt.id, "confirmed");
    await audit(me.userId, "visit.create", appt.id);
    revalidatePath("/[locale]/admin", "layout");
    return { ok: true, id: appt.id };
  } catch (err) {
    if (err instanceof BookingFailure) return { ok: false, error: err.code };
    throw err;
  }
}

export async function searchClients(q: string) {
  const me = await requireStaff();
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const digits = term.replace(/\D/g, "");
  return db.query.client.findMany({
    where: and(
      eq(schema.client.guest, false),
      isNull(schema.client.erasedAt),
      clientsVisibleTo(me),
      or(
        ilike(schema.client.name, like),
        ilike(schema.client.email, like),
        digits.length >= 3 ? sql`regexp_replace(coalesce(${schema.client.phone}, ''), '\\D', '', 'g') like ${`%${digits}%`}` : undefined,
      ),
    ),
    columns: { id: true, name: true, phone: true, email: true, noShowCount: true, status: true },
    orderBy: desc(schema.client.createdAt),
    limit: 8,
  });
}

/**
 * The shared record behind guest visits (tourists, one-off walk-ins): the visit is kept for the
 * takings, but no client is added, listed or contacted. Made the first time it's needed.
 */
export async function guestForWalkIn() {
  await requireStaff();
  const found = await db.query.client.findFirst({ where: eq(schema.client.guest, true) });
  if (found) return { id: found.id, name: found.name, phone: null, email: null, guest: true };
  const business = await requireBusiness();
  const name = (messagesFor(business.defaultLocale) as typeof en).admin.walkin.guestRecord;
  const [c] = await db.insert(schema.client).values({ name, guest: true, source: "admin" }).returning({ id: schema.client.id, name: schema.client.name });
  return { id: c.id, name: c.name, phone: null, email: null, guest: true };
}

/** A guest came back after all: their guest visit becomes the first visit of a real client. */
export async function saveGuestAsClient(locale: string, appointmentId: string, form: FormData) {
  const me = await requirePermission("clients", "edit");
  const appt = await db.query.appointment.findFirst({ where: eq(schema.appointment.id, uuid.parse(appointmentId)), with: { client: true } });
  if (!appt?.client.guest) throw new Error("Not a guest visit");
  const p = quickClient.parse({ name: form.get("name"), phone: form.get("phone") || undefined, email: form.get("email") || undefined });
  const email = p.email ? p.email.toLowerCase() : null;
  // Same email as a client we already know: the visit is theirs, no duplicate.
  const known = email ? await db.query.client.findFirst({ where: and(sql`lower(${schema.client.email}) = ${email}`, eq(schema.client.guest, false)) }) : null;
  // Someone else's client (a chair renter's) gets the visit too, but this person isn't shown them.
  const [c] = known
    ? [known]
    : await db
        .insert(schema.client)
        .values({ name: p.name, phone: toE164(p.phone, (await requireBusiness()).country), email, source: "admin" })
        .returning({ id: schema.client.id });
  await db.update(schema.appointment).set({ clientId: c.id, bookedForName: null }).where(eq(schema.appointment.id, appt.id));
  await audit(me.userId, "client.create", p.name);
  revalidatePath("/[locale]/admin", "layout");
  redirect(known && !canSeeClient(me, known) ? `/${locale}/admin/clients` : `/${locale}/admin/clients/${c.id}`);
}

const quickClient = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.email().max(200).optional().or(z.literal("")),
});

export async function quickAddClient(input: z.input<typeof quickClient>) {
  const me = await requireStaff();
  const p = quickClient.parse(input);
  const email = p.email ? p.email.toLowerCase() : null;
  if (email) {
    const existing = await db.query.client.findFirst({ where: sql`lower(${schema.client.email}) = ${email}` });
    // The same person, no duplicate; someone else's client (a chair renter's) without their details.
    if (existing) {
      return canSeeClient(me, existing)
        ? { id: existing.id, name: existing.name, phone: existing.phone, email: existing.email }
        : { id: existing.id, name: p.name, phone: null, email: null };
    }
  }
  const [c] = await db
    .insert(schema.client)
    .values({ name: p.name, phone: toE164(p.phone, (await requireBusiness()).country), email, source: "admin" })
    .returning({ id: schema.client.id, name: schema.client.name, phone: schema.client.phone, email: schema.client.email });
  return c;
}

const blockInput = z.object({
  staffId: uuid.nullable(),
  from: day,
  to: day,
  startMin: z.number().int().min(0).max(1440).nullable(),
  endMin: z.number().int().min(0).max(1440).nullable(),
  reason: z.string().max(200).optional(),
  onlineOnly: z.boolean(),
});

/** Block time for one person or close the salon. Staff can only block their own time. */
export async function addBlock(input: z.input<typeof blockInput>): Promise<Result & { clashes?: number }> {
  const me = await requireStaff();
  const p = blockInput.safeParse(input);
  if (!p.success || p.data.to < p.data.from) return { ok: false, error: "invalid" };
  if (!managesAllVisits(me) && p.data.staffId !== me.id) return { ok: false, error: "not_allowed" };
  const tz = (await requireBusiness()).timezone;
  const allDay = p.data.startMin == null || p.data.endMin == null;
  const startsAt = localToUtc(p.data.from, allDay ? 0 : p.data.startMin!, tz);
  const endsAt = allDay ? localToUtc(p.data.to, 1440, tz) : localToUtc(p.data.to, p.data.endMin!, tz);
  if (endsAt <= startsAt) return { ok: false, error: "invalid" };
  await db.insert(schema.timeOff).values({
    staffId: p.data.staffId,
    startsAt,
    endsAt,
    reason: p.data.reason || null,
    onlineOnly: p.data.onlineOnly,
  });
  const [{ clashes }] = await db
    .select({ clashes: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.appointment)
    .where(
      and(
        sql`${schema.appointment.status} in ('pending','confirmed')`,
        sql`${schema.appointment.startsAt} < ${endsAt} and ${schema.appointment.endsAt} > ${startsAt}`,
        p.data.staffId ? eq(schema.appointment.staffId, p.data.staffId) : undefined,
      ),
    );
  await audit(me.userId, "block.add", `${p.data.staffId ?? "salon"} ${startsAt.toISOString()}`);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true, clashes };
}

export async function removeBlock(id: string): Promise<Result> {
  const me = await requireStaff();
  const row = await db.query.timeOff.findFirst({ where: eq(schema.timeOff.id, uuid.parse(id)) });
  if (!row) return { ok: true };
  if (!managesAllVisits(me) && row.staffId !== me.id) return { ok: false, error: "not_allowed" };
  await db.delete(schema.timeOff).where(eq(schema.timeOff.id, row.id));
  await audit(me.userId, "block.remove", row.id);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

const checkoutInput = z.object({
  paidCents: z.number().int().min(0).max(10_000_000),
  method: z.enum(["cash", "card", "other"]),
  rebookDays: z.number().int().min(0).max(365).nullable(),
});

/** Finish a visit: what was actually paid, how, and when the client should come back. */
export async function checkoutVisit(id: string, input: z.input<typeof checkoutInput>): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(id, me);
  const p = checkoutInput.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (!["confirmed", "completed", "no_show", "pending"].includes(appt.status)) return { ok: false, error: "invalid" };
  if (appt.startsAt > new Date()) return { ok: false, error: "invalid" };
  if (appt.status !== "completed") await setAppointmentStatus(appt.id, "completed");
  if (appt.status === "no_show") {
    await db
      .update(schema.client)
      .set({ noShowCount: sql`greatest(${schema.client.noShowCount} - 1, 0)` })
      .where(eq(schema.client.id, appt.clientId));
  }
  await db
    .update(schema.appointment)
    .set({ paidCents: p.data.paidCents, paymentMethod: p.data.method, paidAt: appt.paidAt ?? new Date(), rebookDays: p.data.rebookDays })
    .where(eq(schema.appointment.id, appt.id));
  await audit(me.userId, "visit.checkout", `${appt.id} ${p.data.paidCents} ${p.data.method}`);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

/** The colour card: the formula used at this visit (to repeat it next time). */
export async function saveFormula(id: string, formula: string): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(id, me);
  await db.update(schema.appointment).set({ formula: formula.trim().slice(0, 1000) || null }).where(eq(schema.appointment.id, appt.id));
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}

/** The client confirmed the patch test / allergy check in the salon (for visits booked by the team). */
export async function recordConsent(id: string): Promise<Result> {
  const me = await requireStaff();
  const appt = await visitFor(id, me);
  await db.update(schema.appointment).set({ consentAt: new Date() }).where(eq(schema.appointment.id, appt.id));
  await audit(me.userId, "visit.consent", appt.id);
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
}
