"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { AccessError, audit, requirePermission, endSignIns } from "@/lib/access";
import type en from "../../../../../messages/en.json";
import { availableLanguages, messagesFor } from "@/i18n/messages";
import { type Access, AREAS, type Area, exceptionsFrom, grantable, isAccess, type Level, LEVELS, permissionsOf } from "@/lib/permissions";
import { requireBusiness } from "@/lib/booking";
import { pingIndexNow } from "@/lib/indexnow";
import { toE164 } from "@/lib/phone";
import { dueDayOf } from "@/lib/money";
import { salonLanguages } from "@/lib/salon-languages";
import { BUSINESS_TYPES } from "@/lib/templates";
import { applyTemplates, ownerId } from "@/lib/templates-apply";
import { normalizeKind } from "@/lib/stations";
import { legacyEsEn, readTexts } from "@/lib/texts";
import { weekHoursFrom } from "@/lib/week-hours";
import { siteChanged } from "@/lib/site/data";

const cents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return v === null || v === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};
const int = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Math.round(Number(v)));
/** The built-in station type names in every language the app speaks. */
const allKindNames = () => availableLanguages().map((l) => (messagesFor(l.code) as typeof en).admin.chairs.kinds);
const text = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** A small JPEG/PNG/WebP data URL from the photo picker, or null. */
function photoOf(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 300_000 ? s : null;
}

export async function saveStaff(locale: string, form: FormData) {
  const me = await requirePermission("team", "edit");
  const id = text(form.get("id"));
  const current = id ? await db.query.staff.findFirst({ where: eq(schema.staff.id, z.uuid().parse(id)) }) : null;
  if (id && !current) throw new Error("Not found");
  // Nobody changes someone above what they could grant (the owner, or a manager for a manager), except themselves.
  if (current && current.id !== me.id && !grantable(me, isAccess(current.access) ? current.access : "stylist")) throw new AccessError("Not allowed");
  const { access, permissions } = accessFrom(me, current, form);
  // The owner's email is their sign-in: it changes in Sign-in & security, with a link to the new address.
  const asked = text(form.get("email"))?.toLowerCase() ?? null;
  if (asked && !z.email().safeParse(asked).success) throw new Error("Invalid email");
  const email = current?.access === "owner" ? current.email : asked;
  // A new email has to prove itself: they're signed out here and linked again when they sign in with it.
  const emailChanged = Boolean(current) && (current!.email ?? null) !== email;
  const values = {
    name: z.string().min(1).parse(text(form.get("name"), 60)),
    lastName: text(form.get("lastName"), 60),
    jobTitle: text(form.get("jobTitle"), 60),
    phone: toE164(form.get("phone"), (await requireBusiness()).country),
    email,
    ...(emailChanged && { userId: null, inviteToken: null, inviteExpiresAt: null }),
    color: /^#[0-9a-f]{6}$/i.test(String(form.get("color"))) ? String(form.get("color")) : "#DCE8FB",
    photo: photoOf(form.get("photo")),
    title: text(form.get("title"))?.slice(0, 60) ?? null,
    access,
    permissions,
    // The older role column follows the access level.
    role: access === "owner" ? ("owner" as const) : access === "manager" ? ("admin" as const) : ("staff" as const),
    bookable: form.get("bookable") === "on",
    payModel: z.enum(["owner", "salary", "commission", "salary_commission", "chair_rent"]).parse(form.get("payModel") ?? "commission"),
    salaryCents: cents(form.get("salary")),
    commissionPct: int(form.get("commissionPct")),
    chairRentCents: cents(form.get("chairRent")),
    chairRentPeriod: form.get("every") === "week" ? "week" : "month",
    chairRentDay: dueDayOf(form.get("every"), form.get("day")),
    defaultChairId: text(form.get("defaultChairId")),
    ownsClients: access !== "owner" && form.get("ownsClients") === "on",
  };
  const staffId = await db.transaction(async (tx) => {
    let sid = id;
    if (sid) {
      await tx.update(schema.staff).set(values).where(eq(schema.staff.id, sid));
    } else {
      [{ id: sid }] = await tx.insert(schema.staff).values(values).returning({ id: schema.staff.id });
    }
    const serviceIds = form.getAll("services").map(String);
    await tx.delete(schema.staffService).where(eq(schema.staffService.staffId, sid!));
    // Their own duration where they set one (empty = the service's standard).
    const own = (id: string) => {
      const n = Number(form.get(`dur.${id}`));
      return Number.isInteger(n) && n >= 5 && n <= 600 ? n : null;
    };
    if (serviceIds.length) await tx.insert(schema.staffService).values(serviceIds.map((serviceId) => ({ staffId: sid!, serviceId, durationMin: own(serviceId) })));

    await tx.delete(schema.workingHours).where(eq(schema.workingHours.staffId, sid!));
    const hours = weekHoursFrom(form).map((h) => ({ ...h, staffId: sid! }));
    if (hours.length) await tx.insert(schema.workingHours).values(hours);
    return sid!;
  });
  if (emailChanged && current?.userId) await endSignIns(current.userId);
  await audit(me.userId, id ? "staff.update" : "staff.create", `${values.name} ${values.lastName ?? ""}`.trim());
  if (emailChanged) await audit(me.userId, "staff.email", `${values.name}: sign-in moved to the new email`);
  if (current && (current.access !== access || JSON.stringify(current.permissions) !== JSON.stringify(permissions))) {
    await audit(me.userId, "staff.access", `${values.name}: ${access}${Object.keys(permissions).length ? ` + ${JSON.stringify(permissions)}` : ""}`);
  }
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  // A new person goes straight to their page to send the invite.
  redirect(id ? `/${locale}/admin/staff` : `/${locale}/admin/staff/${staffId}?invite=1`);
}

/**
 * The access level and exceptions to save. The owner stays owner; only the owner hands out
 * manager access; nobody grants more in an area than they have themselves; someone who can't
 * grant a person's current level leaves it as it is.
 */
function accessFrom(me: { access: string; permissions: Record<string, string> }, current: { access: string; permissions: Record<string, string> } | null | undefined, form: FormData) {
  if (current?.access === "owner") return { access: "owner" as Access, permissions: {} };
  if (current && isAccess(current.access) && !grantable(me, current.access)) return { access: current.access, permissions: current.permissions };
  const asked = String(form.get("access") ?? "stylist");
  const access: Access = isAccess(asked) && asked !== "owner" && grantable(me, asked) ? asked : "stylist";
  if (form.get("customise") !== "on") return { access, permissions: {} };
  const mine = permissionsOf(me);
  const wanted: Partial<Record<Area, Level>> = {};
  for (const area of AREAS) {
    const v = String(form.get(`perm.${area}`) ?? "");
    if ((LEVELS as readonly string[]).includes(v) && LEVELS.indexOf(v as Level) <= LEVELS.indexOf(mine[area])) wanted[area] = v as Level;
  }
  return { access, permissions: exceptionsFrom(access, wanted) };
}

export async function removeStaff(locale: string, id: string) {
  const me = await requirePermission("team", "full");
  const row = await db.query.staff.findFirst({ where: eq(schema.staff.id, z.uuid().parse(id)) });
  if (!row || row.access === "owner" || (isAccess(row.access) && !grantable(me, row.access))) redirect(`/${locale}/admin/staff`);
  // Access ends at once: signed out everywhere, invite cancelled. Their visits and notes stay.
  if (row.userId) {
    await endSignIns(row.userId);
  }
  await db.update(schema.staff).set({ active: false, bookable: false, userId: null, inviteToken: null, inviteExpiresAt: null }).where(eq(schema.staff.id, row.id));
  await audit(me.userId, "staff.remove", `${row.name} ${row.lastName ?? ""}`.trim());
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/staff`);
}

/** The service's name, in the language the salon writes for its clients. */
async function serviceNames(form: FormData) {
  const { codes, fallback } = await salonLanguages();
  const names = readTexts(form, "name", codes, {}, 100);
  z.string().min(1).parse(names[codes[0]]);
  const legacy = legacyEsEn(names, fallback);
  return { names, nameEs: legacy.es, nameEn: legacy.en, descriptions: readTexts(form, "description", codes, {}, 400) };
}

/** The picked category, with a copy of its names on the service. */
async function categoryOf(v: FormDataEntryValue | null) {
  const id = typeof v === "string" && z.uuid().safeParse(v).success ? v : null;
  const c = id ? await db.query.serviceCategory.findFirst({ where: eq(schema.serviceCategory.id, id) }) : null;
  return { categoryId: c?.id ?? null, categoryNames: c?.names ?? {}, category: c?.nameEs ?? null, categoryEn: c?.nameEn ?? null };
}

export async function saveService(locale: string, form: FormData) {
  const me = await requirePermission("services", "edit");
  const id = text(form.get("id"));
  const values = {
    ...(await serviceNames(form)),
    ...(await categoryOf(form.get("categoryId"))),
    durationMin: z.number().int().min(5).max(600).parse(int(form.get("durationMin"))),
    bufferAfterMin: z.number().int().min(0).max(120).parse(int(form.get("bufferAfterMin")) ?? 0),
    priceCents: z.number().int().min(0).parse(cents(form.get("price")) ?? 0),
    stationKind: text(form.get("stationKind"), 40),
    rebookDays: int(form.get("rebookDays")) || null,
    active: form.get("active") === "on",
    colourCard: form.get("colourCard") === "on",
    needsConsent: form.get("needsConsent") === "on",
  };
  let sid = id;
  if (sid) await db.update(schema.service).set(values).where(eq(schema.service.id, sid));
  else {
    [{ id: sid }] = await db.insert(schema.service).values(values).returning({ id: schema.service.id });
    // A new service is done by everyone who is bookable; untick people on the staff page.
    const people = await db.query.staff.findMany({ where: and(eq(schema.staff.active, true), eq(schema.staff.bookable, true)) });
    if (people.length) await db.insert(schema.staffService).values(people.map((p) => ({ staffId: p.id, serviceId: sid! })));
  }
  await audit(me.userId, id ? "service.update" : "service.create", sid!);
  const business = await requireBusiness();
  pingIndexNow([`/${business.defaultLocale}/book`]);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/services`);
}

export async function saveChair(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const id = text(form.get("id"));
  const kind = z.string().min(1).parse(normalizeKind(String(form.get("kind") ?? ""), allKindNames()));
  const values = {
    name: z.string().min(1).parse(text(form.get("name"))),
    kind,
    shared: form.get("shared") === "on",
    renterStaffId: text(form.get("renterStaffId")),
    rentCents: cents(form.get("rent")),
  };
  let cid = id;
  if (cid) await db.update(schema.chair).set(values).where(eq(schema.chair.id, cid));
  else [{ id: cid }] = await db.insert(schema.chair).values(values).returning({ id: schema.chair.id });
  // A chair rented to someone is that person's usual chair.
  if (values.renterStaffId) {
    await db.update(schema.staff).set({ defaultChairId: cid }).where(eq(schema.staff.id, values.renterStaffId));
    await db
      .update(schema.chair)
      .set({ renterStaffId: null })
      .where(and(eq(schema.chair.renterStaffId, values.renterStaffId), ne(schema.chair.id, cid!)));
  }
  await audit(me.userId, id ? "chair.update" : "chair.create", cid!);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/chairs`);
}

export async function removeChair(locale: string, id: string) {
  const me = await requirePermission("settings", "full");
  await db.update(schema.chair).set({ active: false, renterStaffId: null }).where(eq(schema.chair.id, z.uuid().parse(id)));
  await audit(me.userId, "chair.remove", id);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/chairs`);
}

/** The salon's own name for the chairs & stations section; empty goes back to the default. */
export async function saveStationsLabel(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const { business: b, codes } = await salonLanguages();
  const labels = readTexts(form, "label", codes, {}, 40);
  await db
    .update(schema.business)
    .set({ stationsLabels: labels })
    .where(eq(schema.business.id, b.id));
  await audit(me.userId, "stations.label");
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/chairs`);
}

/** Settings › Services: add the typical services of one kind of business (hidden until priced). */
export async function addStarterServices(locale: string, type: string) {
  const me = await requirePermission("services", "edit");
  const t = z.enum(BUSINESS_TYPES).parse(type);
  const { business } = await salonLanguages();
  const count = await applyTemplates([t], business.defaultLocale, await ownerId());
  await audit(me.userId, "services.starter", t);
  revalidatePath("/[locale]/admin", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/services?starter=${count}`);
}
