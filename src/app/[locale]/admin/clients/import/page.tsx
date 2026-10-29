import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, SubmitButton } from "@/components/admin/ui";
import { staffForPage } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { importClients } from "../../_actions/clients";

export default async function ImportPage({ params, searchParams }: PageProps<"/[locale]/admin/clients/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.clients");
  const tc = await getTranslations("common");
  const me = await staffForPage(locale);
  if (!me || !allows(me, "clientData", "edit")) return <p className="p-8 text-center">{tc("notAllowed")}</p>;
  return (
    <div>
      <PageHeader title={t("importTitle")} back={`/${locale}/admin/clients`} />
      <form action={importClients.bind(null, locale)} className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <p className="text-muted">{t("importHint")}</p>
        {sp.error && <p className="text-sm text-red-700">{tc("error")}</p>}
        <label className="card block p-4">
          <span className="label">{t("importFile")}</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" />
        </label>
        <SubmitButton>{t("import")}</SubmitButton>
      </form>
    </div>
  );
}
