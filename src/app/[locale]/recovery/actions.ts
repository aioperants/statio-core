"use server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, endSignIns } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { requestIp, tooMany } from "@/lib/limits";
import { mailOwner, maskEmail, newTicket, ownerByRecoveryEmail, RECOVERY_MINUTES, teamUses, useTicket } from "@/lib/recovery";
import { signInLink } from "@/lib/salon-entry";
import { salonUrl } from "@/lib/salon-url";

/** The link sent to a new second email was tapped (and "Confirm" pressed): it now counts. */
export async function confirmRecoveryEmail(locale: string, token: string): Promise<{ ok: boolean }> {
  const ticket = await useTicket("recovery-confirm", token);
  if (!ticket) return { ok: false };
  const owner = await db.query.staff.findFirst({ where: eq(schema.staff.id, ticket.staffId) });
  if (!owner || owner.role !== "owner" || !owner.active || (await teamUses(ticket.email))) return { ok: false };
  await db.update(schema.staff).set({ recoveryEmail: ticket.email }).where(eq(schema.staff.id, owner.id));
  await audit(owner.userId, "account.recovery_added", maskEmail(ticket.email));
  // The main email hears of it, in case someone else added it.
  if (owner.email) await mailOwner(owner.email, owner.locale ?? locale, "added", { salon: (await requireBusiness()).name, email: maskEmail(ticket.email) });
  return { ok: true };
}

export type AskState = { sent?: boolean; error?: "email" };

/**
 * "I lost access to my email": a link to the owner's second email, if this is it. The screen says
 * the same either way, so it can't be used to find out an owner's second email.
 */
export async function requestRecovery(locale: string, _prev: AskState, form: FormData): Promise<AskState> {
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "email" };
  const ip = requestIp(await headers());
  if ((await tooMany(`recovery-ip:${ip}`, 10, 3600)) || (await tooMany(`recovery-to:${parsed.data}`, 3, 3600))) return { sent: true };
  const owner = await ownerByRecoveryEmail(parsed.data);
  if (owner) {
    const business = await requireBusiness();
    const token = await newTicket("owner-recovery", { salonId: business.id, staffId: owner.id, email: parsed.data }, RECOVERY_MINUTES);
    await mailOwner(parsed.data, owner.locale ?? locale, "link", { salon: business.name, link: `${salonUrl()}/${locale}/recovery/${token}`, minutes: String(RECOVERY_MINUTES) });
  }
  return { sent: true };
}

/**
 * "Move my sign-in here": the owner signs in with their second email from now on. The old email's
 * sign-ins at this salon end, and it is told (if the old mailbox was taken over, this is how the
 * real owner gets the salon back). They're asked to add a new second email afterwards.
 */
export async function finishRecovery(locale: string, token: string): Promise<{ ok: boolean; go?: string }> {
  const ticket = await useTicket("owner-recovery", token);
  if (!ticket) return { ok: false };
  const owner = await db.query.staff.findFirst({ where: eq(schema.staff.id, ticket.staffId) });
  if (!owner || owner.role !== "owner" || !owner.active || owner.recoveryEmail?.toLowerCase() !== ticket.email) return { ok: false };
  const oldEmail = owner.email;
  if (owner.userId) await endSignIns(owner.userId);
  await db.update(schema.staff).set({ email: ticket.email, recoveryEmail: null, userId: null }).where(eq(schema.staff.id, owner.id));
  await audit(null, "account.recovered", `${maskEmail(oldEmail ?? "")} -> ${maskEmail(ticket.email)}`);
  const business = await requireBusiness();
  if (oldEmail) await mailOwner(oldEmail, owner.locale ?? locale, "moved", { salon: business.name, email: maskEmail(ticket.email) });
  const next = `/${locale}/admin/account?recovered=1`;
  // A one-time sign-in link the browser opens itself (a full page load, so the sign-in cookie lands for sure).
  return { ok: true, go: await signInLink({ origin: salonUrl(), email: ticket.email, name: owner.name, next, errorNext: `/${locale}/signin?next=${encodeURIComponent(next)}` }) };
}
