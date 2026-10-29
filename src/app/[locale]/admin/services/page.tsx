import Link from "next/link";
import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Empty, PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { Camera } from "@/components/icons";
import { requireBusiness } from "@/lib/booking";
import { categoryName, money, serviceName } from "@/lib/format";
import { type KindNames, kindLabel, stationsLabel } from "@/lib/stations";
import { BUSINESS_TYPES } from "@/lib/templates";
import { addStarterServices } from "../_actions/team";

export default async function ServicesPage({ params, searchParams }: PageProps<"/[locale]/admin/services">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale, "services", "edit");
  if (denied) return denied;
  const t = await getTranslations("admin.services");
  const tc = await getTranslations("common");
  const business = await requireBusiness();
  const sp = await searchParams;
  const tt = await getTranslations("templates");
  const kindNames = (await getTranslations("admin.chairs")).raw("kinds") as KindNames;
  const [services, categories, chairs] = await Promise.all([
    db.query.service.findMany({ orderBy: [asc(schema.service.sortOrder), asc(schema.service.nameEs)] }),
    db.query.serviceCategory.findMany({ orderBy: asc(schema.serviceCategory.sortOrder) }),
    db.$count(schema.chair),
  ]);
  // Grouped under the salon's categories, in their order; services without one come last.
  const groups = [...categories.map((c) => ({ id: c.id, name: categoryName({ categoryNames: c.names, category: c.nameEs }, locale) })), { id: null, name: t("noCategory") }]
    .map((g) => ({ ...g, services: services.filter((s) => (s.categoryId ?? null) === g.id) }))
    .filter((g) => g.services.length > 0);
  return (
    <div>
      <PageHeader
        title={t("title")}
        back={`/${locale}/admin/settings`}
        action={
          <Link href={`/${locale}/admin/services/new`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
            + {t("add")}
          </Link>
        }
      />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-3 p-4 md:px-8">
        {sp.starter && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {t("starterAdded", { count: Number(sp.starter) })}</p>}
        {services.length === 0 ? (
          <Empty>{t("none")}</Empty>
        ) : (
          groups.map((g) => (
            <section key={g.id ?? "none"}>
              {groups.length > 1 && (
                <div className="mb-2 flex items-baseline gap-2 px-1">
                  <h2 className="flex-1 text-sm font-semibold tracking-wide text-muted uppercase">{g.name}</h2>
                  {/* Categories are renamed and reordered where they're seen. */}
                  {g.id && (
                    <Link href={`/${locale}/admin/services/categories`} className="text-sm font-medium text-muted hover:text-ink">
                      {tc("edit")}
                    </Link>
                  )}
                </div>
              )}
              <ul className="card divide-y divide-line">
                {g.services.map((s) => (
                  <li key={s.id}>
                    <Link href={`/${locale}/admin/services/${s.id}`} className={`flex items-center gap-3 p-3.5 ${s.active ? "" : "opacity-50"}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{serviceName(s, locale)}</span>
                        <span className="text-sm text-muted">
                          {[tc("minutes", { min: s.durationMin }), s.stationKind && `⌂ ${kindLabel(s.stationKind, kindNames)}`, !s.active && (s.priceCents === 0 ? `${t("hidden")} · ${t("needsPrice")}` : t("hidden"))].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="font-semibold">{money(s.priceCents, business.currency, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        {/* Grouping, and the shared chairs and rooms some services need: one quiet list under the services. */}
        <ul className="card divide-y divide-line">
          <li>
            <Link href={`/${locale}/admin/services/categories`} className="flex items-center gap-3 p-3.5">
              <span className="flex-1 font-medium">{t("manageCategories")}</span>
              <span className="text-sm text-muted">{categories.length}</span>
              <span className="text-muted">›</span>
            </Link>
          </li>
          {(chairs > 0 || services.some((s) => s.stationKind)) && (
            <li>
              <Link href={`/${locale}/admin/chairs`} className="flex items-center gap-3 p-3.5">
                <span className="flex-1 font-medium">{stationsLabel(business, locale) || t("manageStations")}</span>
                <span className="text-sm text-muted">{chairs}</span>
                <span className="text-muted">›</span>
              </Link>
            </li>
          )}
        </ul>
        {/* Typical services for a kind of business, for salons that didn't pick them at setup. */}
        <details className="card mt-2 p-4" open={services.length === 0}>
          <summary className="cursor-pointer font-semibold">{t("starterTitle")}</summary>
          <p className="mt-1 text-sm text-muted">{t("starterHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map((type) => (
              <form key={type} action={addStarterServices.bind(null, locale, type)}>
                <button className="btn-ghost w-full">+ {tt(`types.${type}`)}</button>
              </form>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
