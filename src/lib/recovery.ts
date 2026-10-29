import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { createTranslator } from "next-intl";
import type en from "../../messages/en.json";
import { currentSalonId, db, schema } from "@/db";
import { messagesFor } from "@/i18n/messages";
import { sendAccountEmail } from "./email";

/**
 * Getting the owner back in when they lose the email they sign in with. The owner adds a second
 * email (confirmed by a link sent to it). If they lose the first one, a link sent to the second
 * moves the owner's sign-in there: the old email's sign-ins at the salon end, and the old email is
 * told.
 *
 * Links are random, kept hashed and work once.
 */

export const CONFIRM_HOURS = 24;
export const RECOVERY_MINUTES = 30;

type Kind = "recovery-confirm" | "owner-recovery";
type Ticket = { salonId: string; staffId: string; email: string };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A one-time link token for this salon's owner, valid for `minutes`. */
export async function newTicket(kind: Kind, ticket: Ticket, minutes: number): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.insert(schema.verification).values({
    id: randomUUID(),
    identifier: `${kind}:${hash(token)}`,
    value: JSON.stringify(ticket),
    expiresAt: new Date(Date.now() + minutes * 60_000),
  });
  return token;
}

/** What a link is for, without using it up (to show the confirm screen); null if it's gone. */
export async function peekTicket(kind: Kind, token: string): Promise<Ticket | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = await db.query.verification.findFirst({
    where: and(eq(schema.verification.identifier, `${kind}:${hash(token)}`), gt(schema.verification.expiresAt, new Date())),
  });
  return row ? forThisSalon(row.value) : null;
}

/** Uses the link up (once, even with two taps at once) and says what it was for; null if it's gone. */
export async function useTicket(kind: Kind, token: string): Promise<Ticket | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .delete(schema.verification)
    .where(and(eq(schema.verification.identifier, `${kind}:${hash(token)}`), gt(schema.verification.expiresAt, new Date())))
    .returning({ value: schema.verification.value });
  return row ? forThisSalon(row.value) : null;
}

async function forThisSalon(value: string): Promise<Ticket | null> {
  try {
    const t = JSON.parse(value) as Ticket;
    return t.salonId && t.salonId === (await currentSalonId()) ? t : null;
  } catch {
    return null;
  }
}

/** The salon's owner whose confirmed recovery email this is, if any. */
export async function ownerByRecoveryEmail(email: string) {
  return db.query.staff.findFirst({
    where: and(eq(schema.staff.role, "owner"), eq(schema.staff.active, true), sql`lower(${schema.staff.recoveryEmail}) = lower(${email})`),
  });
}

/** Whether someone on this salon's team already uses this email (it can't then be the owner's second one). */
export async function teamUses(email: string) {
  return Boolean(await db.query.staff.findFirst({ where: sql`lower(${schema.staff.email}) = lower(${email})`, columns: { id: true } }));
}

type RecoveryMail = keyof typeof en.emails.recovery;

/** One of the recovery emails, in the owner's language, through our own mail setup (never the salon's). */
export async function mailOwner(to: string, locale: string, which: RecoveryMail, vars: Record<string, string>) {
  const t = createTranslator({ locale, messages: messagesFor(locale) as typeof en, namespace: `emails.recovery.${which}` as "emails.recovery.confirm" });
  return sendAccountEmail({ to, template: `recovery_${which}`, subject: t("subject", vars), text: t("body", vars) });
}

/** "m***@gmail.com": enough for the owner to recognise it, not enough to read it off a screen. */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain ?? ""}`;
}
