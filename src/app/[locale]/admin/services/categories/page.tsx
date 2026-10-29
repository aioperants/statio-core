import { asc, count } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { TextsField } from "@/components/admin/texts-field";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { salonLanguages } from "@/lib/salon-languages";
import { textIn } from "@/lib/texts";
import { deleteCategory, moveCategory, saveCategory } from "../../_actions/categories";

export default async function CategoriesPage({ params }: PageProps<"/[locale]/admin/services/categories">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale, "services", "edit");
  if (denied) return denied;
  const t = await getTranslations("admin.categories");
  const tc = await getTranslations("common");
  const { options, fallback } = await salonLanguages();
  const list = await db.query.serviceCategory.findMany({ orderBy: [asc(schema.serviceCategory.sortOrder), asc(schema.serviceCategory.createdAt)] });
  const used = await db.select({ id: schema.service.categoryId, n: count() }).from(schema.service).groupBy(schema.service.categoryId);
  const arrow = "flex size-8 items-center justify-center rounded-lg text-muted disabled:opacity-25";

  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/services`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-3 p-4 md:px-8">
        <p className="text-sm text-muted">{t("hint")}</p>
        {list.map((c, i) => {
          const n = used.find((u) => u.id === c.id)?.n ?? 0;
          return (
            <div key={c.id} className="card flex items-start gap-1 p-1.5">
              <div className="grid shrink-0">
                <form action={moveCategory.bind(null, c.id, -1)}>
                  <button className={arrow} disabled={i === 0} aria-label={t("up")}>↑</button>
                </form>
                <form action={moveCategory.bind(null, c.id, 1)}>
                  <button className={arrow} disabled={i === list.length - 1} aria-label={t("down")}>↓</button>
                </form>
              </div>
              {/* One compact row per category; tap it to rename, translate or delete. */}
              <details className="group min-w-0 flex-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-2 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{textIn(c.names, locale, fallback) || c.nameEs}</span>
                    <span className="text-sm text-muted">{t("services", { count: n })}</span>
                  </span>
                  <span className="text-sm font-medium text-brand group-open:hidden">{t("edit")}</span>
                </summary>
                <div className="grid gap-2 border-t border-line px-2 py-3">
                  <form action={saveCategory} className="grid gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <TextsField name="name" label={t("name")} langs={options} values={c.names} required maxLength={60} />
                    <button className="btn-primary min-h-10">{tc("save")}</button>
                  </form>
                  <form action={deleteCategory.bind(null, c.id)}>
                    <ConfirmButton message={t("deleteConfirm", { count: n })} className="btn-ghost min-h-10 w-full text-red-700">
                      {t("delete")}
                    </ConfirmButton>
                  </form>
                </div>
              </details>
            </div>
          );
        })}
        <form action={saveCategory} className="card grid gap-3 p-3">
          <p className="font-semibold">{t("add")}</p>
          <TextsField name="name" label={t("name")} langs={options} values={{}} required maxLength={60} placeholder={t("placeholder")} />
          <button className="btn-primary w-full">+ {t("add")}</button>
        </form>
      </div>
    </div>
  );
}
