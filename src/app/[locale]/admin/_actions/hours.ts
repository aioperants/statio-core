"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requirePermission } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { pingIndexNow } from "@/lib/indexnow";
import { addDays, isValidDay, localToUtc } from "@/lib/time";
import { weekHoursFrom } from "@/lib/week-hours";
import { siteChanged } from "@/lib/site/data";

/** The salon's weekly opening hours; nobody can be booked outside them. */
export async function saveOpeningHours(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const rows = weekHoursFrom(form);
  await db.transaction(async (tx) => {
    await tx.delete(schema.businessHours);
    if (rows.length) await tx.insert(schema.businessHours).values(rows);
  });
  await audit(me.userId, "opening_hours.update");
  const business = await requireBusiness();
  pingIndexNow([`/${business.defaultLocale}/book`]);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/settings/hours?saved=1`);
}

/** Closed for whole days (holidays, closures): the salon-wide block online booking and the calendar already respect. */
export async function addClosure(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  const day = z.string().refine(isValidDay);
  const from = day.parse(form.get("from"));
  const to = form.get("to") ? day.parse(form.get("to")) : from;
  if (to < from) redirect(`/${locale}/admin/settings/hours?error=dates`);
  await db.insert(schema.timeOff).values({
    staffId: null,
    startsAt: localToUtc(from, 0, b.timezone),
    endsAt: localToUtc(addDays(to, 1), 0, b.timezone),
    reason: String(form.get("reason") ?? "").trim().slice(0, 80) || null,
  });
  await audit(me.userId, "closure.add", `${from}..${to}`);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/settings/hours`);
}

export async function removeClosure(locale: string, id: string) {
  const me = await requirePermission("settings", "edit");
  await db.delete(schema.timeOff).where(and(eq(schema.timeOff.id, z.uuid().parse(id)), isNull(schema.timeOff.staffId)));
  await audit(me.userId, "closure.remove", id);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/settings/hours`);
}

/** "Add public holidays": the ticked days become ordinary closed days (one per day, the holiday as reason). */
export async function addHolidays(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  const picked = form
    .getAll("day")
    .map((v) => String(v).split("|"))
    .filter(([d]) => isValidDay(d))
    .slice(0, 60);
  const existing = await db.query.timeOff.findMany({ where: isNull(schema.timeOff.staffId), columns: { startsAt: true } });
  const taken = new Set(existing.map((e) => +e.startsAt));
  const rows = picked
    .map(([d, name]) => ({ staffId: null, startsAt: localToUtc(d, 0, b.timezone), endsAt: localToUtc(addDays(d, 1), 0, b.timezone), reason: (name ?? "").slice(0, 80) || null }))
    .filter((r) => !taken.has(+r.startsAt));
  if (rows.length) await db.insert(schema.timeOff).values(rows);
  const region = String(form.get("region") ?? "");
  if (/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(region)) await db.update(schema.business).set({ holidayRegion: region }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "closure.add", `holidays ${rows.length}`);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/settings/hours?holidays=${rows.length}`);
}
