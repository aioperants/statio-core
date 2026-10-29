import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { allows } from "@/lib/permissions";
import { EquipmentForm } from "./equipment-form";

export default async function EquipmentEdit({ params, searchParams }: PageProps<"/[locale]/admin/equipment/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.equipment");
  const me = await pageMember(locale);
  const isManager = allows(me, "equipment", "edit");
  const item = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? await db.query.equipment.findFirst({ where: eq(schema.equipment.id, id) }) : null;
  if (id !== "new" && (!item || (!isManager && item.ownerStaffId !== me.id))) notFound();
  const people = isManager
    ? await db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder), columns: { id: true, name: true } })
    : [];
  // From a person's profile: ?owner=<id> starts the new item as theirs.
  const { owner } = await searchParams;
  const preOwner = isManager ? (typeof owner === "string" && people.some((p) => p.id === owner) ? owner : null) : me.id;
  return (
    <div>
      <PageHeader title={item?.name ?? t("add")} back={`/${locale}/admin/equipment`} />
      <EquipmentForm
        salon={(await requireBusiness()).name}
        locale={locale}
        isManager={isManager}
        people={people}
        item={item ? { ...item, monthlyCost: item.monthlyCostCents != null ? item.monthlyCostCents / 100 : null } : null}
        defaultOwner={item ? item.ownerStaffId : preOwner}
      />
    </div>
  );
}
