import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { and, desc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { STATUS_STYLE } from "@/components/admin/visit-row";
import { pageMember, seesAllVisits } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { saveGuestAsClient } from "../../_actions/visits";
import { appointmentDetails, requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm, money, serviceName } from "@/lib/format";
import { smsLink, waLink, whatsappReminderText } from "@/lib/notify";
import { todayIn, utcToLocal } from "@/lib/time";
import { PhoneInput } from "@/components/phone-input";
import { Checkout } from "./checkout";
import { ColourCard } from "./colour-card";
import { VisitActions } from "./visit-actions";

export default async function VisitPage({ params }: PageProps<"/[locale]/admin/visit/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.visit");
  const ts = await getTranslations("status");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const v = /^[0-9a-f-]{36}$/.test(id) ? await appointmentDetails({ id }) : null;
  if (!v || (!seesAllVisits(me) && v.staffId !== me.id)) notFound();
  const local = utcToLocal(v.startsAt, business.timezone);
  const end = utcToLocal(v.endsAt, business.timezone);
  const phone = v.client.phone?.replace(/[^\d+]/g, "");
  const upcoming = (v.status === "confirmed" || v.status === "pending") && v.startsAt > new Date();
  const reminder = upcoming ? await whatsappReminderText(v) : "";
  const whatsapp = waLink(v.client.phone, reminder);
  const sms = upcoming ? smsLink(v.client.phone, reminder) : null;
  // Payment and "done" once the visit has started, not before.
  const canCheckout = ["confirmed", "completed", "no_show"].includes(v.status) && v.startsAt <= new Date();
  const serviceDays = Math.max(0, ...v.lines.map((l) => l.service.rebookDays ?? 0));
  const ordered = [...v.lines].sort((a, b) => +a.startsAt - +b.startsAt);
  const guest = v.client.guest;
  // Colour card and patch-test consent, for services that ask for them.
  const card = v.lines.some((l) => l.service.colourCard);
  const consentNeeded = v.lines.some((l) => l.service.needsConsent);
  // Guests share one record, so they have no history to repeat.
  const previous = card && !guest
    ? (
        await db.query.appointment.findMany({
          where: and(eq(schema.appointment.clientId, v.clientId), ne(schema.appointment.id, v.id), isNotNull(schema.appointment.formula), lt(schema.appointment.startsAt, v.startsAt)),
          orderBy: desc(schema.appointment.startsAt),
          limit: 3,
        })
      ).map((a) => ({ day: dayLabel(utcToLocal(a.startsAt, business.timezone).day, locale, "short"), formula: a.formula! }))
    : [];
  const tw = await getTranslations("admin.walkin");

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#colour`} title={v.bookedForName || v.client.name} back={`/${locale}/admin/calendar?day=${local.day}`} />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <div className="card p-5">
          <span className={`chip ${STATUS_STYLE[v.status]}`}>{ts(v.status)}</span>
          <p className="mt-3 text-lg font-semibold">{v.lines.map((l) => serviceName(l.service, locale)).join(" + ")}</p>
          <p className="mt-1">
            {dayLabel(local.day, locale)} · {hhmm(local.minutes)}–{hhmm(end.minutes)}
          </p>
          <p className="text-sm text-muted">
            {v.staff.name} · {money(v.priceCents, business.currency, locale)}
            {v.source === "web" && ` · ${t("bookedOnline")}`}
          </p>
          {v.bookedForName && !guest && <p className="mt-2 text-sm">{t("for", { name: v.bookedForName })}</p>}
        </div>

        {guest ? (
          // Walk-in guest: the visit counts, but there's no client record until someone saves one.
          <div className="card grid gap-3 p-4">
            <div>
              <span className="block text-xs text-muted">{t("client")}</span>
              <span className="block font-medium">{tw("guestLabel")}</span>
              <span className="block text-sm text-muted">{tw("guestHint")}</span>
            </div>
            {allows(me, "clients", "edit") && (
              <details className="rounded-xl bg-canvas p-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">+ {tw("saveAsClient")}</summary>
                <form action={saveGuestAsClient.bind(null, locale, v.id)} className="mt-3 grid gap-2">
                  <p className="text-sm text-muted">{tw("saveHint")}</p>
                  <input name="name" required maxLength={120} defaultValue={v.bookedForName ?? ""} placeholder={tw("name")} className="field" />
                  <PhoneInput name="phone" country={business.country} locale={locale} placeholder={tw("phone")} />
                  <input name="email" type="email" maxLength={200} placeholder={tw("email")} className="field" />
                  <button className="btn-primary">{tw("saveAsClient")}</button>
                </form>
              </details>
            )}
          </div>
        ) : (
        <Link href={`/${locale}/admin/clients/${v.client.id}`} className="card flex items-center gap-3 p-4">
          <span className="flex-1">
            <span className="block text-xs text-muted">{t("client")}</span>
            <span className="block font-medium">{v.client.name}</span>
            <span className="block text-sm text-muted">{[formatPhone(v.client.phone), v.client.email].filter(Boolean).join(" · ")}</span>
            {v.client.noShowCount > 0 && <span className="text-sm text-red-700">{t("noShows", { count: v.client.noShowCount })}</span>}
            {v.client.notes && <span className="mt-1 block text-sm whitespace-pre-line">{v.client.notes}</span>}
          </span>
          <span className="text-muted">›</span>
        </Link>
        )}

        <div className="grid grid-cols-3 gap-2">
          {phone && (
            <a className="btn-ghost" href={`tel:${phone}`}>
              {t("call")}
            </a>
          )}
          {whatsapp && (
            <a className="btn-ghost" href={whatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
          {v.client.email && (
            <a className="btn-ghost" href={`mailto:${v.client.email}`}>
              {t("email")}
            </a>
          )}
        </div>

        {upcoming && whatsapp && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <a className="btn-ghost border-emerald-200 bg-emerald-50 text-emerald-800" href={whatsapp} target="_blank" rel="noreferrer">
              {t("whatsappReminder")}
            </a>
            {sms && (
              <a className="btn-ghost" href={sms}>
                SMS
              </a>
            )}
          </div>
        )}

        {(card || consentNeeded) && (
          <ColourCard
            id={v.id}
            card={card}
            formula={v.formula ?? ""}
            previous={previous}
            consent={{ needed: consentNeeded, at: v.consentAt ? dayLabel(utcToLocal(v.consentAt, business.timezone).day, locale, "short") : null }}
          />
        )}

        {canCheckout && (
          <Checkout
            id={v.id}
            locale={locale}
            currency={business.currency}
            priceCents={v.priceCents}
            paid={v.paidCents != null ? { cents: v.paidCents, method: v.paymentMethod ?? "cash" } : null}
            rebookDays={guest ? null : v.rebookDays ?? (serviceDays || null)}
            guest={guest}
            rebookBase={`/${locale}/admin/new?client=${v.clientId}&staff=${v.staffId}&services=${ordered.map((l) => l.serviceId).join(",")}`}
            today={todayIn(business.timezone)}
          />
        )}


        <VisitActions id={v.id} status={v.status} notes={v.notes ?? ""} locale={locale} past={v.startsAt < new Date()} checkout={canCheckout} paid={v.paidCents != null} />
      </div>
    </div>
  );
}
