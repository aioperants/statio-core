import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { managerOnly } from "@/lib/admin-guard";

const HOSTED_URL = "https://statiocrm.com";
const SUPPORT_EMAIL = "hello@statiocrm.com";

/**
 * Moving to hosted Statio: what it adds, and three steps (download everything, create an account,
 * send us the file). The way back works the same, so nobody is locked in either way.
 */
export default async function MovePage({ params }: PageProps<"/[locale]/admin/move">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { me, denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.move");
  const owner = me?.access === "owner";
  const step = (n: number, title: string, hint: string, action?: React.ReactNode) => (
    <li className="flex items-start gap-3 p-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-sm font-semibold">{n}</span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted">{hint}</span>
        {action}
      </span>
    </li>
  );
  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/more`} hint={t("intro")} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-4 p-4 md:px-8 lg:grid-cols-2">
        <section className="card grid gap-3 p-4">
          <h2 className="font-semibold">{t("adds")}</h2>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm">
            {(t.raw("addsList") as string[]).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <Link href={`/${locale}/admin/help#hosted`} className="text-sm font-medium text-brand">
            {t("more")} ›
          </Link>
        </section>
        <section className="grid gap-2">
          <h2 className="px-1 font-semibold">{t("how")}</h2>
          <ol className="card divide-y divide-line">
            {step(
              1,
              t("step1"),
              t(owner ? "step1Hint" : "step1Owner"),
              owner && (
                <a href="/api/export/all" download className="btn-ghost mt-1 min-h-9 justify-self-start px-4 py-1.5 text-sm">
                  ↓ {t("download")}
                </a>
              ),
            )}
            {step(
              2,
              t("step2"),
              t("step2Hint"),
              <a href={HOSTED_URL} target="_blank" rel="noopener" className="btn-primary mt-1 min-h-9 justify-self-start px-4 py-1.5 text-sm">
                {t("signUp")} ↗
              </a>,
            )}
            {step(
              3,
              t("step3"),
              t("step3Hint", { email: SUPPORT_EMAIL }),
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("subject"))}`} className="btn-ghost mt-1 min-h-9 justify-self-start px-4 py-1.5 text-sm">
                ✉︎ {SUPPORT_EMAIL}
              </a>,
            )}
          </ol>
          <p className="px-1 text-sm text-muted">{t("back")}</p>
        </section>
      </div>
    </div>
  );
}
