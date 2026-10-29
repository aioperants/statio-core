import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import { currentSalonId, db, schema } from "@/db";
import { messagesFor } from "@/i18n/messages";
import { categoryName, dayLabel, serviceName } from "@/lib/format";
import { hoursLines, socialLinks } from "@/lib/found-online";
import { onlineStaff } from "@/lib/online-staff";
import { formatPhone } from "@/lib/phone";
import { textIn } from "@/lib/texts";
import { addDays, localToUtc, todayIn } from "@/lib/time";
import { defaultConfig, presetFor, readConfig, type SiteConfig } from "./config";
import type { SiteData } from "./types";

/** How long a cached website may be at most, even if nothing told it to refresh (days pass). */
const MAX_AGE = 300;
const tag = (salonId: string) => `site:${salonId}`;

/**
 * Something clients see changed (prices, hours, team, details, the website itself): the
 * salon's website is rebuilt on its next visit. Call from server actions after the change.
 */
export async function siteChanged(salonId?: string | null) {
  const id = salonId ?? (await currentSalonId());
  if (id) revalidateTag(tag(id), { expire: 0 });
}

/** A short fingerprint of a picture, so its address changes when the picture does. */
const photoVersion = (dataUrl: string) => createHash("sha256").update(dataUrl).digest("hex").slice(0, 12);
/** A picture as a file address (api/site/photo) rather than text inside the page. */
export const photoUrl = (key: string, dataUrl: string) => `/api/site/photo?k=${key}&v=${photoVersion(dataUrl)}`;

/** The live data the website shows. */
async function readSiteData(): Promise<{ data: SiteData; opening: { weekday: number; startMin: number; endMin: number }[] } | null> {
  const id = await currentSalonId();
  const b = id ? await db.query.business.findFirst({ where: eq(schema.business.id, id) }) : null;
  if (!b) return null;
  const locale = b.defaultLocale;
  const common = (messagesFor(locale).common ?? {}) as Record<string, string>;
  const today = todayIn(b.timezone);

  const [listed, categories, links, opening, closures, { people, slugs }] = await Promise.all([
    db.query.service.findMany({ where: eq(schema.service.active, true), orderBy: [asc(schema.service.sortOrder), asc(schema.service.nameEs)] }),
    db.query.serviceCategory.findMany({ orderBy: asc(schema.serviceCategory.sortOrder) }),
    db.query.staffService.findMany(),
    db.query.businessHours.findMany(),
    db.query.timeOff.findMany({ where: and(isNull(schema.timeOff.staffId), gt(schema.timeOff.endsAt, new Date())), orderBy: asc(schema.timeOff.startsAt) }),
    onlineStaff(),
  ]);

  // Services by group, in the salon's group order; services without a group last.
  const rank = (cid: string | null) => (cid ? categories.findIndex((c) => c.id === cid) : categories.length);
  const services = [...listed].sort((a, b) => rank(a.categoryId) - rank(b.categoryId));
  const groups: SiteData["services"] = [];
  for (const s of services) {
    const group = categoryName(s, locale, locale) || null;
    // A professional with their own lower price makes it a "from" price.
    const own = links.filter((l) => l.serviceId === s.id && l.priceCents != null).map((l) => l.priceCents!);
    const lowest = Math.min(s.priceCents, ...own);
    const item = { id: s.id, name: serviceName(s, locale, locale), description: textIn(s.descriptions, locale, locale) || null, durationMin: s.durationMin, priceCents: lowest, from: own.some((p) => p !== lowest) || lowest < s.priceCents };
    const last = groups[groups.length - 1];
    if (last && last.name === group) last.items.push(item);
    else groups.push({ name: group, items: [item] });
  }

  // Whole days closed in the next two months (holidays, closures), merged into ranges.
  const horizon = addDays(today, 60);
  const closed = closures
    .filter((c) => c.startsAt < localToUtc(horizon, 0, b.timezone))
    .map((c) => {
      const from = todayIn(b.timezone, c.startsAt);
      const lastDay = todayIn(b.timezone, new Date(c.endsAt.getTime() - 1));
      const whole = c.startsAt.getTime() <= localToUtc(from, 0, b.timezone).getTime() && c.endsAt.getTime() >= localToUtc(addDays(lastDay, 1), 0, b.timezone).getTime();
      return whole ? { when: from === lastDay ? dayLabel(from, locale, "short") : `${dayLabel(from, locale, "short")} – ${dayLabel(lastDay, locale, "short")}`, reason: c.reason?.trim() || null } : null;
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, 6);

  const data: SiteData = {
    locale,
    currency: b.currency,
    name: b.name,
    brandColor: b.brandColor,
    logo: b.logo ? photoUrl("logo", b.logo) : null,
    shortAbout: b.about?.trim() || null,
    address: b.address,
    mapsUrl: b.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name}, ${b.address}`)}` : null,
    phone: b.phone?.startsWith("+") ? b.phone : null,
    phoneDisplay: formatPhone(b.phone),
    email: b.email,
    links: socialLinks({ ...b, website: null }).map(({ label, url }) => ({ label, url })),
    bookUrl: `/${locale}/book`,
    services: groups,
    team: people.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title || p.jobTitle || null,
      photo: p.photo ? photoUrl(p.id, p.photo) : null,
      color: p.color,
      bookUrl: `/${locale}/book?staff=${slugs.get(p.id)}`,
    })),
    hours: hoursLines(opening, locale),
    closures: closed,
    heroImage: null,
  };
  return { data, opening: opening.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })) };
}


export type WebsiteRow = typeof schema.website.$inferSelect;

/** The salon's website settings, or a fresh draft from its business type when it has none yet. */
export async function websiteRow(): Promise<WebsiteRow & { config: SiteConfig }> {
  const row = await db.query.website.findFirst();
  if (row) return { ...row, config: readConfig(row.draft) };
  const b = await db.query.business.findFirst();
  const people = (await onlineStaff()).people.length;
  const config = defaultConfig(presetFor(b?.businessTypes ?? []), people === 1);
  return { businessId: b?.id ?? "", enabled: false, draft: config, published: null, heroDraft: null, heroPublished: null, publishedAt: null, updatedAt: new Date(), config };
}

export type PublicSite = {
  setupDone: boolean;
  enabled: boolean;
  config: SiteConfig | null;
  data: SiteData;
  opening: { weekday: number; startMin: number; endMin: number }[];
  business: { about: string | null; phone: string | null; email: string | null; address: string | null; addressStreet: string | null; addressPostcode: string | null; addressTown: string | null; addressTownOnly: boolean; country: string | null; currency: string; businessTypes: string[]; website: string | null; instagram: string | null; facebook: string | null; tiktok: string | null; otherLinks: { label: string; url: string }[] };
};

/** What clients see at the salon's address, cached per salon until something on it changes. */
export function publicSite(salonId: string): Promise<PublicSite | null> {
  return unstable_cache(
    () =>
      (async () => {
        const read = await readSiteData();
        const b = await db.query.business.findFirst();
        if (!read || !b) return null;
        const row = await db.query.website.findFirst({ columns: { enabled: true, published: true, heroPublished: true } });
        const published = row?.published ? readConfig(row.published) : null;
        const config = published;
        read.data.heroImage = row?.heroPublished ? photoUrl("hero", row.heroPublished) : null;
        return {
          setupDone: b.setupDone,
          enabled: !!row?.enabled && !!config,
          config,
          data: read.data,
          opening: read.opening,
          business: {
            about: b.about, phone: b.phone, email: b.email, address: b.address, currency: b.currency,
            addressStreet: b.addressStreet, addressPostcode: b.addressPostcode, addressTown: b.addressTown, addressTownOnly: b.addressTownOnly, country: b.country,
            businessTypes: b.businessTypes, website: b.website, instagram: b.instagram, facebook: b.facebook, tiktok: b.tiktok, otherLinks: b.otherLinks,
          },
        };
      })(),
    ["public-site", salonId],
    { tags: [tag(salonId)], revalidate: MAX_AGE },
  )();
}

/** The draft as the owner previews it: live data, the draft's photo. Never cached. */
export async function draftSite() {
  const read = await readSiteData();
  if (!read) return null;
  const b = await db.query.business.findFirst();
  const row = await websiteRow();
  read.data.heroImage = row.heroDraft;
  // The owner's draft in the Minimalist look and Snow colours, as clients will see it.
  return { ...read, config: row.config };
}

/**
 * The booking page in the website's look: the published design when the website is live (with its
 * menu), else the design the owner has picked so far (no menu: there's no website to go back to).
 */
export async function bookingSite(salonId: string) {
  const site = await publicSite(salonId);
  if (!site) return null;
  const live = site.setupDone && site.enabled && !!site.config;
  if (live) return { data: site.data, config: site.config!, live };
  const row = await websiteRow();
  return { data: site.data, config: row.config, live };
}
