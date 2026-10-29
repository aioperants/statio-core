import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { dayLabel, serviceName } from "@/lib/format";
import { ACCESS, grantable, isAccess, permissionsOf, PRESETS } from "@/lib/permissions";
import { utcToLocal } from "@/lib/time";
import { ShareCard } from "@/components/admin/share-card";
import { staffLinkText } from "@/lib/notify";
import { onlineStaff } from "@/lib/online-staff";
import { InvitePanel } from "./invite-panel";
import { StaffForm } from "./staff-form";
import { salonUrl } from "@/lib/salon-url";

export default async function StaffEditPage({ params, searchParams }: PageProps<"/[locale]/admin/staff/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { me, denied } = await managerOnly(locale, "team", "edit");
  if (denied) return denied;
  const t = await getTranslations("admin.staff");
  const person =
    id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? await db.query.staff.findFirst({ where: eq(schema.staff.id, id), with: { hours: true, services: true } }) : null;
  if (id !== "new" && !person) notFound();
  // Only what they could grant (the owner's page is the owner's), as the server checks too.
  if (person && person.id !== me!.id && !grantable(me!, isAccess(person.access) ? person.access : "stylist")) {
    return <p className="p-8 text-center text-muted">{(await getTranslations("common"))("notAllowed")}</p>;
  }
  const [services, chairs, opening] = await Promise.all([
    db.query.service.findMany({ where: eq(schema.service.active, true), orderBy: asc(schema.service.sortOrder) }),
    db.query.chair.findMany({ where: eq(schema.chair.active, true), orderBy: asc(schema.chair.sortOrder) }),
    db.query.businessHours.findMany(),
  ]);
  const business = await requireBusiness();
  const online = person ? await onlineStaff() : null;
  const slug = person && online?.slugs.get(person.id);
  const base = salonUrl();
  const link = slug ? `${base}/${business.defaultLocale}/book?staff=${slug}` : null;
  const tb = await getTranslations("admin.staff.bookingLink");
  const tools = person ? await db.$count(schema.equipment, eq(schema.equipment.ownerStaffId, person.id)) : 0;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#staff`} title={person ? [person.name, person.lastName].filter(Boolean).join(" ") : t("add")} back={`/${locale}/admin/staff`} />
      {person && person.access !== "owner" && isAccess(person.access) && grantable(me!, person.access) && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-8">
          <InvitePanel
            locale={locale}
            id={person.id}
            name={person.name}
            phone={person.phone}
            hasEmail={!!person.email}
            status={person.pausedAt ? "paused" : person.userId ? "active" : person.inviteToken && person.inviteExpiresAt && person.inviteExpiresAt > new Date() ? "invited" : "none"}
            validUntil={person.inviteExpiresAt ? dayLabel(utcToLocal(person.inviteExpiresAt, business.timezone).day, locale, "short") : null}
            open={(await searchParams).invite === "1"}
          />
        </div>
      )}
      <StaffForm
        locale={locale}
        accessChoices={ACCESS.filter((x) => x !== "owner" && grantable(me!, x))}
        accessCap={me!.access === "owner" ? PRESETS.owner : permissionsOf(me!)}
        opening={opening.map((o) => ({ weekday: o.weekday, start: o.startMin, end: o.endMin }))}
        weekdays={weekdays}
        services={services.map((s) => ({ id: s.id, name: serviceName(s, locale), durationMin: s.durationMin }))}
        country={business.country}
        chairs={chairs.filter((c) => !c.shared).map((c) => ({ id: c.id, name: c.name }))}
        person={
          person
            ? {
                id: person.id,
                name: person.name,
                email: person.email ?? "",
                color: person.color,
                photo: person.photo,
                title: person.title ?? "",
                lastName: person.lastName ?? "",
                jobTitle: person.jobTitle ?? "",
                phone: person.phone ?? "",
                access: isAccess(person.access) ? person.access : "stylist",
                permissions: person.permissions,
                bookable: person.bookable,
                payModel: person.payModel,
                ownsClients: person.ownsClients,
                salary: person.salaryCents != null ? person.salaryCents / 100 : null,
                commissionPct: person.commissionPct,
                chairRent: person.chairRentCents != null ? person.chairRentCents / 100 : null,
                chairRentPeriod: person.chairRentPeriod,
                chairRentDay: person.chairRentDay,
                defaultChairId: person.defaultChairId,
                serviceIds: person.services.map((s) => s.serviceId),
                durations: Object.fromEntries(person.services.filter((s) => s.durationMin).map((s) => [s.serviceId, s.durationMin!])),
                hours: person.hours.map((h) => ({ weekday: h.weekday, start: h.startMin, end: h.endMin })),
              }
            : null
        }
      />
      {person && (
        <div className="grid mx-auto w-full max-w-6xl gap-3 px-4 pb-8 md:px-8">
          {/* Their own booking link: opens the booking page with them chosen (for their Instagram bio). */}
          {link ? (
            <ShareCard text={await staffLinkText(person.name, link)} link={link} title={tb("title")} hint={tb("hint")} />
          ) : (
            <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{tb("notOnline")}</p>
          )}
          <Link href={`/${locale}/admin/equipment/new?owner=${person.id}`} className="card flex items-center gap-3 p-3.5 font-medium">
            <span className="text-lg">⚒︎</span>
            <span className="flex-1">{t("tools", { count: tools })}</span>
            <span className="text-sm text-brand">+ {t("addTool")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
