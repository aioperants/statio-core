import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { pageMember } from "@/lib/access";
import { maskEmail } from "@/lib/recovery";
import { RecoveryEmail, SignOutOthers } from "./account-forms";
import { PushSettings } from "@/components/admin/push-switch";
import { pushReady } from "@/lib/push";

/**
 * Sign-in & security, for everyone on the team: who they're signed in as and "Sign out on all
 * other devices". For the owner also their second email, the way back in if they lose the first.
 */
export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/admin/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.account");
  const tp = await getTranslations("admin.push");
  const me = await pageMember(locale);
  const sp = await searchParams;
  const owner = me.access === "owner";
  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/more`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        {sp.recovered === "1" && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {t("recovered")}</p>}
        <section className="card grid gap-2 p-4">
          <h2 className="font-semibold">{t("signedInAs")}</h2>
          <p className="break-all">{me.user.email}</p>
          <p className="text-sm text-muted">{t(owner ? "ownerEmailHint" : "staffEmailHint")}</p>
        </section>
        {owner && (
          <section className="card grid gap-3 p-4">
            <h2 className="font-semibold">{t("recoveryTitle")}</h2>
            <p className="text-sm text-muted">{t("recoveryHint")}</p>
            <RecoveryEmail locale={locale} current={me.recoveryEmail ? maskEmail(me.recoveryEmail) : null} />
          </section>
        )}
        {pushReady() && (
          <section className="card grid gap-3 p-4">
            <h2 className="font-semibold">{tp("title")}</h2>
            <p className="text-sm text-muted">{tp("hint")}</p>
            <PushSettings publicKey={process.env.VAPID_PUBLIC_KEY!} />
          </section>
        )}
        <section className="card grid gap-3 p-4">
          <h2 className="font-semibold">{t("devicesTitle")}</h2>
          <p className="text-sm text-muted">{t("devicesHint")}</p>
          <SignOutOthers />
        </section>
      </div>
    </div>
  );
}
