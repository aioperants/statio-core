import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { dayLabel, serviceName } from "@/lib/format";
import { businessJsonLd, FOUND_LINKS, FOUND_PARTS, FOUND_STEPS, hoursLines, socialLinks } from "@/lib/found-online";
import { toggleFoundStep } from "../../_actions/settings";
import { CopyLink } from "../../salon/copy-link";
import { salonUrl } from "@/lib/salon-url";

/**
 * "Get found online": what the owner sets up on Google, Bing, Apple and their own website, one
 * step at a time, with the exact details to copy so they match everywhere. The owner ticks each
 * step; we can't see into their accounts.
 */
export default async function FoundOnlinePage({ params, searchParams }: PageProps<"/[locale]/admin/settings/found">) {
  const { locale } = await params;
  // Settings lists Google and the other search engines apart; each opens only its own steps.
  const sp = await searchParams;
  const part = sp.part === "google" || sp.part === "other" ? sp.part : null;
  const steps = part ? FOUND_STEPS.filter((s) => FOUND_PARTS[s] === part) : FOUND_STEPS;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.found");
  const ts = await getTranslations("admin.settings.items");
  const b = await requireBusiness();
  const [hours, services] = await Promise.all([
    db.query.businessHours.findMany(),
    db.query.service.findMany({ where: eq(schema.service.active, true), orderBy: asc(schema.service.sortOrder) }),
  ]);
  const base = salonUrl();
  const booking = `${base}/${b.defaultLocale}/book`;
  const lines = hoursLines(hours, b.defaultLocale);
  const profiles = socialLinks(b);
  // Our own website (Settings › Your website) already does the "Your website" step for them.
  const site = await db.query.website.findFirst({ columns: { enabled: true, published: true } });
  const ours = !!site?.enabled && !!site.published;
  const ourUrl = `${base}/${b.defaultLocale}`;
  const auto = (step: string) => ours && step === "website";
  const done = steps.filter((s) => b.foundChecklist[s] || auto(s)).length;
  const details = `/${locale}/admin/salon#online`;
  // The same business details code for their own website (the booking page carries it already).
  const code = `<script type="application/ld+json">\n${JSON.stringify(
    businessJsonLd({
      business: b,
      hours,
      services: services.filter((s) => s.priceCents > 0).map((s) => ({ name: serviceName(s, b.defaultLocale), priceCents: s.priceCents })),
      bookingUrl: booking,
      image: `${base}/api/icon?size=512`,
    }),
    null,
    2,
  )}\n</script>`;

  // The details to paste everywhere; a missing one points to where it's filled in.
  const facts: { key: string; value: string | null; href: string }[] = [
    { key: "name", value: b.name, href: `/${locale}/admin/salon` },
    { key: "address", value: b.address, href: `/${locale}/admin/salon` },
    { key: "phone", value: b.phone, href: `/${locale}/admin/salon` },
    { key: "website", value: ours ? ourUrl : b.website, href: details },
    { key: "booking", value: booking, href: details },
    { key: "hours", value: lines.length ? lines.map((l) => `${l.days} ${l.hours}`).join(" · ") : null, href: `/${locale}/admin/settings/hours` },
    { key: "about", value: b.about, href: details },
  ];

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#found`} title={part ? ts(part === "google" ? "google" : "otherEngines") : t("title")} back={`/${locale}/admin/settings`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <div className="card grid gap-2 p-4">
          <p className="text-sm">{t("intro")}</p>
          <div className="flex items-center gap-3">
            <span className="block h-2 flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full bg-emerald-500" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
            </span>
            <span className="text-sm font-medium">{t("progress", { done, total: steps.length })}</span>
          </div>
          <p className="text-xs text-muted">{t("noPromise")}</p>
        </div>

        <section className="card grid min-w-0 gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("same.title")}</h2>
            <p className="text-sm text-muted">{t("same.hint")}</p>
          </div>
          {facts.map((f) => (
            <div key={f.key} className="grid min-w-0 gap-1">
              <span className="text-xs text-muted">{t(`same.${f.key}`)}</span>
              {f.value ? (
                <CopyLink value={f.value} />
              ) : f.key === "website" ? (
                <Link href={f.href} className="rounded-xl bg-canvas p-2.5 text-sm text-muted">
                  {t("same.noWebsite")}
                </Link>
              ) : (
                <Link href={f.href} className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900">
                  + {t("same.missing")}
                </Link>
              )}
            </div>
          ))}
          {profiles.length > 0 && (
            <p className="text-xs text-muted">
              {t("same.profiles")}: {profiles.map((p) => p.label).join(" · ")}
            </p>
          )}
        </section>

        {steps.map((step, i) => {
          const ticked = b.foundChecklist[step];
          if (auto(step)) {
            return (
              <section key={step} id={step} className="card grid min-w-0 scroll-mt-20 gap-3 border-emerald-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">✓</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{t(`steps.${step}.title`)}</h2>
                    <p className="text-sm text-emerald-800">{t("websiteDone")}</p>
                  </div>
                </div>
                <ul className="grid list-disc gap-1 pl-5 text-sm text-muted">
                  {(t.raw("websiteDoneList") as string[]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Link href={`/${locale}/admin/website`} className="justify-self-start text-sm font-medium text-brand">
                  {t("websiteOpen")} ›
                </Link>
              </section>
            );
          }
          return (
            <section key={step} id={step} className={`card grid min-w-0 scroll-mt-20 gap-3 p-4 ${ticked ? "border-emerald-200" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${ticked ? "bg-emerald-500 text-white" : "bg-canvas"}`}>
                  {ticked ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{t(`steps.${step}.title`)}</h2>
                  <p className="text-sm text-muted">{t(`steps.${step}.why`)}</p>
                </div>
              </div>
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {(t.raw(`steps.${step}.todo`) as string[]).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {step === "website" && (
                <details className="min-w-0 rounded-xl bg-canvas p-3 text-sm">
                  <summary className="cursor-pointer font-medium">{t("code.title")}</summary>
                  <p className="mt-2 text-muted">{t("code.hint")}</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-2 text-xs select-all">{code}</pre>
                  <Link href={`/${locale}/admin/salon#embed`} className="mt-2 inline-block font-medium text-brand">
                    {t("code.widget")} ›
                  </Link>
                </details>
              )}
              {step === "website" && !b.website && (
                <Link href={`/${locale}/admin/website`} className="rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">
                  {t("needWebsite")} ›
                </Link>
              )}
              {step === "social" && !profiles.length && <p className="rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900">{t("needProfiles")}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {FOUND_LINKS[step]?.map((l) => (
                  <a key={l.key} href={l.url} target="_blank" rel="noreferrer" className="btn-ghost min-h-9 px-3 text-sm">
                    {t(`links.${l.key}`)} ↗
                  </a>
                ))}
                <form action={toggleFoundStep.bind(null, step)} className="ml-auto">
                  <button className={`min-h-9 rounded-full border px-3 text-sm font-medium ${ticked ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line"}`}>
                    {ticked ? `✓ ${t("doneOn", { day: dayLabel(ticked, locale, "short") })}` : t("markDone")}
                  </button>
                </form>
              </div>
            </section>
          );
        })}
        {part && (
          <Link href={`/${locale}/admin/settings/found?part=${part === "google" ? "other" : "google"}`} className="card flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1 font-medium">{ts(part === "google" ? "otherEngines" : "google")}</span>
            <span className="text-muted">›</span>
          </Link>
        )}
      </div>
    </div>
  );
}
