"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { audit, requirePermission } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { okLogo, okPhoto } from "@/lib/image-rules";
import { prepareLogo } from "@/lib/logo-prep";
import { LAYOUTS } from "@/lib/site/config";
import { siteChanged, websiteRow } from "@/lib/site/data";

/**
 * Pictures changed right on the website preview (the camera buttons): cover photo, logo and the
 * square icon. For setup and Settings › Your website alike. The cover goes into the website being
 * edited (published with the next "Publish"); the logo and icon are the salon's own, so they change
 * everywhere at once.
 */
async function editor() {
  const me = await requirePermission("settings", "edit");
  return { me, b: await requireBusiness() };
}

async function done(b: { id: string }) {
  await siteChanged(b.id);
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** The cover (made wide and bright in the browser); "" = none (an example shows in the preview). */
export async function setCover(data: string): Promise<{ ok: boolean }> {
  const { me, b } = await editor();
  if (data && !okPhoto(data)) return { ok: false };
  const row = await websiteRow();
  // A cover on a top that shows none (the brand-colour layout) switches it to the big photo.
  const draft = data ? { ...row.config, pieces: row.config.pieces.map((p) => (p.key === "hero" && p.layout === "brand" ? { ...p, layout: "photo" } : p)) } : row.config;
  const set = { draft, heroDraft: data || null, updatedAt: new Date() };
  await db.insert(schema.website).values(set).onConflictDoUpdate({ target: schema.website.businessId, set });
  await audit(me.userId, "website.hero");
  return done(b);
}

/** A logo file; "" = their salon's name. */
export async function setLogo(data: string): Promise<{ ok: boolean }> {
  const { me, b } = await editor();
  if (data && !okLogo(data)) return { ok: false };
  await db.update(schema.business).set({ logo: data || null, logoOriginal: data || null }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.logo");
  return done(b);
}

/** The square icon they made (512 px, from the browser); "" = made from the logo again. */
export async function setIcon(data: string): Promise<{ ok: boolean }> {
  const { me, b } = await editor();
  if (data && !(okPhoto(data) && data.length < 600_000)) return { ok: false };
  await db.update(schema.business).set({ icon: data || null }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.icon");
  return done(b);
}

/** A team member's photo (square, from the browser); "" removes it. */
export async function setStaffPhoto(staffId: string, data: string): Promise<{ ok: boolean }> {
  const me = await requirePermission("team", "edit");
  const b = await requireBusiness();
  if (data && !(okPhoto(data) && data.length < 300_000)) return { ok: false };
  const done_ = await db.update(schema.staff).set({ photo: data || null }).where(eq(schema.staff.id, staffId)).returning({ id: schema.staff.id });
  if (!done_.length) return { ok: false };
  await audit(me.userId, "staff.photo", staffId);
  return done(b);
}

/** The top of the website: a big photo behind the name, a photo beside it, or no photo (the salon's colours). */
export async function setHeroLayout(layout: string): Promise<{ ok: boolean }> {
  const { me, b } = await editor();
  if (!(LAYOUTS.hero as readonly string[]).includes(layout)) return { ok: false };
  const row = await websiteRow();
  const draft = { ...row.config, pieces: row.config.pieces.map((p) => (p.key === "hero" ? { ...p, on: true, layout } : p)) };
  await db.insert(schema.website).values({ draft, updatedAt: new Date() }).onConflictDoUpdate({ target: schema.website.businessId, set: { draft, updatedAt: new Date() } });
  await audit(me.userId, "website.hero_layout", layout);
  return done(b);
}

/**
 * A logo just picked, made ready to adjust: its empty margin cut off and, when it sits on one plain
 * colour, also a version without that background ("Remove background").
 */
export async function prepareLogoUpload(data: string) {
  await editor();
  if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(data) || data.length > 4_000_000) return null;
  return prepareLogo(data);
}

/** The adjusted logo (used everywhere) and the trimmed upload it was made from (to adjust again). */
export async function saveAdjustedLogo(logo: string, original: string | null): Promise<{ ok: boolean }> {
  const { me, b } = await editor();
  if (!okLogo(logo) || (original && !okLogo(original))) return { ok: false };
  await db.update(schema.business).set({ logo, logoOriginal: original }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.logo");
  return done(b);
}
