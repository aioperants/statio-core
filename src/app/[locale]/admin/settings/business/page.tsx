import Link from "next/link";
import { and, asc, gt, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { languageName } from "@/i18n/languages";
import { Logo } from "@/components/brand";
import { Facts, SummaryCard } from "@/components/admin/summary-card";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { dayLabel } from "@/lib/format";
import { hoursLines } from "@/lib/found-online";
import { formatPhone } from "@/lib/phone";
import { utcToLocal } from "@/lib/time";

/**
 * Settings › Business: what clients see on the website, the booking page and in emails, as it is now.
 * Each card opens its own page to change it (details, opening hours, closed days).
 */
export default async function BusinessPage({ params }: PageProps<"/[locale]/admin/settings/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.business");
  const ts = await getTranslations("admin.salon");
  const tt = await getTranslations("templates");
  const tc = await getTranslations("common");
  const b = await requireBusiness();
  const [opening, closures] = await Promise.all([
    db.query.businessHours.findMany(),
    db.query.timeOff.findMany({ where: and(isNull(schema.timeOff.staffId), gt(schema.timeOff.endsAt, new Date())), orderBy: asc(schema.timeOff.startsAt), limit: 3 }),
  ]);
  const base = `/${locale}/admin`;
  const lines = hoursLines(opening, locale);
  const closed = closures.map((c) => {
    const from = utcToLocal(c.startsAt, b.timezone).day;
    const to = utcToLocal(new Date(+c.endsAt - 1), b.timezone).day;
    return { id: c.id, when: from === to ? dayLabel(from, locale, "short") : `${dayLabel(from, locale, "short")} – ${dayLabel(to, locale, "short")}`, note: c.reason };
  });
  return (
    <div>
      <PageHeader help={`${base}/help#hours`} title={t("title")} back={`${base}/settings`} hint={t("intro")} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-4 p-4 md:px-8 lg:grid-cols-2">
        <div className="grid gap-4">
          <SummaryCard title={t("details")} action={tc("edit")} href={`${base}/salon`}>
            <div className="flex items-center gap-3">
              <Logo name={b.name} logo={b.logo} size={56} />
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">{b.name}</span>
                <span className="block truncate text-sm text-muted">{b.businessTypes.map((x) => tt(`types.${x as "hair"}`)).join(", ")}</span>
              </span>
            </div>
            <Facts
              rows={[
                [ts("phone"), formatPhone(b.phone) || <span className="text-muted">{t("notSet")}</span>],
                [t("email"), b.email || <span className="text-muted">{t("notSet")}</span>],
                [ts("address"), b.address || <span className="text-muted">{t("notSet")}</span>],
              ]}
            />
          </SummaryCard>
          <SummaryCard title={t("closed")} action={`+ ${t("add")}`} href={`${base}/settings/hours#holidays`}>
            {closed.length ? <Facts rows={closed.map((c) => [c.when, c.note || t("closedDay")])} /> : <p className="text-sm text-muted">{t("noClosed")}</p>}
            <p className="text-sm text-muted">{t("holidaysHint")}</p>
          </SummaryCard>
        </div>
        <div className="grid gap-4">
          <SummaryCard title={t("hours")} action={tc("edit")} href={`${base}/settings/hours`}>
            {lines.length ? <Facts rows={lines.map((l) => [l.days, l.hours])} /> : <p className="text-sm text-muted">{t("noHours")}</p>}
          </SummaryCard>
          <SummaryCard title={t("clientLanguage")} action={tc("edit")} href={`${base}/settings/language`}>
            <p className="text-sm">{languageName(b.defaultLocale)}</p>
            <p className="text-sm text-muted">{t("clientLanguageHint")}</p>
          </SummaryCard>
          <Link href={`${base}/salon#more`} className="card flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t("more")}</span>
              <span className="block text-sm text-muted">{t("moreHint")}</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
