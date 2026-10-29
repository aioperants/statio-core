import { hhmm } from "./format";

/**
 * Being found online: the salon's profiles elsewhere, the business details search engines and
 * maps read (schema.org), and the "Get found online" checklist.
 */

export const PROFILES = ["instagram", "facebook", "tiktok"] as const;
export type Profile = (typeof PROFILES)[number];

const PROFILE_BASE: Record<Profile, string> = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/@",
};

/** A web address as typed ("salon.es", "https://…") → a full https link, or null if it isn't one. */
export function webUrl(value: unknown): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") && v.length <= 300 ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "@salonaurora", "salonaurora" or a full link → the profile's full link. */
export function profileUrl(kind: Profile, value: unknown): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  // A link has "http" or a slash ("instagram.com/x"); handles may contain dots ("salon.aurora").
  if (/^https?:\/\//i.test(v) || v.includes("/")) return webUrl(v);
  const handle = v.replace(/^@/, "");
  return /^[\w.]{1,60}$/.test(handle) ? PROFILE_BASE[kind] + handle : null;
}

type Links = { website: string | null; instagram: string | null; facebook: string | null; tiktok: string | null; otherLinks: { label: string; url: string }[] };

/**
 * The salon's social networks only (Instagram, Facebook, TikTok), for the website and the booking
 * page: links to booking marketplaces (Booksy, Fresha, Treatwell…) would send clients off to book
 * there, so those stay in Get found online and the search-engine details only.
 */
export const socialLinks = (b: Links) => profileLinks(b).filter((l) => l.key !== "other");

/** Every profile link the salon has, in display order. */
export function profileLinks(b: Links) {
  return [
    ...PROFILES.filter((k) => b[k]).map((k) => ({ key: k as string, label: k === "tiktok" ? "TikTok" : k[0].toUpperCase() + k.slice(1), url: b[k]! })),
    ...b.otherLinks.map((l) => ({ key: "other", label: l.label, url: l.url })),
  ];
}

/** schema.org types for the kinds of business; a salon that does several is several. */
const SCHEMA_TYPE: Record<string, string> = { hair: "HairSalon", barber: "HairSalon", nails: "NailSalon", beauty: "BeautySalon", spa: "DaySpa", laser: "BeautySalon" };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Hours = { weekday: number; startMin: number; endMin: number }[];

/** schema.org PostalAddress from the address parts; only the town when the owner shows only that. */
function postalAddress(b: { addressStreet?: string | null; addressPostcode?: string | null; addressTown?: string | null; addressTownOnly?: boolean; country?: string | null }) {
  if (!b.addressTown) return null;
  return {
    "@type": "PostalAddress",
    ...(!b.addressTownOnly && b.addressStreet && { streetAddress: b.addressStreet }),
    ...(!b.addressTownOnly && b.addressPostcode && { postalCode: b.addressPostcode }),
    addressLocality: b.addressTown,
    ...(b.country && { addressCountry: b.country }),
  };
}

/**
 * The business as search engines and maps read it (JSON-LD). Built only from what the booking page
 * itself shows: name, address, contact, opening hours, and the services with their prices.
 */
export function businessJsonLd(opts: {
  business: Links & {
    name: string;
    about: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    currency: string;
    businessTypes: string[];
    /** The address in parts, when the owner gave it so: maps and search engines read it best this way. */
    addressStreet?: string | null;
    addressPostcode?: string | null;
    addressTown?: string | null;
    addressTownOnly?: boolean;
    country?: string | null;
  };
  hours: Hours;
  services: { name: string; priceCents: number }[];
  bookingUrl: string;
  image: string;
}) {
  const b = opts.business;
  const types = [...new Set(b.businessTypes.map((t) => SCHEMA_TYPE[t]).filter(Boolean))];
  const sameAs = socialLinks({ ...b, website: null }).map((l) => l.url);
  return {
    "@context": "https://schema.org",
    "@type": types.length > 1 ? types : (types[0] ?? "BeautySalon"),
    name: b.name,
    url: b.website ?? opts.bookingUrl,
    image: opts.image,
    // The square icon doubles as the logo search engines show.
    logo: opts.image,
    ...(b.about && { description: b.about }),
    ...(b.phone && { telephone: b.phone }),
    ...(b.email && { email: b.email }),
    ...(b.address && { address: postalAddress(b) ?? b.address }),
    ...(sameAs.length && { sameAs }),
    ...(opts.hours.length && {
      openingHoursSpecification: opts.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[h.weekday], opens: hhmm(h.startMin), closes: hhmm(h.endMin) })),
    }),
    ...(opts.services.length && {
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: b.name,
        itemListElement: opts.services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name },
          price: (s.priceCents / 100).toFixed(2),
          priceCurrency: b.currency,
        })),
      },
    }),
    potentialAction: { "@type": "ReserveAction", target: { "@type": "EntryPoint", urlTemplate: opts.bookingUrl, actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"] } },
  };
}

/**
 * Opening hours as one line per group of days with the same hours, e.g. "Mon–Fri 9:00–19:00",
 * "Sat 9:00–14:00" — the same wording to paste into Google, Bing and Apple.
 */
export function hoursLines(hours: Hours, locale: string) {
  const day = (i: number) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
  const per = DAYS.map((_, i) =>
    hours
      .filter((h) => h.weekday === i)
      .sort((a, b) => a.startMin - b.startMin)
      .map((h) => `${hhmm(h.startMin)}–${hhmm(h.endMin)}`)
      .join(", "),
  );
  const lines: { days: string; hours: string }[] = [];
  for (let i = 0; i < 7; i++) {
    if (!per[i]) continue;
    let j = i;
    while (j + 1 < 7 && per[j + 1] === per[i]) j++;
    lines.push({ days: j > i ? `${day(i)}–${day(j)}` : day(i), hours: per[i] });
    i = j;
  }
  return lines;
}

/** The "Get found online" steps. `auto` ones tick themselves from the salon's details. */
export const FOUND_STEPS = ["website", "google", "searchConsole", "bing", "apple", "social", "reviews"] as const;
export type FoundStep = (typeof FOUND_STEPS)[number];

/** Which Settings item each step sits under: "Google profile" or "Other search engines". */
export const FOUND_PARTS: Record<FoundStep, "google" | "other"> = {
  website: "google",
  google: "google",
  searchConsole: "google",
  reviews: "google",
  bing: "other",
  apple: "other",
  social: "other",
};

export const FOUND_LINKS: Partial<Record<FoundStep, { key: string; url: string }[]>> = {
  google: [{ key: "googleProfile", url: "https://business.google.com/" }],
  searchConsole: [{ key: "searchConsole", url: "https://search.google.com/search-console" }],
  bing: [
    { key: "bingPlaces", url: "https://www.bingplaces.com/" },
    { key: "bingWebmaster", url: "https://www.bing.com/webmasters" },
  ],
  apple: [{ key: "appleConnect", url: "https://businessconnect.apple.com/" }],
};
