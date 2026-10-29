import { count, eq, gte, and } from "drizzle-orm";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageRedirect } from "@/components/admin/language-redirect";
import { ADMIN_LOCALE } from "@/i18n/languages";
import { AdminShell } from "@/components/admin/shell";
import { SignOutButton } from "@/components/admin/sign-out";
import { db, schema } from "@/db";
import { staffForPage } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { permissionsOf } from "@/lib/permissions";
import { readiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/** The admin's own words for its screens; public pages get only theirs (see [locale]/layout.tsx). */
export default async function AdminLayout(props: LayoutProps<"/[locale]/admin">) {
  return <NextIntlClientProvider messages={await getMessages()}>{await AdminFrame(props)}</NextIntlClientProvider>;
}

async function AdminFrame({ children, params }: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await staffForPage(locale);
  if (!me) {
    const t = await getTranslations("common");
    return (
      <main className="mx-auto grid grid-cols-1 max-w-sm gap-4 p-8 text-center">
        <p>{t("notAllowed")}</p>
        <SignOutButton locale={locale} />
      </main>
    );
  }
  // Statio Core's admin is in English (ADMIN_LOCALE); only what clients see comes in other languages.
  if (locale !== ADMIN_LOCALE) return <LanguageRedirect to={ADMIN_LOCALE} />;
  const business = await requireBusiness();
  const [{ waiting }] = await db
    .select({ waiting: count() })
    .from(schema.appointment)
    .where(and(eq(schema.appointment.status, "pending"), gte(schema.appointment.startsAt, new Date())));
  // New salons: what's left to set up, for the owner (side menu / Today).
  const ready = me.role === "owner" && business.setupDone ? await readiness(business) : null;
  const setup = ready && ready.percent < 100 ? { percent: ready.percent, items: ready.items } : null;
  return (
    <AdminShell
      setup={setup}
      locale={locale}
      salon={{ name: business.name, logo: business.logo }}
      me={{ name: me.name }}
      perms={permissionsOf(me)}
      requests={waiting}
    >
      {children}
    </AdminShell>
  );
}
