import "server-only";
import { createTranslator } from "next-intl";
import type en from "../../messages/en.json";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isAvailable, messagesFor } from "@/i18n/messages";
import { appointmentDetails, getBusiness, type AppointmentDetails } from "./booking";
import { sendEmail } from "./email";
import { type CalendarVisit, visitIcs } from "./ics";
import { dayLabel, hhmm, money, serviceName } from "./format";
import { utcToLocal } from "./time";
import { salonUrl } from "./salon-url";
import { welcomeDefaults } from "./welcome-texts";
import { greeted, plainText, welcomeBody } from "./owner-text";
import { pushToStaff, pushWords, visitWatchers } from "./push";

/** The app's words in a language, typed like the English file (missing strings fall back to English). */
const messages = (locale: string) => messagesFor(locale) as typeof en;
type Lang = string;

/** The owner's emails go to OWNER_EMAIL when the owner has no email of their own yet. */
const ownerEmailFallback = () => process.env.OWNER_EMAIL;

/** A language the app speaks: `value`, else `fallback`, else English. */
function lang(value: string | null | undefined, fallback: string): Lang {
  return isAvailable(value) ? value! : isAvailable(fallback) ? fallback : "en";
}

/** Clients hear from the salon in its one client language. */
const clientLang = (business: { defaultLocale: string }) => lang(business.defaultLocale, "es");

/** The owner reads salon emails in their own interface language. */
async function ownerLang(business: { defaultLocale: string }) {
  const owner = await db.query.staff.findFirst({ where: eq(schema.staff.role, "owner"), columns: { locale: true } });
  return lang(owner?.locale, business.defaultLocale);
}

/** Shared words for an email about one visit, in `locale`. */
function describe(a: AppointmentDetails, base: string, tz: string, currency: string, locale: Lang, fallback?: string) {
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  const local = utcToLocal(a.startsAt, tz);
  const vars = {
    salon: "",
    name: a.bookedForName || a.client.name,
    services: a.lines.map((l) => serviceName(l.service, locale, fallback)).join(" + "),
    day: dayLabel(local.day, locale),
    time: hhmm(local.minutes),
    staff: a.staff.name,
    price: money(a.priceCents, currency, locale),
    link: `${base}/${locale}/manage/${a.manageToken}`,
    admin: `${base}/${locale}/admin`,
  };
  return { t, vars };
}

type ClientTemplate =
  | "confirmed"
  | "requested"
  | "approved"
  | "declined"
  | "cancelled_by_salon"
  | "cancelled_by_client"
  | "moved"
  | "rescheduled";

/** Emails that carry the visit as a calendar invite, so the client's calendar adds, moves or removes it. */
const INVITE: Partial<Record<ClientTemplate, "REQUEST" | "CANCEL">> = {
  confirmed: "REQUEST",
  approved: "REQUEST",
  moved: "REQUEST",
  rescheduled: "REQUEST",
  cancelled_by_salon: "CANCEL",
  cancelled_by_client: "CANCEL",
};

/** The visit as a calendar event, in the client's language. */
export function calendarVisit(
  a: AppointmentDetails,
  business: { name: string; address: string | null; email: string | null; currency: string; timezone: string; defaultLocale: string },
  locale: string,
): CalendarVisit {
  const l = lang(business.defaultLocale, locale);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, l, business.defaultLocale);
  return {
    uid: `${a.id}@statio`,
    start: a.startsAt,
    end: a.endsAt,
    title: `${vars.services} · ${business.name}`,
    location: business.address,
    description: `${vars.staff} · ${vars.price}\n${t("manage", vars)}`,
    url: vars.link,
    organizer: business.email ? { name: business.name, email: business.email } : null,
    attendee: a.client.email,
    // Seconds since 2020: always bigger than the last one sent.
    sequence: Math.floor((Date.now() - Date.UTC(2020, 0, 1)) / 1000),
  };
}

/** Email the client about their visit, in their language. */
export async function emailClient(appointmentId: string, template: ClientTemplate) {
  const business = await getBusiness();
  const a = await appointmentDetails({ id: appointmentId });
  if (!business || !a?.client.email) return;
  const locale = clientLang(business);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, locale, business.defaultLocale);
  vars.salon = business.name;
  const body = [
    t(`${template}.body`, vars),
    "",
    t("details", vars),
    template === "declined" || template.startsWith("cancelled") ? "" : `\n${t("manage", vars)}`,
    INVITE[template] === "REQUEST" ? t("calendarLink", { link: `${salonUrl()}/api/calendar/${a.manageToken}?lang=${locale}` }) : "",
    "",
    [business.name, business.address, business.phone].filter(Boolean).join(" · "),
  ].join("\n");
  const method = INVITE[template];
  const attachments = method && [
    { filename: "invite.ics", content: visitIcs(calendarVisit(a, business, locale), method), contentType: `text/calendar; charset=utf-8; method=${method}` },
  ];
  await sendEmail({ to: a.client.email, subject: t(`${template}.subject`, vars), text: body, template, appointmentId, clientId: a.client.id, attachments: attachments || undefined });
}

type OwnerTemplate = "owner_new" | "owner_request" | "owner_cancelled" | "owner_moved";

/** Alert the salon (owner email) about a booking event. */
export async function emailOwner(appointmentId: string, template: OwnerTemplate) {
  const business = await getBusiness();
  const to = business?.email || ownerEmailFallback();
  const a = await appointmentDetails({ id: appointmentId });
  if (!business || !to || !a) return;
  const locale = await ownerLang(business);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, locale, business.defaultLocale);
  vars.salon = business.name;
  const text = [t(`${template}.body`, vars), "", t("details", vars), `${a.client.email ?? ""} ${a.client.phone ?? ""}`.trim(), "", vars.admin].filter((l, i, all) => l !== "" || all[i - 1] !== "").join(
    "\n",
  );
  await Promise.all([sendEmail({ to, subject: t(`${template}.subject`, vars), text, template, appointmentId }), pushOwner(a, template)]);
}

/** The same alert on the team's phones: requests to whoever approves them, the rest also to the person doing the visit. */
async function pushOwner(a: AppointmentDetails, template: OwnerTemplate) {
  const business = await getBusiness();
  if (!business) return;
  const ids = await visitWatchers(template === "owner_request" ? null : a.staff.id);
  await pushToStaff(ids, (locale) => {
    const { vars } = describe(a, "", business.timezone, business.currency, locale, business.defaultLocale);
    return {
      title: pushWords(locale)(template),
      body: `${vars.name} · ${vars.services} · ${vars.day} ${vars.time}`,
      url: template === "owner_request" ? `/${locale}/admin/requests` : `/${locale}/admin/visit/${a.id}`,
      tag: `visit-${a.id}`,
    };
  });
}

/** After a new booking: confirm (or acknowledge the request) to the client and alert the owner. */
export async function notifyNewBooking(appointmentId: string, status: "pending" | "confirmed", fromAdmin: boolean) {
  await Promise.all([
    emailClient(appointmentId, status === "pending" ? "requested" : "confirmed"),
    fromAdmin ? Promise.resolve() : emailOwner(appointmentId, status === "pending" ? "owner_request" : "owner_new"),
  ]);
}

/** Phone number with country code, digits only, or null if it can't be a phone. */
export function intlNumber(phone: string | null | undefined) {
  // Numbers are stored with their country code (+34611222333); older ones may not be.
  if (phone?.startsWith("+")) return phone.replace(/\D/g, "");
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 8) return null;
  // Spanish mobiles saved without the country code (from before numbers were stored in full).
  return digits.length === 9 && /^[6789]/.test(digits) ? `34${digits}` : digits;
}

/** Opens WhatsApp on the owner's phone with the message written; they press send. */
export function waLink(phone: string | null | undefined, text: string) {
  const full = intlNumber(phone);
  return full && `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

/** Opens the phone's own Messages app with the text written (works on iPhone and Android). */
export function smsLink(phone: string | null | undefined, text: string) {
  const full = intlNumber(phone);
  return full && `sms:+${full}?&body=${encodeURIComponent(text)}`;
}

export async function whatsappReminderText(a: AppointmentDetails) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, locale, business.defaultLocale);
  vars.salon = business.name;
  vars.name = vars.name.split(" ")[0];
  return t("whatsappReminder", vars);
}

/** Welcome for a new client: the salon's own text if set ({name} and {salon} are filled in), else the built-in one. */
export async function whatsappWelcomeText(a: AppointmentDetails) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, locale, business.defaultLocale);
  vars.salon = business.name;
  vars.name = vars.name.split(" ")[0];
  // Greeting, the salon's words (plain; older texts with {name}/{salon} still work) or ours, the visit, the salon's name.
  const ours = welcomeDefaults(locale);
  const own = plainText(business.welcomeTexts[locale]?.trim() ?? "", vars);
  return welcomeBody(greeted(ours.greeting, vars.name, own || ours.message), t("whatsappWelcomeVisit", vars), business.name);
}

/** A birthday greeting the owner sends from their phone, in the salon's client language. */
export async function whatsappBirthdayText(row: { name: string }) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  return t("whatsappBirthday", { name: row.name.split(" ")[0], salon: business.name, link: `${salonUrl()}/${locale}/book` });
}

/** The "time to book again" message; `soon` = not due yet ("it's nearly time"). */
export async function whatsappComeBackText(row: { name: string; locale: string | null }, soon = false) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  return t(soon ? "whatsappComeBackSoon" : "whatsappComeBack", { name: row.name.split(" ")[0], salon: business.name, link: `${salonUrl()}/${locale}/book` });
}

/** "Fill free time": a free time offered to one client who fits it (sent from the owner's phone). */
export async function fillGapText(row: { name: string }, day: string, startMin: number, staff: string) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  const when = `${dayLabel(day, locale)}, ${hhmm(startMin)}`;
  return t("whatsappFillGap", { name: row.name.split(" ")[0], salon: business.name, when, staff: staff.split(" ")[0], link: `${salonUrl()}/${locale}/book` });
}

/** Tells the owner a person can't come and how many visits need sorting out. */
export async function emailOwnerStaffOff(o: { staffName: string; from: string; to: string; visits: number }) {
  const business = await getBusiness();
  const to = business?.email || ownerEmailFallback();
  if (!business || !to) return;
  const locale = await ownerLang(business);
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  const vars = {
    staff: o.staffName,
    days: o.from === o.to ? dayLabel(o.from, locale) : `${dayLabel(o.from, locale)} – ${dayLabel(o.to, locale)}`,
    count: o.visits,
    link: `${salonUrl()}/${locale}/admin/affected`,
  };
  await sendEmail({ to, subject: t("staffOff.subject", vars), text: t("staffOff.body", vars), template: "staff_off" });
}

/** WhatsApp/SMS text when the booked person can't come: sorry, and a link to pick another time. */
export async function staffOffText(a: AppointmentDetails) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const { t, vars } = describe(a, salonUrl(), business.timezone, business.currency, locale, business.defaultLocale);
  vars.salon = business.name;
  vars.name = vars.name.split(" ")[0];
  return t("whatsappStaffOff", vars);
}

/** A professional's own booking link, to share with their clients (in the clients' language). */
export async function staffLinkText(name: string, link: string) {
  const business = await getBusiness();
  if (!business) return "";
  const locale = clientLang(business);
  const t = createTranslator({ locale, messages: messages(locale), namespace: "emails" });
  return t("staffLink", { name, salon: business.name, link });
}
