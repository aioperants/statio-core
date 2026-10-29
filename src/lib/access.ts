import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentSalonId, db, schema } from "@/db";
import { auth } from "./auth";
import { allows, type Area, type Level } from "./permissions";

export type StaffRole = "owner" | "admin" | "staff";

/**
 * The signed-in person, if they signed in on this salon's address. Accounts are shared by every
 * salon, but a sign-in belongs to the salon it was made on.
 */
export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
}

/**
 * The staff record for the signed-in user, linking it on first sign-in.
 * Staff are matched by the email the owner entered when inviting them;
 * the OWNER_EMAIL becomes the owner if no owner exists yet.
 */
export async function getStaffMember() {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;

  const linked = await db.query.staff.findFirst({ where: eq(schema.staff.userId, user.id) });
  // Removed or paused: no access, whatever they signed in with.
  if (linked) return linked.active && !linked.pausedAt ? { ...linked, user } : null;

  // Only someone still on the team, and not paused, is linked (a removed person's row must not grab them again).
  const invited = await db.query.staff.findFirst({
    where: and(sql`lower(${schema.staff.email}) = lower(${user.email})`, isNull(schema.staff.userId), eq(schema.staff.active, true), isNull(schema.staff.pausedAt)),
  });
  if (invited && user.emailVerified) {
    // Linked: their invite link has done its job.
    await db.update(schema.staff).set({ userId: user.id, inviteToken: null, inviteExpiresAt: null }).where(eq(schema.staff.id, invited.id));
    return invited.active ? { ...invited, userId: user.id, user } : null;
  }
  return null;
}

/**
 * Who may set up this salon: its owner, or without an owner yet, OWNER_EMAIL (or, if that isn't
 * set, the first person).
 */
export async function maySetUp(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if (!session.user.emailVerified) return false;
  const member = await getStaffMember();
  if (member) return member.role === "owner";
  if (await db.query.staff.findFirst({ columns: { id: true } })) return false;
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  return ownerEmail ? session.user.email.toLowerCase() === ownerEmail : true;
}

/** Signs this person out on every device, and drops a password someone else may know: they choose a new one from the new invite. */
export async function endSignIns(userId: string) {
  await db.delete(schema.session).where(eq(schema.session.userId, userId));
  await db.delete(schema.account).where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
}

export class AccessError extends Error {}

/** Throws unless the signed-in user is staff with one of `roles`. */
export async function requireStaff(roles: StaffRole[] = ["owner", "admin", "staff"]) {
  const member = await getStaffMember();
  if (!member || !roles.includes(member.role)) throw new AccessError("Not allowed");
  return member;
}

/** Throws unless the signed-in person may do at least `level` in `area` (see lib/permissions). */
export async function requirePermission(area: Area, level: Exclude<Level, "none">) {
  const member = await getStaffMember();
  if (!member || !allows(member, area, level)) throw new AccessError("Not allowed");
  return member;
}
export const requireOwner = () => requireStaff(["owner"]);

export type Member = { id: string; access: string; permissions?: Record<string, string> | null };

/** Sees (and, with "edit", manages) everyone's visits, not only their own. */
export const seesAllVisits = (me: Member) => allows(me, "calendar", "view");
export const managesAllVisits = (me: Member) => allows(me, "calendar", "edit");

/**
 * Clients belong to the salon, except those of someone who owns their clients (a chair renter):
 * only that person and people with full client access (the owner, managers) see those.
 */
export function clientsVisibleTo(me: Member) {
  return allows(me, "clients", "full") ? undefined : or(isNull(schema.client.ownerStaffId), eq(schema.client.ownerStaffId, me.id));
}
export const canSeeClient = (me: Member, c: { ownerStaffId: string | null }) => allows(me, "clients", "full") || !c.ownerStaffId || c.ownerStaffId === me.id;
/** Changing a client: with client edit access, or always for their own clients. */
export const canEditClient = (me: Member, c: { ownerStaffId: string | null }) =>
  c.ownerStaffId === me.id || (allows(me, "clients", "edit") && canSeeClient(me, c));

export async function audit(userId: string | null, action: string, detail?: string) {
  await db.insert(schema.auditLog).values({ userId, action, detail });
}

/** For admin pages: the staff member, or a redirect to sign-in / setup. */
export async function staffForPage(locale: string, roles: StaffRole[] = ["owner", "admin", "staff"]) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/admin`)}`);
  const business = await db.query.business.findFirst({ columns: { setupDone: true } });
  if (!business?.setupDone) redirect(`/${locale}/setup`);
  const member = await getStaffMember();
  if (!member || !roles.includes(member.role)) return null;
  return member;
}

/**
 * For admin pages. Layouts and pages render in parallel, so each page checks access itself
 * instead of relying on the layout.
 */
export async function pageMember(locale: string) {
  const member = await staffForPage(locale);
  if (!member) notFound();
  return member;
}
