import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { appointmentDetails, getBusiness, staffIsOff } from "@/lib/booking";
import { dayLabel, hhmm, money, serviceName } from "@/lib/format";
import { utcToLocal } from "@/lib/time";
import { AddToCalendar } from "@/components/add-to-calendar";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: PageProps<"/[locale]/manage/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("manage");
  const ts = await getTranslations("status");
  const [business, appt] = await Promise.all([getBusiness(), appointmentDetails({ token })]);
  if (!business || !appt) return <p className="p-8 text-center text-muted">{t("notFound")}</p>;
  // Clients see the salon in its one client language, whatever link brought them here.
  if (locale !== business.defaultLocale) redirect(`/${business.defaultLocale}/manage/${token}`);

  const local = utcToLocal(appt.startsAt, business.timezone);
  const active = appt.status === "pending" || appt.status === "confirmed";
  // When the salon's person can't come, the client may change or cancel at any time.
  const off = active && (await staffIsOff(appt));
  const canCancel = active && (off || +appt.startsAt - Date.now() >= business.cancellationHours * 3600_000);

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <BrandHeader name={business.name} logo={business.logo} address={business.address} />
      <div className="card p-5">
        <p className="text-sm font-medium text-muted">{t("title")}</p>
        <p className="mt-1 text-lg font-semibold">{appt.lines.map((l) => serviceName(l.service, locale, business.defaultLocale)).join(" + ")}</p>
        <p className="mt-1">
          {dayLabel(local.day, locale)} · {hhmm(local.minutes)}
        </p>
        <p className="text-sm text-muted">
          {appt.staff.name} · {money(appt.priceCents, business.currency, locale)}
        </p>
        <span className={`chip mt-3 ${active ? "bg-brand-soft text-brand" : "bg-gray-100 text-gray-600"}`}>{ts(appt.status)}</span>
      </div>
      {off && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">{t("staffOff", { name: appt.staff.name })}</p>}
      <div className="mt-4 grid gap-2">
        {canCancel && (
          <a className="btn-primary" href={`/${locale}/manage/${token}/move`}>
            {t("change")}
          </a>
        )}
        {canCancel && <CancelButton token={token} />}
        {active && !canCancel && <p className="text-center text-sm text-muted">{t("tooLate", { hours: business.cancellationHours, salon: business.name })}</p>}
        {appt.status === "confirmed" && <AddToCalendar token={token} locale={locale} primary={false} />}
        {business.phone && (
          <a className="btn-ghost" href={`tel:${business.phone}`}>
            {t("call", { salon: business.name })}
          </a>
        )}
        <a className="btn-ghost" href={`/${locale}/book`}>
          {t("bookAgain")}
        </a>
      </div>
    </main>
  );
}
