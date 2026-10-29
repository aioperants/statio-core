"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getSession } from "@/lib/access";
import { BookingFailure, clientForUser, createBooking, getBusiness, getSlots } from "@/lib/booking";
import { isAvailable } from "@/i18n/messages";
import { notifyNewBooking } from "@/lib/notify";
import { addDays, isValidDay, todayIn } from "@/lib/time";
import { verifyTurnstile } from "@/lib/turnstile";

const ids = z.array(z.uuid()).min(1).max(5);
const day = z.string().refine(isValidDay);

export async function fetchSlots(input: { day: string; serviceIds: string[]; staffId: string | null }) {
  const parsed = z.object({ day, serviceIds: ids, staffId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return [];
  const slots = await getSlots({ ...parsed.data, mode: "online" });
  return slots.map((s) => ({ start: s.start, staffId: s.staffId, fit: s.fit }));
}

/** The first day (after `day`, within the booking window) with a free time, and that time. */
export async function nextFree(input: { day: string; serviceIds: string[]; staffId: string | null }) {
  const parsed = z.object({ day, serviceIds: ids, staffId: z.uuid().nullable() }).safeParse(input);
  const business = await getBusiness();
  if (!parsed.success || !business) return null;
  const last = addDays(todayIn(business.timezone), business.horizonDays - 1);
  for (let d = addDays(parsed.data.day, 1), i = 0; d <= last && i < 90; d = addDays(d, 1), i++) {
    const slots = await getSlots({ ...parsed.data, day: d, mode: "online" });
    if (slots.length) return { day: d, start: slots[0].start };
  }
  return null;
}

const bookingInput = z.object({
  day,
  start: z.number().int().min(0).max(24 * 60),
  serviceIds: ids,
  staffId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(30),
  bookedForName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  locale: z.string().refine(isAvailable),
  turnstileToken: z.string().max(4096).optional(),
  /** Optional questions on a first booking (the salon picks which). */
  heardFrom: z.string().trim().max(60).optional(),
  recommendedBy: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  /** They picked one of the recommended times (for the salon's stats). */
  suggested: z.boolean().optional(),
  /** Confirmed the patch test / allergy check (required when a chosen service asks for it). */
  consent: z.boolean().optional(),
});

export type BookResult =
  | { ok: true; status: "pending" | "confirmed"; email: string; token: string }
  | { ok: false; error: "slot_unavailable" | "blocked" | "too_many_bookings" | "not_set_up" | "outside_hours" | "bot" | "sign_in" | "invalid" };

/** Answers to the first-booking questions; never overwrites what we already know. */
async function saveAnswers(clientId: string, data: { heardFrom?: string; recommendedBy?: string; city?: string }) {
  const business = await getBusiness();
  const client = await db.query.client.findFirst({ where: eq(schema.client.id, clientId) });
  if (!business || !client) return;
  const set: Partial<typeof schema.client.$inferInsert> = {};
  if (business.askHeardFrom && !client.heardFrom && data.heardFrom && business.heardOptions.includes(data.heardFrom)) {
    set.heardFrom = data.heardFrom;
    if (data.heardFrom === "recommended" && data.recommendedBy) set.recommendedBy = data.recommendedBy;
  }
  if (business.askCity && !client.city && data.city) set.city = data.city;
  if (Object.keys(set).length) await db.update(schema.client).set(set).where(eq(schema.client.id, client.id));
}

export async function placeBooking(input: z.input<typeof bookingInput>): Promise<BookResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "sign_in" };
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const data = parsed.data;
  if (!(await verifyTurnstile(data.turnstileToken))) return { ok: false, error: "bot" };

  const needs = await db.query.service.findMany({ where: (s, { inArray, and, eq }) => and(inArray(s.id, data.serviceIds), eq(s.needsConsent, true)), columns: { id: true } });
  if (needs.length && !data.consent) return { ok: false, error: "invalid" };
  const client = await clientForUser(session.user, { name: data.name, phone: data.phone, locale: data.locale });
  await saveAnswers(client.id, data);
  try {
    const appt = await createBooking({
      day: data.day,
      start: data.start,
      serviceIds: data.serviceIds,
      staffId: data.staffId,
      clientId: client.id,
      mode: "online",
      bookedForName: data.bookedForName,
      suggested: data.suggested,
      consentAt: needs.length && data.consent ? new Date() : null,
      notes: data.notes,
    });
    const status = appt.status === "pending" ? "pending" : "confirmed";
    await notifyNewBooking(appt.id, status, false);
    return { ok: true, status, email: session.user.email, token: appt.manageToken };
  } catch (err) {
    if (err instanceof BookingFailure) return { ok: false, error: err.code };
    throw err;
  }
}
