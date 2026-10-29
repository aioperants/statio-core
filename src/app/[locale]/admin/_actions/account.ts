"use server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireOwner, requireStaff } from "@/lib/access";
import { auth } from "@/lib/auth";
import { requireBusiness } from "@/lib/booking";
import { tooMany } from "@/lib/limits";
import { CONFIRM_HOURS, mailOwner, maskEmail, newTicket, teamUses } from "@/lib/recovery";
import { salonUrl } from "@/lib/salon-url";

/**
 * "Sign out on all other devices": for a lost or stolen phone, or a shared computer. Every other
 * sign-in of this person ends; this device stays signed in.
 */
export async function signOutOtherDevices(): Promise<{ ok: true }> {
  const me = await requireStaff();
  await auth.api.revokeOtherSessions({ headers: await headers() });
  await audit(me.userId, "account.signout_others");
  return { ok: true };
}

export type RecoveryState = { sent?: string; error?: "email" | "same" | "team" | "tooMany" };

/** The owner's second email: a link goes to it, and it counts once that link is tapped. */
export async function setRecoveryEmail(locale: string, _prev: RecoveryState, form: FormData): Promise<RecoveryState> {
  const me = await requireOwner();
  const parsed = z.email().max(200).safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "email" };
  const email = parsed.data;
  if (email === me.user.email.toLowerCase() || email === me.email?.toLowerCase()) return { error: "same" };
  // Someone on the team signs in with it: as the owner's second email it would move the owner onto their sign-in.
  if (await teamUses(email)) return { error: "team" };
  if (await tooMany(`recovery-set:${me.id}`, 5, 3600)) return { error: "tooMany" };
  const business = await requireBusiness();
  const token = await newTicket("recovery-confirm", { salonId: business.id, staffId: me.id, email }, CONFIRM_HOURS * 60);
  await mailOwner(email, me.locale ?? locale, "confirm", { salon: business.name, link: `${salonUrl()}/${locale}/recovery/confirm/${token}`, hours: String(CONFIRM_HOURS) });
  await audit(me.userId, "account.recovery_asked", maskEmail(email));
  return { sent: email };
}

/** Takes the second email off. The owner's main email is told, in case it wasn't them. */
export async function removeRecoveryEmail(locale: string): Promise<{ ok: true }> {
  const me = await requireOwner();
  if (!me.recoveryEmail) return { ok: true };
  await db.update(schema.staff).set({ recoveryEmail: null }).where(eq(schema.staff.id, me.id));
  await audit(me.userId, "account.recovery_removed", maskEmail(me.recoveryEmail));
  const business = await requireBusiness();
  await mailOwner(me.user.email, me.locale ?? locale, "removed", { salon: business.name, email: maskEmail(me.recoveryEmail) });
  revalidatePath("/[locale]/admin/account", "page");
  return { ok: true };
}
