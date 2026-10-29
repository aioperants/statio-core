import "server-only";
import { and, eq, gt, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Business } from "./booking";
import { readConfig } from "./site/config";

/** The design of the top of the website: "photo", "split" or "brand" (no photo). */
export const heroLayout = (draft: unknown) => readConfig(draft).pieces.find((p) => p.key === "hero")?.layout ?? "photo";

/**
 * "Your salon is N% ready": what's left after setup, each with where to do it (Today shows the
 * ones still to do). Runs as the salon.
 */
export async function readiness(b: Business) {
  const [priced, hours, site, team, invited, rules, photos] = await Promise.all([
    db.$count(schema.service, and(eq(schema.service.active, true), gt(schema.service.priceCents, 0))),
    db.$count(schema.businessHours),
    db.query.website.findFirst({ columns: { enabled: true, publishedAt: true, heroDraft: true, heroPublished: true, draft: true } }),
    db.$count(schema.staff, and(eq(schema.staff.active, true), ne(schema.staff.role, "owner"))),
    db.query.staff.findMany({ where: and(eq(schema.staff.active, true), ne(schema.staff.role, "owner")), columns: { email: true } }),
    db.$count(schema.auditLog, eq(schema.auditLog.action, "rules.update")),
    db.$count(schema.websitePhoto),
  ]);
  const items = [
    // Every website starts without photos: theirs are added in the editor.
    { key: "design", done: Boolean(site?.heroPublished ?? site?.heroDraft) || photos > 0, href: "/admin/website" },
    { key: "services", done: priced > 0, href: "/admin/services" },
    { key: "hours", done: hours > 0, href: "/admin/settings/hours" },
    ...(team > 0 ? [{ key: "team", done: invited.every((s) => Boolean(s.email)), href: "/admin/staff" }] : []),
    { key: "rules", done: rules > 0, href: "/admin/rules" },
    { key: "website", done: Boolean(site?.enabled && site.publishedAt), href: "/admin/website" },
    { key: "google", done: Boolean(b.foundChecklist?.google), href: "/admin/settings/found?part=google" },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, percent: Math.round((done / items.length) * 100) };
}
