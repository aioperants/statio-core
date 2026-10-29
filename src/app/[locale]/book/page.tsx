import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { db, schema } from "@/db";
import { getSession } from "@/lib/access";
import { getBusiness } from "@/lib/booking";
import { categoryName, dayLabel, serviceName } from "@/lib/format";
import { addDays, localToUtc, todayIn, weekdayOf } from "@/lib/time";
import { businessJsonLd, hoursLines, socialLinks } from "@/lib/found-online";
import { onlineStaff } from "@/lib/online-staff";
import { staffFromSlug } from "@/lib/staff-link";
import { bookingSite, publicSite } from "@/lib/site/data";
import { currentSalonId } from "@/db";
import { bookingLookOf } from "@/lib/booking-look";
import { Site, type SiteT } from "@/components/site/site";
import { siteFonts } from "@/components/site/fonts";
import { themeFor } from "@/lib/site/theme";
import { BookingFlow } from "./booking-flow";
import { SalonInfo } from "./salon-info";
import { salonUrl } from "@/lib/salon-url";
import { publicLogo } from "@/lib/public-logo";

export const dynamic = "force-dynamic";

/** Title, description and share preview: what Google shows and how the link looks in WhatsApp or Instagram. */
export async function generateMetadata({ params }: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await params;
  const business = await getBusiness();
  if (!business?.setupDone) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "book" });
  const base = salonUrl();
  const url = `${base}/${business.defaultLocale}/book`;
  const title = t("metaTitle", { salon: business.name });
  const description = business.about || t("metaDescription", { salon: business.name, address: business.address ?? "" }).replace(/ · $/, "");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: business.name, type: "website", images: [{ url: `${base}/api/icon?size=512`, width: 512, height: 512 }] },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookPage({ params, searchParams }: PageProps<"/[locale]/book">) {
  const { locale } = await params;
  const { staff: staffParam, service: serviceParam, look } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("book");
  const business = await getBusiness();

  if (!business?.setupDone) {
    return (
      <main className="mx-auto max-w-lg">
        {business && <BrandHeader name={business.name} logo={await publicLogo(business)} />}
        <p className="p-8 text-center text-muted">{t("closed")}</p>
      </main>
    );
  }

  // A language the salon doesn't offer goes to the same page in its default language.
  // Clients see the salon in its one client language, whatever link brought them here.
  if (locale !== business.defaultLocale) redirect(`/${business.defaultLocale}/book`);

  const [listed, categories, staff, links, session] = await Promise.all([
    db.query.service.findMany({ where: eq(schema.service.active, true), orderBy: [asc(schema.service.sortOrder), asc(schema.service.nameEs)] }),
    db.query.serviceCategory.findMany({ orderBy: asc(schema.serviceCategory.sortOrder) }),
    db.query.staff.findMany({ where: eq(schema.staff.active, true), orderBy: asc(schema.staff.sortOrder) }),
    db.query.staffService.findMany(),
    getSession(),
  ]);
  const opening = await db.query.businessHours.findMany();
  // Category tabs follow the salon's order; services without a category come last.
  const rank = (id: string | null) => (id ? categories.findIndex((c) => c.id === id) : categories.length);
  const services = [...listed].sort((a, b) => rank(a.categoryId) - rank(b.categoryId));
  // Bookable online: people who take bookings and have working hours.
  const { people: bookable, slugs } = await onlineStaff();
  // A professional's own link (?staff=marta) opens with them chosen.
  const startWith = staffFromSlug(bookable, staffParam);
  const today = todayIn(business.timezone);
  // Closed days in the booking window: weekdays without opening hours, and whole closed days/holidays.
  const closures = await db.query.timeOff.findMany({ where: and(isNull(schema.timeOff.staffId), gt(schema.timeOff.endsAt, new Date())) });
  const openWeekdays = new Set(opening.map((o) => o.weekday));
  const days = business.horizonDays;
  const closedDays = Array.from({ length: days }, (_, i) => addDays(today, i)).filter((d) => {
    if (opening.length && !openWeekdays.has(weekdayOf(d))) return true;
    const start = localToUtc(d, 0, business.timezone);
    const end = localToUtc(addDays(d, 1), 0, business.timezone);
    return closures.some((c) => c.startsAt <= start && c.endsAt >= end);
  });
  // An imported client signing in for the first time isn't linked yet: match their (verified) email.
  const client = session
    ? ((await db.query.client.findFirst({ where: eq(schema.client.userId, session.user.id) })) ??
      (session.user.emailVerified
        ? await db.query.client.findFirst({ where: and(isNull(schema.client.userId), sql`lower(${schema.client.email}) = lower(${session.user.email})`) })
        : undefined))
    : null;
  const isNew = !client || (await db.$count(schema.appointment, eq(schema.appointment.clientId, client.id))) === 0;
  // A returning client: their last visit, to book the same again in one tap.
  const last = client
    ? await db.query.appointment.findFirst({
        where: and(eq(schema.appointment.clientId, client.id), eq(schema.appointment.status, "completed")),
        orderBy: (a, { desc }) => desc(a.startsAt),
        with: { lines: true },
      })
    : null;
  const againServices = last ? [...new Set(last.lines.map((l) => l.serviceId))].filter((id) => services.some((s) => s.id === id)) : [];
  const againStaff = last && bookable.some((p) => p.id === last.staffId && againServices.every((id) => links.some((l) => l.staffId === p.id && l.serviceId === id))) ? last.staffId : null;

  // The website's look (fonts, colours, header and ≡ menu), or clean black and white (Settings › Booking page).
  const salonId = await currentSalonId();
  const site = bookingLookOf(look === "site" || look === "clean" ? look : business.bookingLook) === "site" && salonId ? await bookingSite(salonId) : null;
  const siteLive = site?.live ?? (salonId ? Boolean((await publicSite(salonId))?.enabled) : false);
  const flow = (
    <>
      {/* The business as search engines and maps read it: the same details this page shows. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            businessJsonLd({
              business,
              hours: opening,
              services: services.filter((s) => s.priceCents > 0).map((s) => ({ name: serviceName(s, locale, business.defaultLocale), priceCents: s.priceCents })),
              bookingUrl: `${salonUrl()}/${business.defaultLocale}/book`,
              image: `${salonUrl()}/api/icon?size=512`,
            }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <BookingFlow
        locale={locale}
        salon={business.name}
        currency={business.currency}
        today={todayIn(business.timezone)}
        horizonDays={days}
        cancellationHours={business.cancellationHours}
        country={business.country}
        address={business.address}
        closedDays={closedDays}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || null}
        services={services.map((s) => ({
          id: s.id,
          name: serviceName(s, locale, business.defaultLocale),
          category: categoryName(s, locale, business.defaultLocale),
          durationMin: s.durationMin,
          priceCents: s.priceCents,
          needsConsent: s.needsConsent,
        }))}
        staff={bookable.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          photo: p.photo,
          title: p.title,
          jobTitle: p.jobTitle,
          slug: slugs.get(p.id)!,
          serviceIds: links.filter((l) => l.staffId === p.id).map((l) => l.serviceId),
          // Their own duration where it differs from the service's.
          durations: Object.fromEntries(links.filter((l) => l.staffId === p.id && l.durationMin).map((l) => [l.serviceId, l.durationMin!])),
        }))}
        user={session ? { email: session.user.email, name: client?.name ?? session.user.name, phone: client?.phone ?? "" } : null}
        recommend={business.slotMode === "recommend"}
        startWith={startWith?.id ?? null}
        startService={typeof serviceParam === "string" && services.some((s) => s.id === serviceParam) ? serviceParam : null}
        again={againServices.length ? { serviceIds: againServices, staffId: againStaff } : null}
        questions={
          isNew && (business.askHeardFrom || business.askCity)
            ? {
                heard: business.askHeardFrom && !client?.heardFrom ? business.heardOptions : null,
                city: business.askCity && !client?.city,
              }
            : null
        }
      />
      <SalonInfo business={business} hours={hoursLines(opening, locale)} links={socialLinks(business)} label={{ hours: t("info.hours"), call: t("info.call") }} />
    </>
  );
  if (site) {
    const ts = (await getTranslations({ locale: site.data.locale, namespace: "site" })) as unknown as SiteT;
    const theme = themeFor(site.config.direction, site.data.brandColor, site.config.palette);
    return (
      <>
        <style>{`html,body{background:${theme.bg}}`}</style>
        <Site config={site.config} data={site.data} t={ts} fontClass={siteFonts} page="book" live={site.live}>
          <div className="site-book mx-auto max-w-lg pb-28">
            <div className="px-4 pt-8 pb-2 text-center">
              <h1 className="s-h text-3xl">{t("title")}</h1>
              {business.address && <p className="s-muted mt-1 text-sm">{business.address}</p>}
            </div>
            {flow}
          </div>
        </Site>
      </>
    );
  }
  return (
    <main className="mx-auto max-w-lg pb-28">
      {/* Clean look: back to the salon's website when it's live. */}
      {siteLive && (
        <a href={`/${locale}`} className="block px-4 pt-4 text-sm font-medium text-muted">
          ← {business.name}
        </a>
      )}
      <BrandHeader name={business.name} logo={await publicLogo(business)} address={business.address} />
      {flow}
    </main>
  );
}
