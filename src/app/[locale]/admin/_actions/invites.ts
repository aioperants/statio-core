"use server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requirePermission, endSignIns } from "@/lib/access";
import { getBusiness } from "@/lib/booking";
import { salonUrl } from "@/lib/salon-url";
import { sendEmail } from "@/lib/email";
import { grantable, isAccess } from "@/lib/permissions";
import { siteChanged } from "@/lib/site/data";

const DAYS = 7;

/** Someone the signed-in person may manage (not the owner, nobody above their own access). */
async function manageable(id: string) {
  const me = await requirePermission("team", "edit");
  const row = await db.query.staff.findFirst({ where: eq(schema.staff.id, z.uuid().parse(id)) });
  if (!row || !row.active || row.access === "owner" || (isAccess(row.access) && !grantable(me, row.access))) throw new Error("Not allowed");
  return { me, row };
}

/** A fresh personal invite link (the old one stops working). It works once and lasts 7 days. */
export async function createInvite(locale: string, id: string) {
  const { me, row } = await manageable(id);
  if (!row.email) return { ok: false as const, error: "email" };
  if (row.pausedAt) return { ok: false as const, error: "paused" };
  const token = randomBytes(24).toString("base64url");
  await db.update(schema.staff).set({ inviteToken: token, inviteExpiresAt: new Date(Date.now() + DAYS * 86_400_000) }).where(eq(schema.staff.id, row.id));
  await audit(me.userId, "staff.invite", `${row.name} ${row.lastName ?? ""}`.trim());
  revalidatePath("/[locale]/admin/staff", "layout");
  await siteChanged();
  return { ok: true as const, link: `${salonUrl()}/${locale}/join/${token}` };
}

/** Emails the invite link to them, in the owner's words. */
export async function emailInvite(locale: string, id: string) {
  const r = await createInvite(locale, id);
  if (!r.ok) return r;
  const { row } = await manageable(id);
  const business = await getBusiness();
  const t = await getTranslations({ locale, namespace: "emails.staffInvite" });
  const vars = { name: row.name, salon: business?.name ?? "", link: r.link, days: DAYS };
  await sendEmail({ to: row.email!, subject: t("subject", vars), text: t("body", vars), template: "staff_invite" });
  return r;
}

/**
 * Signs them out on every device and unlinks their sign-in, then gives a new invite link:
 * for a lost phone, a shared or known password, or a changed email.
 */
export async function resetAccess(locale: string, id: string) {
  const { me, row } = await manageable(id);
  if (row.userId) {
    await endSignIns(row.userId);
  }
  await db.update(schema.staff).set({ userId: null }).where(eq(schema.staff.id, row.id));
  await audit(me.userId, "staff.reset", `${row.name} ${row.lastName ?? ""}`.trim());
  return createInvite(locale, id);
}

/**
 * "Pause access": signed out at once on every device, and no way back in until it's turned back on.
 * They stay on the team: in the calendar, bookable, with their history. For a holiday, a leave, a
 * doubt; "Remove from team" is for someone who has left.
 */
export async function pauseAccess(locale: string, id: string) {
  const { me, row } = await manageable(id);
  if (row.userId) await endSignIns(row.userId);
  await db.update(schema.staff).set({ pausedAt: new Date(), inviteToken: null, inviteExpiresAt: null }).where(eq(schema.staff.id, row.id));
  await audit(me.userId, "staff.pause", `${row.name} ${row.lastName ?? ""}`.trim());
  revalidatePath("/[locale]/admin/staff", "layout");
  return { ok: true as const };
}

/** "Turn access back on": they sign in again as before (with the email on their profile). */
export async function resumeAccess(locale: string, id: string) {
  const { me, row } = await manageable(id);
  await db.update(schema.staff).set({ pausedAt: null }).where(eq(schema.staff.id, row.id));
  await audit(me.userId, "staff.resume", `${row.name} ${row.lastName ?? ""}`.trim());
  revalidatePath("/[locale]/admin/staff", "layout");
  return { ok: true as const };
}
