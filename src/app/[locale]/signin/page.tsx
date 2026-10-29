import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { enabledProviders } from "@/lib/auth";
import { getBusiness } from "@/lib/booking";
import { SignInForm } from "./sign-in-form";
import { publicLogo } from "@/lib/public-logo";

export default async function SignInPage({
  params,
  searchParams,
}: PageProps<"/[locale]/signin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const popup = sp.popup === "1";
  // Only same-site paths, never an outside URL.
  const nextParam =
    typeof sp.next === "string" &&
    sp.next.startsWith("/") &&
    !sp.next.startsWith("//")
      ? sp.next
      : `/${locale}/book`;
  const business = await getBusiness();
  return (
    <main className="statio min-h-dvh px-4">
      <div className="mx-auto max-w-sm pb-10">
        <BrandHeader
          name={business?.name ?? "Statio CRM"}
          logo={await publicLogo(business)}
        />
        <SignInForm
          providers={enabledProviders}
          callbackURL={popup ? `/${locale}/signin/done?popup=1` : nextParam}
          email={
            typeof sp.email === "string" ? sp.email.slice(0, 200) : undefined
          }
          showStaffHint={nextParam.includes("/admin")}
          staff={nextParam.includes("/admin")}
          passwords
          socialFailed={sp.error === "social"}
        />
        {/* The owner's way back in when they lose their sign-in email (lib/recovery). */}
        {nextParam.includes("/admin") && business && (
          <p className="mt-4 text-center text-sm">
            <a href={`/${locale}/recovery`} className="text-muted underline">
              {(await getTranslations("recovery"))("signInLink")}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
