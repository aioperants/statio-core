import { and, eq, gt } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { db, schema } from "@/db";
import { enabledProviders } from "@/lib/auth";
import { getBusiness } from "@/lib/booking";
import { SignInForm } from "../../signin/sign-in-form";
import { JoinForm } from "./join-form";
import { publicLogo } from "@/lib/public-logo";

/**
 * A staff member's personal invite: who invited them, then choosing their own password (or, without
 * a password, an email link / Google / Microsoft). Either way they're linked to their staff profile.
 */
export default async function JoinPage({ params }: PageProps<"/[locale]/join/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("join");
  const business = await getBusiness();
  const person = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? await db.query.staff.findFirst({ where: and(eq(schema.staff.inviteToken, token), eq(schema.staff.active, true), gt(schema.staff.inviteExpiresAt, new Date())) })
    : null;
  return (
    <main className="mx-auto max-w-sm px-4 pb-10">
      <BrandHeader name={business?.name ?? ""} logo={await publicLogo(business)} />
      {person?.email ? (
        <div className="grid gap-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold">{t("hello", { name: person.name })}</h1>
            <p className="mt-1 text-muted">{t("invited", { salon: business?.name ?? "" })}</p>
          </div>
          <JoinForm token={token} email={person.email} next={`/${person.locale ?? locale}/admin`} />
          {/* Or no password at all: a sign-in link by email, or Google/Microsoft. */}
          <details className="text-center">
            <summary className="cursor-pointer text-sm font-medium text-brand">{t("noPassword")}</summary>
            <div className="mt-3 text-left">
              <SignInForm providers={enabledProviders} callbackURL={`/${person.locale ?? locale}/admin`} showStaffHint={false} email={person.email} staff passwords />
            </div>
          </details>
          <p className="text-center text-xs text-muted">{t("useThisEmail", { email: person.email })}</p>
        </div>
      ) : (
        <p className="card p-6 text-center text-muted">{t("expired")}</p>
      )}
    </main>
  );
}
