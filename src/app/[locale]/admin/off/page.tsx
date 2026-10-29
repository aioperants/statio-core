import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember, managesAllVisits } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { todayIn } from "@/lib/time";
import { OffForm } from "./off-form";

export default async function OffPage({ params }: PageProps<"/[locale]/admin/off">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.absence");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const people =
    !managesAllVisits(me)
      ? []
      : await db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder), columns: { id: true, name: true, photo: true, color: true } });
  return (
    <div>
      <PageHeader title={managesAllVisits(me) ? t("someoneOff") : t("cantCome")} back={`/${locale}/admin`} />
      <OffForm
        locale={locale}
        today={todayIn(business.timezone)}
        people={people}
        me={me.id}
        mode={managesAllVisits(me) ? "owner" : me.ownsClients ? "renter" : "staff"}
      />
    </div>
  );
}
