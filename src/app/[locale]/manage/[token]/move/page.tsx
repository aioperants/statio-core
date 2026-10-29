import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { appointmentDetails, getBusiness } from "@/lib/booking";
import { dayLabel, hhmm, serviceName } from "@/lib/format";
import { todayIn, utcToLocal } from "@/lib/time";
import { ClientMoveForm } from "./client-move-form";

export const dynamic = "force-dynamic";

export default async function ClientMovePage({ params }: PageProps<"/[locale]/manage/[token]/move">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("manage");
  const [business, appt] = await Promise.all([getBusiness(), appointmentDetails({ token })]);
  if (!business || !appt) return <p className="p-8 text-center text-muted">{t("notFound")}</p>;
  if (locale !== business.defaultLocale) redirect(`/${business.defaultLocale}/manage/${token}/move`);
  const local = utcToLocal(appt.startsAt, business.timezone);
  const today = todayIn(business.timezone);
  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <BrandHeader name={business.name} logo={business.logo} address={business.address} />
      <div className="card mb-4 p-4">
        <p className="font-semibold">{appt.lines.map((l) => serviceName(l.service, locale, business.defaultLocale)).join(" + ")}</p>
        <p className="text-sm text-muted line-through">
          {dayLabel(local.day, locale)} · {hhmm(local.minutes)}
        </p>
      </div>
      <h1 className="mb-3 text-lg font-semibold">{t("changeTitle")}</h1>
      <ClientMoveForm
        token={token}
        locale={locale}
        day={local.day < today ? today : local.day}
        today={today}
        staffId={appt.staffId}
        staffName={appt.staff.name}
        serviceIds={appt.lines.map((l) => l.serviceId)}
      />
    </main>
  );
}
