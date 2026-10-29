import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { PageHeader, Tabs } from "@/components/admin/ui";
import { allows } from "@/lib/permissions";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { hhmm } from "@/lib/format";

/** Everyone's regular week at a glance, with the salon's opening hours on top. */
export default async function TeamWeekPage({ params }: PageProps<"/[locale]/admin/settings/week">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { me, denied } = await managerOnly(locale, "team", "view");
  if (denied) return denied;
  const t = await getTranslations("admin.week");
  const tt = await getTranslations("admin.team");
  const [people, opening] = await Promise.all([
    db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder), with: { hours: true } }),
    db.query.businessHours.findMany(),
  ]);
  const day = (wd: number) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + wd)));
  const ranges = (rows: { weekday: number; startMin: number; endMin: number }[], wd: number) =>
    rows
      .filter((r) => r.weekday === wd)
      .sort((a, b) => a.startMin - b.startMin)
      .map((r) => `${hhmm(r.startMin)}–${hhmm(r.endMin)}`);
  const cell = (list: string[]) => (list.length ? list.map((x) => <span key={x} className="block whitespace-nowrap">{x}</span>) : <span className="text-muted">—</span>);

  return (
    <div>
      <PageHeader title={allows(me!, "team", "edit") ? tt("title") : t("title")} back={`/${locale}/admin/settings`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-3 p-4 md:px-8">
        {allows(me!, "team", "edit") && (
          <Tabs tabs={[{ href: `/${locale}/admin/staff`, label: tt("people"), on: false }, { href: `/${locale}/admin/settings/week`, label: tt("shifts"), on: true }]} />
        )}
        <p className="text-sm text-muted">{t("hint")}</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="sticky left-0 bg-white px-3 py-2.5" />
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                  <th key={wd} className="px-3 py-2.5 font-semibold capitalize">{day(wd)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr className="bg-canvas">
                <th className="sticky left-0 bg-canvas px-3 py-3 text-left font-semibold whitespace-nowrap">{t("salon")}</th>
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                  <td key={wd} className="px-3 py-3 align-top">{opening.length ? cell(ranges(opening, wd)) : <span className="text-muted">·</span>}</td>
                ))}
              </tr>
              {people.map((p) => (
                <tr key={p.id}>
                  <th className="sticky left-0 bg-white px-3 py-3 text-left font-medium whitespace-nowrap">
                    <Link href={`/${locale}/admin/staff/${p.id}`} className="flex items-center gap-2">
                      <Avatar name={p.name} photo={p.photo} color={p.color} size={28} />
                      {p.name}
                    </Link>
                  </th>
                  {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
                    <td key={wd} className="px-3 py-3 align-top">{cell(ranges(p.hours, wd))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {opening.length === 0 && (
          <Link href={`/${locale}/admin/settings/hours`} className="text-sm font-medium text-brand">
            {t("setOpening")} →
          </Link>
        )}
      </div>
    </div>
  );
}
