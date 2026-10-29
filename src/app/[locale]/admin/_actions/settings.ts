"use server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, forgetSalon, schema } from "@/db";
import { isAvailable } from "@/i18n/messages";
import { audit, getSession, maySetUp, requireStaff, requirePermission } from "@/lib/access";
import { getBusiness, requireBusiness } from "@/lib/booking";
import { FOUND_STEPS, profileUrl, webUrl } from "@/lib/found-online";
import { pingIndexNow } from "@/lib/indexnow";
import { isCountry, toE164 } from "@/lib/phone";

/** The country picked in a form ("ES"), or the one already set. */
const countryOf = (v: FormDataEntryValue | null, current: string | null) => (isCountry(String(v)) ? String(v) : v === "" ? null : current);
import { HEARD_BUILT_IN } from "@/lib/heard";
import { allows } from "@/lib/permissions";
import { salonLanguages } from "@/lib/salon-languages";
import { SLOT_MODES } from "@/lib/slots";
import { APP_COLOURS } from "@/lib/app-colours";
import { BUSINESS_TYPES } from "@/lib/templates";
import { applyTemplates, ownerId } from "@/lib/templates-apply";
import { readTexts } from "@/lib/texts";
import { bookingLookOf } from "@/lib/booking-look";
import { welcomeDefaults } from "@/lib/welcome-texts";
import { siteChanged } from "@/lib/site/data";
import { okLogo } from "@/lib/image-rules";
import { sayHello } from "@/lib/core-hello";

const num = (v: FormDataEntryValue | null, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== null && v !== "" ? Math.min(Math.max(n, min), max) : fallback;
};
const text = (v: FormDataEntryValue | null, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** How times are offered online; `compactDay` stays in step for older app versions. */
function slotModeOf(value: FormDataEntryValue | null, current: string) {
  const slotMode = (SLOT_MODES as readonly string[]).includes(String(value)) ? String(value) : current;
  return { slotMode, compactDay: slotMode === "only" };
}

/** The ticked built-in answers, then the owner's own (comma-separated), with "Other" last. */
function heardOptionsFrom(form: FormData) {
  const ticked = form.getAll("heardOption").map(String).filter((o) => (HEARD_BUILT_IN as readonly string[]).includes(o));
  const own = String(form.get("heardCustom") ?? "")
    .split(",")
    .map((o) => o.trim().slice(0, 40))
    .filter((o) => o && !(HEARD_BUILT_IN as readonly string[]).includes(o.toLowerCase()))
    .slice(0, 8);
  const built = HEARD_BUILT_IN.filter((o) => o !== "other" && ticked.includes(o));
  return [...new Set([...built, ...own, ...(ticked.includes("other") ? ["other"] : [])])];
}

export async function saveRules(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const { business: b, codes } = await salonLanguages();
  // Kept only when changed from ours (plain words), so ours is used otherwise.
  const ours = (code: string) => welcomeDefaults(code).message.trim();
  const welcome = Object.fromEntries(Object.entries(readTexts(form, "welcomeText", codes, b.welcomeTexts, 600)).filter(([code, v]) => v.trim() !== ours(code)));
  const daily = form.get("dailyLimit");
  await db
    .update(schema.business)
    .set({
      autoApprove: form.get("autoApprove") === "on",
      noShowApprovalThreshold: num(form.get("noShowApprovalThreshold"), 1, 10, b.noShowApprovalThreshold),
      maxFutureBookingsNewClient: num(form.get("maxFutureBookingsNewClient"), 1, 20, b.maxFutureBookingsNewClient),
      ...slotModeOf(form.get("slotMode"), b.slotMode),
      dailyLimit: daily === "" || daily === null ? null : num(daily, 1, 50, 5),
      leadMinutes: num(form.get("leadMinutes"), 0, 7 * 1440, b.leadMinutes),
      horizonDays: num(form.get("horizonDays"), 1, 365, b.horizonDays),
      slotStepMin: [5, 10, 15, 20, 30, 60].includes(Number(form.get("slotStepMin"))) ? Number(form.get("slotStepMin")) : b.slotStepMin,
      cancellationHours: num(form.get("cancellationHours"), 0, 168, b.cancellationHours),
      askHeardFrom: form.get("askHeardFrom") === "on",
      askCity: form.get("askCity") === "on",
      heardOptions: heardOptionsFrom(form),
      // Written once, in the salon's client language.
      welcomeTexts: welcome,
    })
    .where(eq(schema.business.id, b.id));
  await audit(me.userId, "rules.update");
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/rules?saved=1`);
}

/** The one language clients see (booking page, emails, messages): one the app speaks. */
function clientLanguage(form: FormData, current: string) {
  const asked = String(form.get("defaultLocale"));
  const defaultLocale = isAvailable(asked) ? asked : current;
  return { defaultLocale, websiteLocales: [defaultLocale] };
}

export async function saveSalon(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  const logo = String(form.get("logo") ?? "");
  const tz = String(form.get("timezone") ?? b.timezone);
  await db
    .update(schema.business)
    .set({
      name: z.string().min(1).max(100).parse(text(form.get("name"))),
      phone: toE164(form.get("phone"), countryOf(form.get("country"), b.country)),
      country: countryOf(form.get("country"), b.country),
      email: text(form.get("email"), 200),
      address: text(form.get("address")),
      appColours: APP_COLOURS.find((c) => c === form.get("appColours")) ?? b.appColours,
      logo: logo === "" ? null : okLogo(logo) ? logo : b.logo,
      // The trimmed upload behind an adjusted logo, to adjust it again.
      logoOriginal: logo === "" ? null : okLogo(String(form.get("logoOriginal") ?? "")) ? String(form.get("logoOriginal")) : okLogo(logo) ? logo : b.logoOriginal,
      timezone: Intl.supportedValuesOf("timeZone").includes(tz) ? tz : b.timezone,
      currency: /^[A-Z]{3}$/.test(String(form.get("currency"))) ? String(form.get("currency")) : b.currency,
      // Website and profiles: typed as handles or addresses, kept as full links.
      website: webUrl(form.get("website")),
      about: text(form.get("about"), 300),
      businessTypes: BUSINESS_TYPES.filter((type) => form.getAll("businessTypes").includes(type)),
      instagram: profileUrl("instagram", form.get("instagram")),
      facebook: profileUrl("facebook", form.get("facebook")),
      tiktok: profileUrl("tiktok", form.get("tiktok")),
      // Booking marketplaces (Booksy, Fresha…) are no longer kept: clients should book with the salon itself.
      otherLinks: [],
    })
    .where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.update");
  pingIndexNow([`/${b.defaultLocale}/book`]);
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${locale}/admin/salon?saved=1`);
}

/** First run: the salon's basics, and the signed-in owner as its first team member. */
export async function setupSalon(locale: string, form: FormData) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/${locale}/setup`);
  const existing = await getBusiness();
  if (existing?.setupDone) redirect(`/${locale}/admin`);
  if (!(await maySetUp(session))) {
    throw new Error("Only the owner can set up the salon");
  }
  const name = z.string().min(1).max(100).parse(text(form.get("name")));
  const tz = String(form.get("timezone"));
  const values = {
    name,
    timezone: Intl.supportedValuesOf("timeZone").includes(tz) ? tz : "Europe/Madrid",
    currency: /^[A-Z]{3}$/.test(String(form.get("currency"))) ? String(form.get("currency")) : "EUR",
    ...clientLanguage(form, "es"),
    email: existing?.email || session.user.email,
    country: countryOf(form.get("country"), null),
    businessTypes: BUSINESS_TYPES.filter((type) => form.getAll("types").includes(type)),
    setupDone: true,
  };
  const ownerLocale = isAvailable(String(form.get("ownerLocale"))) ? String(form.get("ownerLocale")) : locale;
  const ownerName = text(form.get("ownerName")) ?? session.user.name ?? "Owner";
  const id = existing?.id ?? randomUUID();
  await db.transaction(async (tx) => {
    if (existing) await tx.update(schema.business).set(values).where(eq(schema.business.id, existing.id));
    else await tx.insert(schema.business).values({ ...values, id, autoApprove: false, appColours: "neutral" });
    // The owner (linked to this account on first sign-in), or a new one.
    const mine = await tx.query.staff.findFirst({ where: and(eq(schema.staff.role, "owner"), eq(schema.staff.userId, session.user.id)) });
    const owner = mine
      ? (await tx.update(schema.staff).set({ name: ownerName, locale: ownerLocale }).where(eq(schema.staff.id, mine.id)).returning())[0]
      : (
          await tx
            .insert(schema.staff)
            .values({
              name: ownerName,
              email: session.user.email.toLowerCase(),
              userId: session.user.id,
              role: "owner",
              access: "owner",
              payModel: "owner",
              color: "#F6D9E6",
              // The owner's own admin language, separate from the clients' one.
              locale: ownerLocale,
            })
            .returning()
        )[0];
    // Default hours Monday–Friday 9:00–18:00 and Saturday 9:00–14:00; change them on the staff page.
    if ((await tx.$count(schema.workingHours, eq(schema.workingHours.staffId, owner.id))) === 0) {
      await tx.insert(schema.workingHours).values([
        ...[0, 1, 2, 3, 4].map((weekday) => ({ staffId: owner.id, weekday, startMin: 540, endMin: 1080 })),
        { staffId: owner.id, weekday: 5, startMin: 540, endMin: 840 },
      ]);
    }
  });
  // Typical services, groups and chairs for the kind of business they ticked (hidden until priced).
  const types = BUSINESS_TYPES.filter((type) => form.getAll("types").includes(type));
  if (types.length) {
    await applyTemplates(types, values.defaultLocale, await ownerId());
    // Usual opening hours to start from: Monday–Friday 9:00–19:00, Saturday 9:00–14:00.
    if ((await db.$count(schema.businessHours)) === 0) {
      await db.insert(schema.businessHours).values([
        ...[0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 540, endMin: 1140 })),
        { weekday: 5, startMin: 540, endMin: 840 },
      ]);
    }
  }
  await audit(session.user.id, "salon.setup");
  // Statio Core: count this install, with the owner's email only if they asked for updates.
  await sayHello("install", {
    country: values.country,
    locale: ownerLocale,
    ...(form.get("updates") === "on" && { contact: { email: session.user.email.toLowerCase(), salon: name } }),
  });
  forgetSalon();
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${ownerLocale}/admin/services`);
}

/** Settings › Language: this person's own app language and, for the owner or a manager, the clients' language. */
export async function saveLanguages(locale: string, form: FormData) {
  const me = await requireStaff();
  const mine = String(form.get("mine"));
  if (isAvailable(mine)) await db.update(schema.staff).set({ locale: mine }).where(eq(schema.staff.id, me.id));
  if (allows(me, "settings", "edit") && form.has("defaultLocale")) {
    const b = await requireBusiness();
    await db.update(schema.business).set(clientLanguage(form, b.defaultLocale)).where(eq(schema.business.id, b.id));
    await audit(me.userId, "language.update");
  }
  revalidatePath("/[locale]", "layout");
  await siteChanged();
  redirect(`/${isAvailable(mine) ? mine : locale}/admin/settings/language?saved=1`);
}

/** Remember this person's admin language, so the admin opens in it on every device. */
export async function setMyLanguage(locale: string, first = false) {
  const me = await requireStaff();
  if (!isAvailable(locale)) throw new Error("Unknown language");
  const lang = locale;
  await db.update(schema.staff).set({ locale: lang }).where(eq(schema.staff.id, me.id));
  redirect(first ? `/${lang}/admin` : `/${lang}/admin/settings/language`);
}

/** Ticks a "Get found online" step as done (with today's date), or unticks it. */
export async function toggleFoundStep(step: string) {
  const me = await requirePermission("settings", "edit");
  if (!(FOUND_STEPS as readonly string[]).includes(step)) return;
  const b = await requireBusiness();
  const list = { ...b.foundChecklist };
  if (list[step]) delete list[step];
  else list[step] = new Date().toISOString().slice(0, 10);
  await db.update(schema.business).set({ foundChecklist: list }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "found.update", step);
  revalidatePath("/[locale]/admin/settings/found", "page");
}

/** Settings › Booking page: the website's look, or clean black and white. */
export async function saveBookingLook(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const b = await requireBusiness();
  await db.update(schema.business).set({ bookingLook: bookingLookOf(String(form.get("bookingLook"))) }).where(eq(schema.business.id, b.id));
  await audit(me.userId, "salon.update", "booking page");
  revalidatePath("/[locale]", "layout");
  redirect(`/${locale}/admin/website/booking-page?saved=1`);
}
