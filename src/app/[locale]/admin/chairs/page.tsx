import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TextsField } from "@/components/admin/texts-field";
import { Empty, PageHeader, SubmitButton } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { money } from "@/lib/format";
import { salonLanguages } from "@/lib/salon-languages";
import { type KindNames, kindLabel, stationsLabel } from "@/lib/stations";
import { saveStationsLabel } from "../_actions/team";

export default async function ChairsPage({ params }: PageProps<"/[locale]/admin/chairs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.chairs");
  const tc = await getTranslations("common");
  const { business, options } = await salonLanguages();
  const [chairs, people] = await Promise.all([
    db.query.chair.findMany({ where: eq(schema.chair.active, true), orderBy: asc(schema.chair.sortOrder) }),
    db.query.staff.findMany({ where: eq(schema.staff.active, true) }),
  ]);
  return (
    <div>
      <PageHeader
        title={stationsLabel(business, locale) ?? t("title")}
        back={`/${locale}/admin/services`}
        action={
          <Link href={`/${locale}/admin/chairs/new`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
            + {t("add").split(" ")[0]}
          </Link>
        }
      />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-3 p-4 md:px-8">
        <p className="text-sm text-muted">{t("hint")}</p>
        {chairs.length === 0 ? (
          <Empty>{t("none")}</Empty>
        ) : (
          <ul className="card divide-y divide-line">
            {chairs.map((c) => {
              const renter = people.find((p) => p.id === c.renterStaffId);
              const usual = people.filter((p) => p.defaultChairId === c.id && p.id !== c.renterStaffId);
              return (
                <li key={c.id}>
                  <Link href={`/${locale}/admin/chairs/${c.id}`} className="flex items-center gap-3 p-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className="text-sm text-muted">
                        {[kindLabel(c.kind, t.raw("kinds") as KindNames), c.shared && t("shared"), renter && `${t("renter")}: ${renter.name}`, ...usual.map((p) => p.name)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {c.rentCents != null && renter && <span className="font-semibold">{money(c.rentCents, business.currency, locale)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <form action={saveStationsLabel.bind(null, locale)} className="card mt-2 grid gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("sectionName")}</h2>
            <p className="text-sm text-muted">{t("sectionNameHint")}</p>
          </div>
          <TextsField name="label" label={t("sectionNameLabel")} langs={options} values={business.stationsLabels} maxLength={40} placeholder={t("title")} />
          <SubmitButton className="btn-ghost w-full">{tc("save")}</SubmitButton>
        </form>
      </div>
    </div>
  );
}
