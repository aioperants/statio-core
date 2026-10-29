import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/admin/ui";
import { SignOutButton } from "@/components/admin/sign-out";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { availableLanguages } from "@/i18n/messages";
import { ADMIN_LOCALE } from "@/i18n/languages";
import { getSession, maySetUp } from "@/lib/access";
import { getBusiness } from "@/lib/booking";
import { CURRENCIES, TIMEZONES } from "@/lib/options";
import { isCountry, phoneCountries } from "@/lib/phone";
import { BUSINESS_TYPES } from "@/lib/templates";
import { helloOn } from "@/lib/core-hello";
import { setupSalon } from "../admin/_actions/settings";

/**
 * No salon yet: one form that creates it.
 */
export async function SetupForm({ locale }: { locale: string }) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/${locale}/setup`);
  const business = await getBusiness();
  const t = await getTranslations("admin.setup");
  // A first guess at the country from the browser's language ("es-ES" → Spain); easy to change.
  const region = ((await headers()).get("accept-language") ?? "").match(/^[a-z]{2,3}-([A-Z]{2})/)?.[1];
  const guessCountry = isCountry(region) ? region : "ES";
  const tt = await getTranslations("templates");

  if (!(await maySetUp(session))) {
    const owner = await db.query.staff.findFirst({ where: eq(schema.staff.role, "owner"), columns: { email: true } });
    const ownerEmail = owner?.email ?? process.env.OWNER_EMAIL?.toLowerCase();
    return (
      <main className="mx-auto grid grid-cols-1 max-w-sm gap-4 p-8 text-center">
        <p>{t("onlyOwner", { email: ownerEmail ?? "" })}</p>
        <SignOutButton locale={locale} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 mb-6 text-muted">{t("intro")}</p>
      <form action={setupSalon.bind(null, locale)} className="card grid gap-4 p-5">
        <label>
          <span className="label">{t("name")}</span>
          <input name="name" required className="field" defaultValue={business?.name ?? ""} />
        </label>
        <label>
          <span className="label">{t("ownerName")}</span>
          <input name="ownerName" required className="field" defaultValue={session.user.name} />
        </label>
        {/* The admin is in English (i18n/languages ADMIN_LOCALE); the language below is the clients'. */}
        <input type="hidden" name="ownerLocale" value={ADMIN_LOCALE} />
        <label>
          <span className="label">{t("language")}</span>
          <select name="defaultLocale" className="field" defaultValue={locale}>
            {availableLanguages().map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-2">
          <legend className="label">{t("types")}</legend>
          {BUSINESS_TYPES.map((type) => (
            <label key={type} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
              <input type="checkbox" name="types" value={type} className="mt-0.5 size-5 accent-brand" />
              <span>
                <span className="block font-medium">{tt(`types.${type}`)}</span>
                <span className="block text-sm text-muted">{tt(`typeHints.${type}`)}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted">{t("typesHint")}</p>
        </fieldset>
        <label>
          <span className="label">{t("country")}</span>
          <select name="country" className="field" defaultValue={guessCountry}>
            {phoneCountries(locale).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">{t("countryHint")}</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">{t("timezone")}</span>
            <select name="timezone" className="field" defaultValue="Europe/Madrid">
              {TIMEZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">{t("currency")}</span>
            <select name="currency" className="field" defaultValue="EUR">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {/* Statio Core: an optional line to the Statio team (lib/core-hello), unticked until they choose. */}
        {helloOn() && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="updates" className="mt-0.5 size-5 accent-brand" />
            <span>
              <span className="block font-medium">{t("updates")}</span>
              <span className="block text-muted">{t("updatesHint")}</span>
            </span>
          </label>
        )}
        <SubmitButton>{t("start")}</SubmitButton>
        <p className="text-center text-sm text-muted">{t("nextSteps")}</p>
      </form>
    </main>
  );
}
