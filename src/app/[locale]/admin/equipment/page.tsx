import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { requireBusiness } from "@/lib/booking";
import { money } from "@/lib/format";
import { Chair, Scissors } from "@/components/icons";

/** Who owns what. Staff see and keep their own list; the owner and managers see everything. */
export default async function EquipmentPage({ params }: PageProps<"/[locale]/admin/equipment">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.equipment");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const isManager = allows(me, "equipment", "edit");
  const [items, people] = await Promise.all([
    db.query.equipment.findMany({
      where: isManager ? undefined : eq(schema.equipment.ownerStaffId, me.id),
      orderBy: [asc(schema.equipment.kind), asc(schema.equipment.name)],
    }),
    db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder), columns: { id: true, name: true } }),
  ]);
  const groups = (isManager ? [{ id: null as string | null, name: t("salon", { salon: business.name }) }, ...people] : [{ id: me.id, name: me.name }])
    .map((g) => ({ ...g, items: items.filter((i) => i.ownerStaffId === g.id) }))
    .filter((g) => isManager || g.items.length > 0 || g.id === me.id);
  const rentTotal = items.filter((i) => i.rented && i.monthlyCostCents).reduce((a, i) => a + i.monthlyCostCents!, 0);

  return (
    <div>
      <PageHeader
        title={isManager ? t("title") : t("mine")}
        back={`/${locale}/admin/${isManager ? "staff" : "more"}`}
        action={
          <Link href={`/${locale}/admin/equipment/new`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
            + {t("add")}
          </Link>
        }
      />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <p className="text-sm text-muted">{isManager ? t("hint") : t("hintStaff", { salon: business.name })}</p>
        {isManager && rentTotal > 0 && <p className="card p-3 text-sm">{t("rentTotal", { amount: money(rentTotal, business.currency, locale) })}</p>}
        {groups.map((g) => (
          <section key={g.id ?? "salon"}>
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-muted uppercase">{g.name}</h2>
            {g.items.length === 0 ? (
              <p className="card p-4 text-center text-sm text-muted">{t("none")}</p>
            ) : (
              <ul className="card divide-y divide-line">
                {g.items.map((i) => (
                  <li key={i.id}>
                    <Link href={`/${locale}/admin/equipment/${i.id}`} className="flex items-center gap-3 p-3">
                      {i.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.photo} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-canvas text-lg">{i.kind === "equipment" ? <Chair className="size-5" /> : <Scissors className="size-5" />}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{i.name}</span>
                        <span className="block truncate text-sm text-muted">
                          {[t(`kinds.${i.kind as "tool"}`), i.location, i.rented && t("rentedShort")].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {i.rented && i.monthlyCostCents != null && (
                        <span className="text-sm font-semibold">{t("perMonth", { amount: money(i.monthlyCostCents, business.currency, locale) })}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
