import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { Site, type SiteT } from "@/components/site/site";
import { siteFonts } from "@/components/site/fonts";
import { currentSalonId, db, schema } from "@/db";
import { getBusiness } from "@/lib/booking";
import { bookingLookOf } from "@/lib/booking-look";
import { hoursLines, socialLinks } from "@/lib/found-online";
import { waLink } from "@/lib/notify";
import { publicLogo } from "@/lib/public-logo";
import { bookingSite } from "@/lib/site/data";
import { themeFor } from "@/lib/site/theme";
import { SalonInfo } from "../book/salon-info";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBusiness();
  if (!b) return {};
  const t = await getTranslations({ locale: b.defaultLocale, namespace: "contactCard" });
  return { title: { absolute: b.name }, description: t("meta", { salon: b.name }), robots: { index: false, follow: true } };
}

/**
 * Where the salon's printed QR code leads (posters, stickers, cards): save the salon in the phone's
 * contacts in one tap, book a visit, call or write. In the salon's look, like its booking page.
 */
export default async function ContactCardPage({ params }: PageProps<"/[locale]/c">) {
  const { locale } = await params;
  const b = await getBusiness();
  if (!b?.setupDone) notFound();
  if (locale !== b.defaultLocale) redirect(`/${b.defaultLocale}/c`);
  const t = await getTranslations({ locale, namespace: "contactCard" });
  const tb = await getTranslations({ locale, namespace: "book" });
  const opening = await db.query.businessHours.findMany({ orderBy: asc(schema.businessHours.weekday) });
  const wa = waLink(b.phone, "");
  const buttons = (primary: string, ghost: string) => (
    <div className="grid gap-3">
      <a href="/api/contact" className={primary}>
        {t("save")}
      </a>
      <a href={`/${locale}/book`} className={ghost}>
        {t("book")}
      </a>
      {(b.phone || wa) && (
        <div className="grid grid-cols-2 gap-3">
          {b.phone && (
            <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className={ghost}>
              {t("call")}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={ghost}>
              WhatsApp
            </a>
          )}
        </div>
      )}
      <p className="text-center text-sm opacity-70">{t("hint")}</p>
    </div>
  );
  const info = <SalonInfo business={b} hours={hoursLines(opening, locale)} links={socialLinks(b)} label={{ hours: tb("info.hours"), call: tb("info.call") }} />;

  const salonId = await currentSalonId();
  const site = bookingLookOf(b.bookingLook) === "site" && salonId ? await bookingSite(salonId) : null;
  if (site) {
    const ts = (await getTranslations({ locale: site.data.locale, namespace: "site" })) as unknown as SiteT;
    const theme = themeFor(site.config.direction, site.data.brandColor, site.config.palette);
    return (
      <>
        <style>{`html,body{background:${theme.bg}}`}</style>
        <Site config={site.config} data={site.data} t={ts} fontClass={siteFonts} page="book" live={site.live}>
          <div className="site-book mx-auto grid max-w-md gap-6 px-4 py-10">
            <div className="text-center">
              <h1 className="s-h text-3xl">{b.name}</h1>
              {b.address && <p className="s-muted mt-1 text-sm">{b.address}</p>}
            </div>
            {buttons("s-btn w-full", "s-btn-ghost w-full")}
            {info}
          </div>
        </Site>
      </>
    );
  }
  return (
    <main className="mx-auto grid max-w-md gap-6 pb-12">
      <BrandHeader name={b.name} logo={await publicLogo(b)} address={b.address} />
      <div className="px-4">{buttons("btn-primary w-full", "btn-ghost w-full")}</div>
      {info}
    </main>
  );
}
