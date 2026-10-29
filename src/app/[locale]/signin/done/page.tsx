import { getTranslations, setRequestLocale } from "next-intl/server";
import { Announce } from "./announce";

/** Where a popup (or a magic link opened in a new tab) lands after sign-in. */
export default async function SignedIn({
  params,
}: PageProps<"/[locale]/signin/done">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("signin");
  return (
    <main className="statio min-h-dvh px-4">
      <div className="mx-auto max-w-sm py-8 text-center">
        <Announce />
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-soft text-2xl text-brand">
          ✓
        </div>
        <p className="font-medium">{t("done")}</p>
      </div>
    </main>
  );
}
