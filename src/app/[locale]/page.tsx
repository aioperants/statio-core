import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect as redirectTo } from "next/navigation";
import { Site, type SiteT } from "@/components/site/site";
import { siteFonts } from "@/components/site/fonts";
import { currentSalonId } from "@/db";
import { redirect } from "@/i18n/navigation";
import { businessJsonLd } from "@/lib/found-online";
import { getBusiness } from "@/lib/booking";
import { publicSite } from "@/lib/site/data";
import { themeFor } from "@/lib/site/theme";
import { salonUrl } from "@/lib/salon-url";

export const dynamic = "force-dynamic";

/** The salon's website when it's switched on (Settings › Your website), else null. */
async function liveSite() {
  const id = await currentSalonId();
  const site = id ? await publicSite(id) : null;
  return site?.setupDone && site.enabled && site.config ? { ...site, config: site.config } : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await liveSite();
  if (!site) return {};
  const { data, config, business } = site;
  const base = salonUrl();
  const url = `${base}/${data.locale}`;
  const t = await getTranslations({ locale: data.locale, namespace: "book" });
  const title = config.tagline ? `${data.name} · ${config.tagline}` : data.name;
  const description = config.tagline || business.about || t("metaDescription", { salon: data.name, address: config.mobile ? config.serviceArea : (data.address ?? "") }).replace(/ · $/, "");
  const image = data.heroImage ? { url: `${base}${data.heroImage}` } : { url: `${base}/api/icon?size=512`, width: 512, height: 512 };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: data.name, type: "website", images: [image] },
    twitter: { card: data.heroImage ? "summary_large_image" : "summary", title, description },
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const site = await liveSite();
  // Website off: the address opens the booking page.
  if (!site) redirect({ href: "/book", locale });
  const { data, config, business, opening } = site!;
  // Clients see the salon in its one client language, whatever link brought them here.
  if (locale !== data.locale) redirectTo(`/${data.locale}`);
  const t = (await getTranslations({ locale: data.locale, namespace: "site" })) as unknown as SiteT;
  const base = salonUrl();
  const theme = themeFor(config.direction, data.brandColor, config.palette);
  const jsonLd = businessJsonLd({
    // "We come to you": the area served instead of an address.
    business: { ...business, name: data.name, website: business.website ?? `${base}/${data.locale}`, ...(config.mobile && { address: null }) },
    hours: opening,
    services: data.services.flatMap((g) => g.items).filter((s) => s.priceCents > 0).map((s) => ({ name: s.name, priceCents: s.priceCents })),
    bookingUrl: `${base}${data.bookUrl}`,
    image: data.heroImage ? `${base}${data.heroImage}` : `${base}/api/icon?size=512`,
  });
  if (config.mobile && config.serviceArea) Object.assign(jsonLd, { areaServed: config.serviceArea });
  return (
    <>
      {/* The page colour behind the website, also when a phone scrolls past the edge. */}
      <style>{`html,body{background:${theme.bg}}`}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Site config={config} data={data} t={t} fontClass={siteFonts} />
    </>
  );
}
