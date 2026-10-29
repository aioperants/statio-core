import { and, asc, eq, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { clientsVisibleTo, pageMember, managesAllVisits } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { categoryName, serviceName } from "@/lib/format";
import { isValidDay, todayIn, utcToLocal } from "@/lib/time";
import { NewBookingForm } from "./new-booking-form";

export default async function NewBookingPage({ params, searchParams }: PageProps<"/[locale]/admin/new">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.newBooking");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const [services, people, links] = await Promise.all([
    db.query.service.findMany({ orderBy: [asc(schema.service.sortOrder), asc(schema.service.nameEs)] }),
    db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder) }),
    db.query.staffService.findMany(),
  ]);
  const clientId = typeof sp.client === "string" && /^[0-9a-f-]{36}$/.test(sp.client) ? sp.client : null;
  const client = clientId ? await db.query.client.findFirst({ where: and(eq(schema.client.id, clientId), eq(schema.client.guest, false), isNull(schema.client.erasedAt), clientsVisibleTo(me)) }) : null;
  const visible = managesAllVisits(me) ? people : people.filter((p) => p.id === me.id);
  const local = utcToLocal(new Date(), business.timezone);
  const nowRounded = Math.min(Math.floor(local.minutes / 5) * 5, 1435);
  const staffParam = typeof sp.staff === "string" && visible.some((p) => p.id === sp.staff) ? sp.staff : visible.length === 1 ? visible[0].id : null;

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#guests`} title={t("title")} back={`/${locale}/admin`} />
      <NewBookingForm
        locale={locale}
        currency={business.currency}
        day={typeof sp.day === "string" && isValidDay(sp.day) ? sp.day : todayIn(business.timezone)}
        staffId={managesAllVisits(me) ? staffParam : me.id}
        services={services.filter((s) => s.active).map((s) => ({ id: s.id, name: serviceName(s, locale), group: categoryName(s, locale) || null, durationMin: s.durationMin, priceCents: s.priceCents }))}
        people={visible.map((p) => ({ id: p.id, name: p.name, photo: p.photo, color: p.color, serviceIds: links.filter((l) => l.staffId === p.id).map((l) => l.serviceId) }))}
        client={client ? { id: client.id, name: client.name, phone: client.phone, email: client.email } : null}
        serviceIds={typeof sp.services === "string" ? sp.services.split(",").filter((id) => services.some((s) => s.id === id && s.active)) : []}
        walkIn={sp.walkin === "1"}
        country={business.country}
        nowMin={nowRounded}
      />
    </div>
  );
}
