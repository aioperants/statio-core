import { getTranslations, setRequestLocale } from "next-intl/server";
import { canUse, NAV } from "@/components/admin/nav";
import { PageHeader } from "@/components/admin/ui";
import { pageMember } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { Logo } from "@/components/brand";
import { allows, type Area, type Level } from "@/lib/permissions";
import { NavIcon, Phone } from "@/components/icons";
import { Label, Row } from "./rows";

export default async function MorePage({ params }: PageProps<"/[locale]/admin/more">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.nav");
  const me = await pageMember(locale);
  const can = (a: Area, l: Exclude<Level, "none">) => allows(me, a, l);
  const items = NAV.more.filter((i) => canUse(i.need, can));
  const tools = items.filter((i) => i.key !== "settings");
  const business = await requireBusiness();
  const admin = `/${locale}/admin`;
  // The phone's copy of the side menu: the same sections, names and order (salon, Tools, Settings and Help, account).
  return (
    <div>
      <PageHeader title={t("more")} />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <ul className="card">
          <li>
            <a href={`/${locale}/book`} target="_blank" className="flex items-center gap-3 p-4">
              <Logo name={business.name} logo={business.logo} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{business.name}</span>
                <span className="block text-sm text-muted">{t("bookingPage")}</span>
              </span>
              <NavIcon name="bookingPage" className="size-5 text-muted" />
            </a>
          </li>
        </ul>
        {tools.length > 0 && (
          <>
            <Label>{t("grow")}</Label>
            <ul className="card divide-y divide-line">
              {tools.map((i) => (
                <Row key={i.key} href={admin + i.href} icon={i.key} label={t.has(i.key) ? t(i.key as "today") : i.key} />
              ))}
            </ul>
          </>
        )}
        <ul className="card divide-y divide-line">
          {items.some((i) => i.key === "settings") && <Row href={`${admin}/settings`} icon="settings" label={t("settings")} />}
          <Row href={`${admin}/help`} icon="help" label={t("help")} />
        </ul>
        {/* Hosted Statio: the way up, for owners (Core's promise works both ways). */}
        {allows(me, "settings", "edit") && (
          <ul className="card">
            <Row href={`${admin}/move`} icon="moveToStatio" label={t("moveToStatio")} hint={t("moveToStatioHint")} />
          </ul>
        )}
        {/* The account menu (on a computer: click your name): one row, the five rarely used pages one level down. */}
        <ul className="card">
          <Row href={`${admin}/more/account`} icon="account" label={t("myAccount")} hint={t("myAccountHint")} />
        </ul>
        <div className="card p-4">
          <p className="font-medium"><Phone className="inline size-4 align-[-3px]" /> {t("install")}</p>
          <p className="mt-1 text-sm text-muted">{t("installHint")}</p>
        </div>
      </div>
    </div>
  );
}
