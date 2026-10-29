"use server";
import { eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { audit, requirePermission } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { pingIndexNow } from "@/lib/indexnow";
import { salonUrl } from "@/lib/salon-url";
import { readConfig } from "@/lib/site/config";
import { siteChanged, websiteRow } from "@/lib/site/data";
import { okLogo, okPhoto } from "@/lib/image-rules";

/** A photo shrunk in the browser (see website-editor.tsx); anything else is refused. */

async function upsert(values: Partial<typeof schema.website.$inferInsert>) {
  const row = await websiteRow();
  const set = { draft: row.config, ...values, updatedAt: new Date() };
  await db.insert(schema.website).values(set).onConflictDoUpdate({ target: schema.website.businessId, set });
}

/**
 * Saves the draft as the owner edits (automatically, a moment after each change). Nothing changes
 * for clients until they publish.
 */
export async function saveDraft(raw: unknown): Promise<{ ok: true }> {
  await requirePermission("settings", "edit");
  await upsert({ draft: readConfig(raw) });
  return { ok: true };
}

/** The big photo at the top, on its own (photos are too big to send with every small change). */
export async function setHeroPhoto(data: string): Promise<{ ok: boolean }> {
  await requirePermission("settings", "edit");
  if (data && !okPhoto(data)) return { ok: false };
  await upsert({ heroDraft: data || null });
  return { ok: true };
}

/** Shows the draft to clients: the website, its photo, and a brand colour picked here (Business details). */
export async function publishWebsite(): Promise<{ ok: true }> {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  const row = await websiteRow();
  const config = row.config;
  if (config.brandColor && config.brandColor !== b.brandColor.toUpperCase()) {
    // The brand colour is the business's own: the booking page takes it too.
    await db.update(schema.business).set({ brandColor: config.brandColor }).where(eq(schema.business.id, b.id));
    revalidatePath("/[locale]", "layout");
  }
  const published = { ...config, brandColor: null };
  await upsert({ draft: published, published, heroPublished: row.heroDraft, publishedAt: new Date(), enabled: true });
  // Photos the website no longer uses are deleted.
  const kept = [...config.gallery.map((p) => p.id), ...(config.aboutPhoto ? [config.aboutPhoto] : [])];
  await db.delete(schema.websitePhoto).where(kept.length ? notInArray(schema.websitePhoto.id, kept) : undefined);
  await audit(me.userId, "website.publish");
  await siteChanged(b.id);
  pingIndexNow([`/${b.defaultLocale}`]);
  revalidatePath("/[locale]/admin/website", "page");
  return { ok: true };
}

/** The switch: show the published website at the salon's address, or the booking page as before. Takes effect at once. */
export async function setWebsiteOn(on: boolean): Promise<{ enabled: boolean }> {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  const row = await db.query.website.findFirst({ columns: { published: true } });
  // Only a published website can be switched on.
  const enabled = on && !!row?.published;
  if (row) await db.update(schema.website).set({ enabled }).where(eq(schema.website.businessId, b.id));
  await audit(me.userId, enabled ? "website.on" : "website.off");
  await siteChanged(b.id);
  if (enabled) pingIndexNow([`/${b.defaultLocale}`]);
  return { enabled };
}

/** Adds one gallery photo (one per request, so each stays small) and returns its id for the draft. */
export async function addGalleryPhoto(data: string): Promise<{ id: string } | { error: "invalid" | "full" }> {
  await requirePermission("settings", "edit");
  if (!okPhoto(data)) return { error: "invalid" };
  // Room for a full gallery plus the photos the published one still shows.
  if ((await db.$count(schema.websitePhoto)) >= 30) return { error: "full" };
  const [row] = await db.insert(schema.websitePhoto).values({ data }).returning({ id: schema.websitePhoto.id });
  return { id: row.id };
}

/**
 * The salon's logo, from the website screen. It's the business's own (Business details): the
 * booking page, emails and the website all use it, so it changes at once.
 */
export async function setLogo(data: string): Promise<{ ok: boolean }> {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  if (data && !okLogo(data)) return { ok: false };
  await db.update(schema.business).set({ logo: data || null, logoOriginal: data || null }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.logo");
  revalidatePath("/[locale]", "layout");
  await siteChanged(b.id);
  return { ok: true };
}


