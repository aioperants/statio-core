import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Field, PageHeader, SubmitButton, Toggle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { BUILT_IN_KINDS, type KindNames, kindLabel } from "@/lib/stations";
import { removeChair, saveChair } from "../../_actions/team";

export default async function ChairEdit({ params }: PageProps<"/[locale]/admin/chairs/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.chairs");
  const tc = await getTranslations("common");
  const c = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? await db.query.chair.findFirst({ where: eq(schema.chair.id, id) }) : null;
  if (id !== "new" && !c) notFound();
  const people = await db.query.staff.findMany({ where: eq(schema.staff.active, true) });
  const kindNames = t.raw("kinds") as KindNames;
  const used = await db.selectDistinct({ kind: schema.chair.kind }).from(schema.chair);
  const kinds = [...new Set([...BUILT_IN_KINDS, ...used.map((u) => u.kind)])];
  return (
    <div>
      <PageHeader title={c?.name ?? t("add")} back={`/${locale}/admin/chairs`} />
      <form action={saveChair.bind(null, locale)} className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <input type="hidden" name="id" value={c?.id ?? ""} />
        <div className="card grid gap-4 p-4">
          <Field label={t("name")}>
            <input name="name" required className="field" defaultValue={c?.name} />
          </Field>
          <Field label={t("kind")} hint={t("kindHint")}>
            <input name="kind" list="station-kinds" required maxLength={40} className="field" defaultValue={kindLabel(c?.kind ?? "styling", kindNames)} />
          </Field>
          <datalist id="station-kinds">
            {kinds.map((k) => (
              <option key={k} value={kindLabel(k, kindNames)} />
            ))}
          </datalist>
          <Toggle name="shared" label={t("shared")} hint={t("hint")} defaultChecked={c?.shared ?? false} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("renter")}>
              <select name="renterStaffId" className="field" defaultValue={c?.renterStaffId ?? ""}>
                <option value="">{t("nobody")}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("rent")}>
              <input name="rent" inputMode="decimal" className="field" defaultValue={c?.rentCents != null ? c.rentCents / 100 : ""} />
            </Field>
          </div>
        </div>
        <SubmitButton>{tc("save")}</SubmitButton>
      </form>
      {c && (
        <form action={removeChair.bind(null, locale, c.id)} className="mx-auto w-full max-w-6xl px-4 md:px-8">
          <SubmitButton className="btn-danger w-full">{tc("delete")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
