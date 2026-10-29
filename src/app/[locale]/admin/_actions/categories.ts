"use server";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requirePermission } from "@/lib/access";
import { salonLanguages } from "@/lib/salon-languages";
import { legacyEsEn, readTexts, textIn } from "@/lib/texts";
import { siteChanged } from "@/lib/site/data";

/** Add a category, or rename one; services in it get the new names too. */
export async function saveCategory(form: FormData) {
  const me = await requirePermission("services", "edit");
  const id = form.get("id") ? z.uuid().parse(form.get("id")) : null;
  const { codes, fallback } = await salonLanguages();
  const names = readTexts(form, "name", codes, {}, 60);
  if (!names[codes[0]]) return;
  const legacy = legacyEsEn(names, fallback);
  if (id) {
    await db.update(schema.serviceCategory).set({ names, nameEs: legacy.es, nameEn: legacy.en }).where(eq(schema.serviceCategory.id, id));
    await db.update(schema.service).set({ categoryNames: names, category: legacy.es, categoryEn: legacy.en }).where(eq(schema.service.categoryId, id));
  } else {
    const [{ last }] = await db.select({ last: sql<number>`coalesce(max(${schema.serviceCategory.sortOrder}), 0)` }).from(schema.serviceCategory);
    await db.insert(schema.serviceCategory).values({ names, nameEs: legacy.es, nameEn: legacy.en, sortOrder: Number(last) + 1 });
  }
  await audit(me.userId, id ? "category.update" : "category.create", textIn(names, fallback));
  revalidatePath("/[locale]", "layout");
  await siteChanged();
}

/** Swap a category with its neighbour above or below. */
export async function moveCategory(id: string, dir: -1 | 1) {
  await requirePermission("services", "edit");
  const list = await db.query.serviceCategory.findMany({ orderBy: [asc(schema.serviceCategory.sortOrder), asc(schema.serviceCategory.createdAt)] });
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [n, c] of list.entries()) await db.update(schema.serviceCategory).set({ sortOrder: n + 1 }).where(eq(schema.serviceCategory.id, c.id));
  revalidatePath("/[locale]", "layout");
  await siteChanged();
}

/** Remove a category; its services stay, without a category. */
export async function deleteCategory(id: string) {
  const me = await requirePermission("services", "full");
  const cid = z.uuid().parse(id);
  await db.update(schema.service).set({ categoryNames: {}, category: null, categoryEn: null }).where(eq(schema.service.categoryId, cid));
  await db.delete(schema.serviceCategory).where(eq(schema.serviceCategory.id, cid));
  await audit(me.userId, "category.delete", cid);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
}
