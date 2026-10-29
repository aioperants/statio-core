import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TextsField } from "@/components/admin/texts-field";
import { Field, PageHeader, SubmitButton, Toggle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { categoryName, serviceName } from "@/lib/format";
import { salonLanguages } from "@/lib/salon-languages";
import { BUILT_IN_KINDS, type KindNames, kindLabel } from "@/lib/stations";
import { saveService } from "../../_actions/team";

export default async function ServiceEdit({ params }: PageProps<"/[locale]/admin/services/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale, "services", "edit");
  if (denied) return denied;
  const t = await getTranslations("admin.services");
  const tc = await getTranslations("common");
  const s = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? await db.query.service.findFirst({ where: eq(schema.service.id, id) }) : null;
  if (id !== "new" && !s) notFound();
  // Only the languages the salon offers clients are asked for.
  const { options } = await salonLanguages();
  const categories = await db.query.serviceCategory.findMany({ orderBy: asc(schema.serviceCategory.sortOrder) });
  // Shared station types a service can need: the usual ones plus the salon's own (not the personal styling chair).
  const used = await db.selectDistinct({ kind: schema.chair.kind }).from(schema.chair);
  const kindNames = (await getTranslations("admin.chairs")).raw("kinds") as KindNames;
  const stations = [...new Set([...BUILT_IN_KINDS, ...used.map((u) => u.kind), ...(s?.stationKind ? [s.stationKind] : [])])].filter((k) => k !== "styling");
  return (
    <div>
      <PageHeader title={s ? serviceName(s, locale) : t("add")} back={`/${locale}/admin/services`} />
      <form action={saveService.bind(null, locale)} className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <input type="hidden" name="id" value={s?.id ?? ""} />
        <div className="card grid gap-4 p-4">
          <TextsField name="name" label={t("name")} langs={options} values={s?.names ?? {}} required maxLength={100} />
          <TextsField name="description" label={t("description")} placeholder={t("descriptionHint")} langs={options} values={s?.descriptions ?? {}} multiline maxLength={400} />
          <Field label={t("category")}>
            <select name="categoryId" className="field" defaultValue={s?.categoryId ?? ""}>
              <option value="">{t("noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName({ categoryNames: c.names, category: c.nameEs }, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Link href={`/${locale}/admin/services/categories`} className="-mt-2 text-sm font-medium text-brand">
            {t("manageCategories")} →
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("price")}>
              <input name="price" inputMode="decimal" className="field" defaultValue={s ? s.priceCents / 100 : ""} />
            </Field>
            <Field label={t("duration")}>
              <input name="durationMin" type="number" min={5} step={5} required className="field" defaultValue={s?.durationMin ?? 30} />
            </Field>
          </div>
          <Toggle name="active" label={t("active")} defaultChecked={s?.active ?? true} />
        </div>
        {/* Most services never need these: folded, open when one is already set. */}
        <details className="card group p-4" open={Boolean(s && (s.bufferAfterMin || s.rebookDays || s.stationKind || s.colourCard || s.needsConsent))}>
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t("moreTitle")}</span>
              <span className="block text-sm text-muted">{t("moreHint")}</span>
            </span>
            <span className="text-muted transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-4 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("bufferAfter")}>
                <input name="bufferAfterMin" type="number" min={0} step={5} className="field" defaultValue={s?.bufferAfterMin ?? 0} />
              </Field>
              <Field label={t("rebookDays")} hint={t("rebookHint")}>
                <input name="rebookDays" type="number" min={0} max={365} className="field" defaultValue={s?.rebookDays ?? ""} />
              </Field>
            </div>
            <Field label={t("station")}>
              <select name="stationKind" className="field" defaultValue={s?.stationKind ?? ""}>
                <option value="">{t("noStation")}</option>
                {stations.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k, kindNames)}
                  </option>
                ))}
              </select>
            </Field>
            {/* Chairs and rooms only matter to services that share one: they live here, not in Settings. */}
            <Link href={`/${locale}/admin/chairs`} className="-mt-2 text-sm font-medium text-brand">
              {t("manageStations")} →
            </Link>
            <Toggle name="colourCard" label={t("colourCard")} hint={t("colourCardHint")} defaultChecked={s?.colourCard ?? false} />
            <Toggle name="needsConsent" label={t("needsConsent")} hint={t("needsConsentHint")} defaultChecked={s?.needsConsent ?? false} />
          </div>
        </details>
        <SubmitButton>{tc("save")}</SubmitButton>
      </form>
    </div>
  );
}
