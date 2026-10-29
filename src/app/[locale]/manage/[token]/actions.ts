"use server";
import { appointmentDetails, BookingFailure, getBusiness, getSlots, moveBooking, setAppointmentStatus, staffIsOff } from "@/lib/booking";
import { emailClient, emailOwner } from "@/lib/notify";
import { isValidDay } from "@/lib/time";

/** A client cancels with the private link from their email. */
export async function cancelByClient(token: string): Promise<{ ok: boolean }> {
  if (typeof token !== "string" || token.length < 20) return { ok: false };
  const [business, appt] = await Promise.all([getBusiness(), appointmentDetails({ token })]);
  if (!business || !appt || !["pending", "confirmed"].includes(appt.status)) return { ok: false };
  if (+appt.startsAt - Date.now() < business.cancellationHours * 3600_000 && !(await staffIsOff(appt))) return { ok: false };
  await setAppointmentStatus(appt.id, "cancelled");
  await emailOwner(appt.id, "owner_cancelled");
  // Also removes the visit from the client's calendar.
  if (appt.status === "confirmed") await emailClient(appt.id, "cancelled_by_client");
  return { ok: true };
}

async function changeable(token: string) {
  if (typeof token !== "string" || token.length < 20) return null;
  const [business, appt] = await Promise.all([getBusiness(), appointmentDetails({ token })]);
  if (!business || !appt || !["pending", "confirmed"].includes(appt.status)) return null;
  // Same rule as cancelling: not too close to the visit, unless the salon's person can't come.
  if (+appt.startsAt - Date.now() < business.cancellationHours * 3600_000 && !(await staffIsOff(appt))) return null;
  return appt;
}

const serviceIdsOf = (appt: NonNullable<Awaited<ReturnType<typeof appointmentDetails>>>) =>
  [...appt.lines].sort((a, b) => +a.startsAt - +b.startsAt).map((l) => l.serviceId);

/** Free times for moving this visit, with the same person or anyone. */
export async function clientSlots(token: string, day: string, anyone: boolean) {
  const appt = await changeable(token);
  if (!appt || !isValidDay(day)) return [];
  const slots = await getSlots({ day, serviceIds: serviceIdsOf(appt), staffId: anyone ? null : appt.staffId, mode: "online", excludeAppointmentId: appt.id });
  return slots.map((s) => ({ start: s.start, staffId: s.staffId }));
}

/** A client moves their own visit with the private link from their email. */
export async function rescheduleByClient(token: string, day: string, start: number, anyone: boolean): Promise<{ ok: boolean; error?: string }> {
  const appt = await changeable(token);
  if (!appt || !isValidDay(day) || !Number.isInteger(start)) return { ok: false };
  try {
    await moveBooking({ id: appt.id, day, start, staffId: anyone ? null : appt.staffId, mode: "online" });
  } catch (err) {
    if (err instanceof BookingFailure) return { ok: false, error: err.code };
    throw err;
  }
  await Promise.all([emailClient(appt.id, "rescheduled"), emailOwner(appt.id, "owner_moved")]);
  return { ok: true };
}
