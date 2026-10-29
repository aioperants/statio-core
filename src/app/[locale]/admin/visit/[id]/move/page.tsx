import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { pageMember, managesAllVisits } from "@/lib/access";
import { appointmentDetails, requireBusiness } from "@/lib/booking";
import { schedule } from "@/lib/schedule";
import { utcToLocal } from "@/lib/time";
import { MoveForm } from "./move-form";

export default async function MovePage({ params }: PageProps<"/[locale]/admin/visit/[id]/move">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.visit");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const v = /^[0-9a-f-]{36}$/.test(id) ? await appointmentDetails({ id }) : null;
  if (!v || (!managesAllVisits(me) && v.staffId !== me.id)) notFound();
  const local = utcToLocal(v.startsAt, business.timezone);
  const { people } = await schedule(local.day, 1);
  return (
    <div>
      <PageHeader title={t("moveTitle")} back={`/${locale}/admin/visit/${id}`} />
      <MoveForm
        id={v.id}
        locale={locale}
        day={local.day}
        staffId={v.staffId}
        canPickStaff={managesAllVisits(me)}
        serviceIds={[...v.lines].sort((a, b) => +a.startsAt - +b.startsAt).map((l) => l.serviceId)}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        hasEmail={!!v.client.email}
      />
    </div>
  );
}
