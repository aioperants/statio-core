import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { envMailConfig } from "@/lib/email";
import { MailForm } from "./mail-form";

export default async function EmailPage({ params, searchParams }: PageProps<"/[locale]/admin/email">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.mail");
  const tc = await getTranslations("common");
  const saved = (await searchParams).saved;
  const row = await db.query.mailSettings.findFirst();
  const env = envMailConfig().provider;

  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/rules?more=1`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        {saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <p className="text-sm text-muted">{t("hint")}</p>
        <MailForm
          locale={locale}
          env={env === "log" ? null : env}
          saved={
            row
              ? {
              provider: row.provider as "none" | "resend" | "smtp",
              from: row.fromAddress ?? "",
              hasResendKey: !!row.resendKeyEnc,
              smtpHost: row.smtpHost ?? "",
              smtpPort: row.smtpPort ?? 587,
              smtpUser: row.smtpUser ?? "",
              hasSmtpPass: !!row.smtpPassEnc,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
