"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireStaff, managesAllVisits } from "@/lib/access";
import { appointmentDetails, reassignVisit, requireBusiness, setAppointmentStatus, staffIsOff } from "@/lib/booking";
import { emailClient, emailOwnerStaffOff } from "@/lib/notify";
import { isValidDay, localToUtc } from "@/lib/time";
import { siteChanged } from "@/lib/site/data";

const uuid = z.uuid();

/**
 * Who sorts out a visit whose person is off: the owner or a manager, or the person themselves when
 * they own their clients (e.g. a chair renter). The owner can always step in.
 */
async function handlerFor(id: string) {
  const me = await requireStaff();
  const appt = await appointmentDetails({ id: uuid.parse(id) });
  if (!appt) return null;
  if (managesAllVisits(me)) return { me, appt };
  return appt.staffId === me.id && me.ownsClients ? { me, appt } : null;
}
const day = z.string().refine(isValidDay);

/**
 * "I can't come": whole days off for the person signed in (or, for the owner, any person).
 * Online booking stops offering them, and the owner is told which visits need sorting out.
 */
export async function reportOff(input: { staffId?: string; from: string; to: string; reason?: string }): Promise<{ ok: boolean; visits: number }> {
  const me = await requireStaff();
  const p = z.object({ staffId: uuid.optional(), from: day, to: day, reason: z.string().max(200).optional() }).safeParse(input);
  if (!p.success || p.data.to < p.data.from) return { ok: false, visits: 0 };
  const staffId = managesAllVisits(me) ? (p.data.staffId ?? me.id) : me.id;
  const person = await db.query.staff.findFirst({ where: eq(schema.staff.id, staffId) });
  if (!person) return { ok: false, visits: 0 };
  const tz = (await requireBusiness()).timezone;
  const startsAt = localToUtc(p.data.from, 0, tz);
  const endsAt = localToUtc(p.data.to, 1440, tz);
  await db.insert(schema.timeOff).values({ staffId, startsAt, endsAt, reason: p.data.reason?.trim() || null });
  const [{ visits }] = await db
    .select({ visits: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.appointment)
    .where(
      and(
        eq(schema.appointment.staffId, staffId),
        sql`${schema.appointment.status} in ('pending','confirmed') and ${schema.appointment.startsAt} < ${endsAt} and ${schema.appointment.endsAt} > ${startsAt}`,
      ),
    );
  // The owner hears about it only when someone else reported it.
  if (!managesAllVisits(me)) await emailOwnerStaffOff({ staffName: person.name, from: p.data.from, to: p.data.to, visits });
  await audit(me.userId, "staff.off", `${staffId} ${p.data.from}..${p.data.to}`);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  return { ok: true, visits };
}

/** Give the visit to someone else at the same time; optionally email the client. */
export async function reassign(id: string, staffId: string, notify: boolean) {
  const h = await handlerFor(id);
  const to = await db.query.staff.findFirst({ where: eq(schema.staff.id, uuid.parse(staffId)) });
  if (!h || !to?.active) return { ok: false };
  const { me, appt } = h;
  if (await staffIsOff({ staffId: to.id, startsAt: appt.startsAt, endsAt: appt.endsAt })) return { ok: false };
  await reassignVisit(appt.id, to.id);
  if (notify) await emailClient(appt.id, "moved");
  await audit(me.userId, "visit.reassign", `${appt.id} ${appt.staffId}->${to.id}`);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  return { ok: true };
}

/** Cancel because nobody can do it; the client gets the salon's "sorry, cancelled" email. */
export async function cancelForAbsence(id: string) {
  const h = await handlerFor(id);
  if (!h || !["pending", "confirmed"].includes(h.appt.status)) return { ok: false };
  const { me, appt } = h;
  await setAppointmentStatus(appt.id, "cancelled");
  await emailClient(appt.id, "cancelled_by_salon");
  await audit(me.userId, "visit.cancel_absence", appt.id);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  return { ok: true };
}

/** The owner sent the "sorry, pick another time" message from their phone. */
export async function markClientMessaged(id: string) {
  const h = await handlerFor(id);
  if (!h) return;
  await db.update(schema.appointment).set({ absenceNotifiedAt: new Date() }).where(eq(schema.appointment.id, h.appt.id));
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
}
