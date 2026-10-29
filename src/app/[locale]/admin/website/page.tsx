import { getTranslations, setRequestLocale } from "next-intl/server";
import { siteFonts } from "@/components/site/fonts";
import { languageName } from "@/i18n/languages";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { salonUrl } from "@/lib/salon-url";
import { readConfig } from "@/lib/site/config";
import { siteFacts } from "@/lib/site/content";
import { draftSite, websiteRow } from "@/lib/site/data";
import type { Drafts } from "./parts";
import { Studio } from "./studio";

/**
 * Settings › Website: the website editor, full screen (studio.tsx).
 */
export default async function WebsitePage({ params, searchParams }: PageProps<"/[locale]/admin/website">) {
  const { locale } = await params;
  const { picture, part } = await searchParams;
  setRequestLocale(locale);
  const { me, denied } = await managerOnly(locale);
  if (denied) return denied;
  const b = await requireBusiness();
  const [row, site] = await Promise.all([websiteRow(), draftSite()]);
  if (!site) return null;
  // Ready-made texts in the website's language, not the owner's.
  const td = await getTranslations({ locale: b.defaultLocale, namespace: "siteDrafts" });
  const preset = site.config.preset;
  const facts = { hours: b.cancellationHours };
  const drafts: Drafts = {
    kind: td(`kind.${preset}`),
    aboutTown: td.raw("about.town") as string,
    aboutNoTown: td.raw("about.noTown") as string,
    aboutSince: td.raw("about.since") as string,
    aboutKnown: td.raw("about.known") as string,
    aboutLove: td.raw("about.love") as string,
    aboutEnd: td("about.end"),
    questions: [
      { q: td("faq.book.q"), a: td("faq.book.a") },
      { q: td("faq.cancel.q"), a: td("faq.cancel.a", facts) },
      ...(td.raw(`faq.${preset}`) as { q: string }[]).map((x) => ({ q: x.q, a: "" })),
      { q: td("faq.pay.q"), a: "" },
      { q: td("faq.parking.q"), a: "" },
      { q: td("faq.gift.q"), a: "" },
    ],
  };
  return (
    <div className={siteFonts}>
      <Studio
        locale={locale}
        initial={row.config}
        published={row.published ? readConfig(row.published) : null}
        heroPending={row.heroDraft !== row.heroPublished}
        enabled={row.enabled}
        facts={siteFacts(site.data)}
        hero={row.heroDraft}
        logo={b.logo}
        brandColor={b.brandColor}
        address={salonUrl().replace(/^https?:\/\//, "")}
        siteHref={`/${b.defaultLocale}`}
        salonLanguage={languageName(b.defaultLocale)}
        salonName={b.name}
        salonTown={b.addressTown ?? ""}
        people={site.data.team.map((m) => ({ id: m.id!, name: m.name }))}
        team={site.data.team.map((m) => ({ id: m.id!, name: m.name, photo: Boolean(m.photo) }))}
        services={site.data.services.flatMap((g) => g.items).map((x) => ({ id: x.id!, name: x.name }))}
        picture={picture === "cover" || picture === "logo" || picture === "icon" ? picture : undefined}
        part={part === "about" ? "about" : undefined}
        drafts={drafts}
      />
    </div>
  );
}
