import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember, managesAllVisits } from "@/lib/access";
import { requireBusiness, staffIsOff, visitsWithAbsentStaff } from "@/lib/booking";
import { dayLabel, hhmm, serviceName } from "@/lib/format";
import { smsLink, staffOffText, waLink } from "@/lib/notify";
import { utcToLocal } from "@/lib/time";
import { AffectedVisit } from "./affected-visit";

export default async function AffectedPage({ params }: PageProps<"/[locale]/admin/affected">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.absence");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const isManager = managesAllVisits(me);
  const visits = (await visitsWithAbsentStaff()).filter((v) => isManager || v.staffId === me.id);
  // People who own their clients can hand their own visits to a colleague.
  const people = isManager || me.ownsClients
    ? await db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder), columns: { id: true, name: true } })
    : [];
  const when = (d: Date) => {
    const l = utcToLocal(d, business.timezone);
    return `${dayLabel(l.day, locale, "short")} · ${hhmm(l.minutes)}`;
  };
  const rows = await Promise.all(
    visits.map(async (v) => {
      const text = await staffOffText(v);
      // Only offer people who are in at that time.
      const offFlags = await Promise.all(people.map((p) => staffIsOff({ staffId: p.id, startsAt: v.startsAt, endsAt: v.endsAt })));
      return {
        people: people.filter((_, i) => !offFlags[i]),
        id: v.id,
        client: v.bookedForName || v.client.name,
        clientId: v.clientId,
        what: v.lines.map((l) => serviceName(l.service, locale)).join(" + "),
        when: when(v.startsAt),
        staffId: v.staffId,
        staffName: v.staff.name,
        // Someone who owns their clients (e.g. a chair renter) sorts these out; anyone else's are the owner's.
        renter: v.staff.ownsClients,
        messaged: v.absenceNotifiedAt ? dayLabel(utcToLocal(v.absenceNotifiedAt, business.timezone).day, locale, "short") : null,
        hasEmail: !!v.client.email,
        wa: waLink(v.client.phone, text),
        sms: smsLink(v.client.phone, text),
      };
    }),
  );
  const canAct = (r: (typeof rows)[number]) => isManager || (r.renter && r.staffId === me.id);

  return (
    <div>
      <PageHeader title={t("affected")} back={`/${locale}/admin`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <p className="text-sm text-muted">{t("affectedHint")}</p>
        {rows.length === 0 && <p className="card p-6 text-center text-muted">{t("none")}</p>}
        {rows.map((r) => (
          <AffectedVisit key={r.id} visit={r} locale={locale} people={r.people} canAct={canAct(r)} canReassign={canAct(r)} own={r.staffId === me.id} />
        ))}
      </div>
    </div>
  );
}
