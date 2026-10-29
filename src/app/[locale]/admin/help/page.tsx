import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { pageMember } from "@/lib/access";

/** The topics, in the order an owner meets them. Each screen's "?" links to one. */
const HELP_TOPICS = ["start", "install", "website", "booking", "times", "rules", "hours", "clients", "dueBack", "guests", "colour", "staff", "found"] as const;

/** What hosted Statio adds: listed once at the end, so owners know it exists. */
const HOSTED_TOPICS = ["todo", "offers", "reviews", "money", "shop", "print", "assistant"] as const;
const HOSTED_URL = "https://statiocrm.com";

/**
 * The owner's guide: short, plain-language help for the parts with rules behind them. Each topic
 * says what it does, how it works and where to change it.
 */
export default async function HelpPage({ params }: PageProps<"/[locale]/admin/help">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await pageMember(locale);
  const t = await getTranslations("help");
  return (
    <div>
      <PageHeader
        title={t("title")}
        back={`/${locale}/admin/more`}
      />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <p className="text-sm text-muted">{t("intro")}</p>
        <nav className="card flex flex-wrap gap-2 p-3">
          {HELP_TOPICS.map((k) => (
            <a key={k} href={`#${k}`} className="chip border border-line bg-white py-1.5">
              {t(`topics.${k}.title`)}
            </a>
          ))}
          <a href="#hosted" className="chip border border-line bg-white py-1.5 text-muted">
            {t("hosted.title")}
          </a>
        </nav>
        {HELP_TOPICS.map((k) => (
          <section key={k} id={k} className="card grid scroll-mt-20 gap-2 p-4">
            <h2 className="font-semibold">{t(`topics.${k}.title`)}</h2>
            <ul className="grid list-disc gap-1.5 pl-5 text-sm">
              {(t.raw(`topics.${k}.points`) as string[]).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {/* Running your own copy: the full guide lives with the code. */}
            {t.has(`topics.${k}.link`) && (
              <a href={t(`topics.${k}.link` as "topics.install.link")} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand">
                {t("guide")} ↗
              </a>
            )}
            {t.has(`topics.${k}.where`) && (
              <Link href={`/${locale}/admin${t(`topics.${k}.where` as "topics.start.where")}`} className="text-sm font-medium text-brand">
                {t("open")} ›
              </Link>
            )}
          </section>
        ))}
        <section id="hosted" className="grid scroll-mt-20 gap-4 pt-4">
          <div className="grid gap-1 px-1">
            <h2 className="text-lg font-semibold">{t("hosted.title")}</h2>
            <p className="text-sm text-muted">{t("hosted.intro")}</p>
          </div>
          {HOSTED_TOPICS.map((k) => (
            <section key={k} id={k} className="card grid scroll-mt-20 gap-2 p-4">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 font-semibold">{t(`topics.${k}.title`)}</h3>
                <span className="rounded-full border border-line px-2 text-[11px] leading-5 font-semibold tracking-wide text-muted uppercase">{t("hosted.tag")}</span>
              </div>
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted">
                {(t.raw(`topics.${k}.points`) as string[]).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-wrap gap-2">
            <Link href={`/${locale}/admin/move`} className="btn-primary min-h-10 px-5 py-2 text-sm">
              {t("hosted.move")}
            </Link>
            <a href={HOSTED_URL} target="_blank" rel="noreferrer" className="btn-ghost min-h-10 px-5 py-2 text-sm">
              {t("hosted.cta")} ↗
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
