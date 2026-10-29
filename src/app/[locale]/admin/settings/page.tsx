import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { canUse, SETTINGS } from "@/components/admin/nav";
import { PageHeader } from "@/components/admin/ui";
import { NavIcon } from "@/components/icons";
import { db, schema } from "@/db";
import { pageMember } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { allows } from "@/lib/permissions";

const STATIO_URL = "https://statiocrm.com";
// Custom web design is done by aioperants.com, the team behind Statio.
const DESIGN_EMAIL = "hello@aioperants.com";

/**
 * Setting up the business: six doors the way an owner thinks about it (Business, Team, Services,
 * Bookings, Website, Get found), each one page holding its group, and a "Getting started" list for new businesses.
 */
export default async function SettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await pageMember(locale);
  // Only for people who can set something up here (the owner, managers, or someone given an area).
  if (!canUse("setup", (a, l) => allows(me, a, l))) notFound();
  const t = await getTranslations("admin.settings");
  const business = await requireBusiness();

  // Getting started: the first things a new owner fills in, ticked as soon as they're there.
  const [hours, services, people] = await Promise.all([
    db.$count(schema.businessHours),
    db.$count(schema.service, and(eq(schema.service.active, true), gt(schema.service.priceCents, 0))),
    db.query.staff.findMany({ where: eq(schema.staff.active, true), with: { hours: { columns: { id: true } } }, columns: { id: true } }),
  ]);
  const steps = [
    { key: "business", href: "/salon", done: !!(business.phone || business.address) },
    { key: "hours", href: "/settings/hours", done: hours > 0 },
    { key: "services", href: "/services", done: services > 0 },
    { key: "staff", href: "/staff", done: people.some((p) => p.hours.length > 0) },
  ];
  const left = steps.filter((x) => !x.done).length;
  const may = (need: Parameters<typeof canUse>[0]) => canUse(need, (a, l) => allows(me, a, l));
  // A door opens its group's page, or the one page in it this person may use (a stylist who may only see shifts).
  const doors = SETTINGS.flatMap((g) => {
    const open: readonly { href: string; need: Parameters<typeof canUse>[0] }[] = g.items.filter((i) => may(i.need));
    if (!open.length) return [];
    return [{ key: g.key, href: open.some((i) => i.href === g.href) ? g.href : open[0].href }];
  });
  const door = (d: { key: string; href: string }) => (
    <li key={d.key}>
      <Link href={`/${locale}/admin${d.href}`} className="flex items-center gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink"><NavIcon name={d.key} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t(`doors.${d.key as "business"}.name`)}</span>
          <span className="block text-sm text-muted">{t(`doors.${d.key as "business"}.hint`)}</span>
        </span>
        <span className="text-muted">›</span>
      </Link>
    </li>
  );
  const half = Math.ceil(doors.length / 2);
  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#start`} title={t("title")} back={`/${locale}/admin/more`} wide />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 items-start gap-4 p-4 md:px-8 lg:grid-cols-2 lg:gap-6">
        {/* New salons see the same steps in the side menu ("Getting started"). */}
        {left > 0 && !business.setupDone && (
          <section className="card grid gap-2 border-brand/30 p-4 lg:col-span-2">
            <div>
              <h2 className="font-semibold">{t("start.title")}</h2>
              <p className="text-sm text-muted">{t("start.hint", { left })}</p>
            </div>
            <ol className="grid gap-1">
              {steps.map((x, i) => (
                <li key={x.key}>
                  <Link href={`/${locale}/admin${x.href}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${x.done ? "bg-emerald-100 text-emerald-800" : "border border-line text-muted"}`}
                    >
                      {x.done ? "✓" : i + 1}
                    </span>
                    <span className={`flex-1 ${x.done ? "text-muted line-through" : "font-medium"}`}>{t(`start.${x.key as "business"}`)}</span>
                    {!x.done && <span className="text-muted">›</span>}
                  </Link>
                </li>
              ))}
              <li>
                <a href={`/${locale}/book`} target="_blank" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-canvas">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold text-muted">5</span>
                  <span className="flex-1 font-medium">{t("start.link")}</span>
                  <span className="text-muted">↗</span>
                </a>
              </li>
            </ol>
          </section>
        )}
        {/* Two columns of three on a computer, one list on a phone. */}
        <p className="-mb-1 px-1 text-sm text-muted lg:col-span-2">{t("intro")}</p>
        {[doors.slice(0, half), doors.slice(half)].filter((c) => c.length > 0).map((c, i) => (
          <ul key={i} className="card divide-y divide-line">
            {c.map(door)}
          </ul>
        ))}
        {/* Two ways to get more from the Statio team: a custom website, or hosted Statio. */}
        {may(["settings", "edit"]) && (
          <section className="grid gap-3 lg:col-span-2">
            <h2 className="px-1 text-sm font-semibold tracking-wide text-muted uppercase">{t("extra.title")}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              <a href={`mailto:${DESIGN_EMAIL}?subject=${encodeURIComponent(t("extra.designSubject", { salon: business.name }))}`} className="card flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink"><NavIcon name="website" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("extra.design")}</span>
                  <span className="block text-sm text-muted">{t("extra.designHint")}</span>
                </span>
                <span className="text-muted">›</span>
              </a>
              <a href={`${STATIO_URL}/#price`} target="_blank" rel="noopener" className="card flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-white"><NavIcon name="feature" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t("extra.pro")}</span>
                  <span className="block text-sm text-muted">{t("extra.proHint")}</span>
                </span>
                <span className="text-muted">↗</span>
              </a>
            </div>
            <p className="px-1 text-xs text-muted">{t("extra.note")}</p>
          </section>
        )}
      </div>
    </div>
  );
}
