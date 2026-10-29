import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Field, PageHeader, SubmitButton } from "@/components/admin/ui";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { CURRENCIES, TIMEZONES } from "@/lib/options";
import { BUSINESS_TYPES } from "@/lib/templates";
import { PhoneInput } from "@/components/phone-input";
import { phoneCountries } from "@/lib/phone";
import { saveSalon } from "../_actions/settings";
import { LogoUpload } from "./logo-upload";
import { AppColoursPicker } from "./app-colours-picker";
import { websiteAppColours } from "@/lib/app-theme";
import { heroLayout } from "@/lib/readiness";
import { websiteRow } from "@/lib/site/data";

export default async function SalonPage({ params, searchParams }: PageProps<"/[locale]/admin/salon">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const sp = await searchParams;
  const t = await getTranslations("admin.salon");
  const logoDesign = heroLayout((await websiteRow()).config) === "brand";
  const tc = await getTranslations("common");
  const ts = await getTranslations("templates");
  const b = await requireBusiness();
  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/settings/business`} />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        {sp.saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <form action={saveSalon.bind(null, locale)} className="grid gap-4">
          <div className="card grid gap-4 p-4" id="more">
            {/* The logo belongs to the "Logo and text" website design only (set there); otherwise the name is shown. */}
            {logoDesign && <LogoUpload name={b.name} initial={b.logo} original={b.logoOriginal} />}
            <AppColoursPicker initial={b.appColours} website={await websiteAppColours(b)} name={b.name} logo={logoDesign ? b.logo : null} />
          </div>
          <div className="card grid gap-4 p-4">
            <Field label={t("name")}>
              <input name="name" required className="field" defaultValue={b.name} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("phone")}>
                <PhoneInput name="phone" defaultValue={b.phone} country={b.country} locale={locale} />
              </Field>
              <Field label={t("email")}>
                <input name="email" type="email" className="field" defaultValue={b.email ?? ""} />
              </Field>
            </div>
            <Field label={t("address")}>
              <input name="address" className="field" defaultValue={b.address ?? ""} />
            </Field>
            <Field label={t("country")} hint={t("countryHint")}>
              <select name="country" className="field" defaultValue={b.country ?? ""}>
                <option value="">—</option>
                {phoneCountries(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} (+{c.dial})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("timezone")}>
                <select name="timezone" className="field" defaultValue={b.timezone}>
                  {[...new Set([b.timezone, ...TIMEZONES])].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("currency")}>
                <select name="currency" className="field" defaultValue={b.currency}>
                  {[...new Set([b.currency, ...CURRENCIES])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          {/* What kind of business, a short description, their website and profiles elsewhere. */}
          <div className="card grid gap-4 p-4" id="online">
            <div>
              <h2 className="font-semibold">{t("online.title")}</h2>
              <p className="text-sm text-muted">{t("online.hint")}</p>
            </div>
            <Field label={t("online.types")}>
              <div className="flex flex-wrap gap-2">
                {BUSINESS_TYPES.map((type) => (
                  <label key={type} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft">
                    <input type="checkbox" name="businessTypes" value={type} defaultChecked={b.businessTypes.includes(type)} className="size-4 accent-brand" />
                    {ts(`types.${type}`)}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t("online.about")} hint={t("online.aboutHint")}>
              <textarea name="about" rows={2} maxLength={300} className="field" defaultValue={b.about ?? ""} placeholder={t("online.aboutPlaceholder")} />
            </Field>
            <Field label={t("online.website")} hint={t("online.websiteHint")}>
              <input name="website" inputMode="url" className="field" defaultValue={b.website ?? ""} placeholder="www.example.com" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Instagram">
                <input name="instagram" className="field" defaultValue={b.instagram ?? ""} placeholder="@" />
              </Field>
              <Field label="Facebook">
                <input name="facebook" className="field" defaultValue={b.facebook ?? ""} placeholder={t("online.pageName")} />
              </Field>
              <Field label="TikTok">
                <input name="tiktok" className="field" defaultValue={b.tiktok ?? ""} placeholder="@" />
              </Field>
            </div>
          </div>
          <SubmitButton>{tc("save")}</SubmitButton>
        </form>

        <Link href={`/${locale}/admin/settings/found`} id="google" className="card flex items-center gap-3 p-4">
          <span className="text-xl">⌕</span>
          <span className="flex-1">
            <span className="block font-semibold">{t("online.foundLink")}</span>
            <span className="block text-sm text-muted">{t("online.foundLinkHint")}</span>
          </span>
          <span className="text-muted">›</span>
        </Link>

      </div>
    </div>
  );
}
