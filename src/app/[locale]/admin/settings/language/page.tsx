import { getTranslations, setRequestLocale } from "next-intl/server";
import { Field, PageHeader, SubmitButton } from "@/components/admin/ui";
import { availableLanguages } from "@/i18n/messages";
import { ADMIN_LOCALE } from "@/i18n/languages";
import { pageMember } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { requireBusiness } from "@/lib/booking";
import { saveLanguages } from "../../_actions/settings";

/** The language clients see (booking page, website, emails). The admin itself is in English (ADMIN_LOCALE). */
export default async function LanguagePage({ params, searchParams }: PageProps<"/[locale]/admin/settings/language">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.language");
  const tc = await getTranslations("common");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const languages = availableLanguages();
  const options = languages.map((l) => (
    <option key={l.code} value={l.code}>
      {l.name}
    </option>
  ));
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title={t("clients")} back={`/${locale}/admin/settings/business`} />
      <form action={saveLanguages.bind(null, locale)} className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        {sp.saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <div className="card grid gap-4 p-4">
          <input type="hidden" name="mine" value={ADMIN_LOCALE} />
          {allows(me, "settings", "edit") && (
            <Field label={t("clients")} hint={t("clientsHint")}>
              <select name="defaultLocale" className="field" defaultValue={business.defaultLocale}>
                {options}
              </select>
            </Field>
          )}
        </div>
        <SubmitButton>{tc("save")}</SubmitButton>
      </form>
    </div>
  );
}
