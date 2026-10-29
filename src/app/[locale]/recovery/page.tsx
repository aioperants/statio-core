import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { getBusiness } from "@/lib/booking";
import { publicLogo } from "@/lib/public-logo";
import { AskForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** On the salon's address: the owner lost access to their sign-in email (see lib/recovery). */
export default async function RecoveryPage({ params }: PageProps<"/[locale]/recovery">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recovery");
  const business = await getBusiness();
  return (
    <main className="statio min-h-dvh px-4">
      <div className="mx-auto grid max-w-sm gap-4 pb-10">
        <BrandHeader name={business?.name ?? "Statio CRM"} logo={await publicLogo(business)} />
        <div className="text-center">
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
        </div>
        {business ? <AskForm locale={locale} /> : null}
        <p className="text-center text-xs text-muted">{t("noSecond")}</p>
      </div>
    </main>
  );
}
