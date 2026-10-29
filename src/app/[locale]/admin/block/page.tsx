import { and, asc, eq, gt, or, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember, managesAllVisits } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm } from "@/lib/format";
import { isValidDay, todayIn, utcToLocal } from "@/lib/time";
import { BlockForm, RemoveBlock } from "./block-form";

export default async function BlockPage({ params, searchParams }: PageProps<"/[locale]/admin/block">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.block");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const people = await db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder) });
  const blocks = await db.query.timeOff.findMany({
    where: and(gt(schema.timeOff.endsAt, new Date()), managesAllVisits(me) ? undefined : or(eq(schema.timeOff.staffId, me.id), isNull(schema.timeOff.staffId))),
    orderBy: asc(schema.timeOff.startsAt),
    limit: 50,
  });
  const fmt = (d: Date) => {
    const l = utcToLocal(d, business.timezone);
    return { day: l.day, label: `${dayLabel(l.day, locale, "short")} ${hhmm(l.minutes)}` };
  };

  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin`} />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-6 p-4 md:px-8">
        <BlockForm
          today={typeof sp.day === "string" && isValidDay(sp.day) ? sp.day : todayIn(business.timezone)}
          meId={me.id}
          canSalon={managesAllVisits(me)}
          people={(managesAllVisits(me) ? people : people.filter((p) => p.id === me.id)).map((p) => ({ id: p.id, name: p.name }))}
        />
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t("upcoming")}</h2>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted">{t("none")}</p>
          ) : (
            <ul className="card divide-y divide-line">
              {blocks.map((b) => {
                const s = fmt(b.startsAt);
                const e = fmt(b.endsAt);
                return (
                  <li key={b.id} className="flex items-center gap-3 p-3.5">
                    <span className="flex-1">
                      <span className="block font-medium">{b.staffId ? people.find((p) => p.id === b.staffId)?.name : t("salon")}</span>
                      <span className="block text-sm text-muted">
                        {s.label} → {e.label}
                        {b.reason && ` · ${b.reason}`}
                        {b.onlineOnly && " · online"}
                      </span>
                    </span>
                    {(managesAllVisits(me) || b.staffId === me.id) && <RemoveBlock id={b.id} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
