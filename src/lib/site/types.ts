/**
 * Everything the website shows besides the owner's own texts, read live from the app (see
 * lib/site/data.ts). Plain values only, so it can be cached between visits.
 */
export type SiteData = {
  /** The salon's one language for clients: the website's language. */
  locale: string;
  currency: string;
  name: string;
  /** Business details › colour: the website's accent, made readable by the design direction. */
  brandColor: string;
  logo: string | null;
  /** The short description from Business details. */
  shortAbout: string | null;
  address: string | null;
  /** "Get directions": a link to the map, never an embedded map (embedded maps set cookies). */
  mapsUrl: string | null;
  /** E.164 (+34611222333) for tel: and WhatsApp links, and as people read it. */
  phone: string | null;
  phoneDisplay: string | null;
  email: string | null;
  links: { label: string; url: string }[];
  /** The booking page, relative to the site. */
  bookUrl: string;
  /** Services by group, in the salon's order; `name` null = services without a group. */
  services: { name: string | null; items: SiteService[] }[];
  team: SiteMember[];
  hours: { days: string; hours: string }[];
  /** Whole days closed coming up (holidays, closures), already worded: "Fri 24 Dec". */
  closures: { when: string; reason: string | null }[];
  /** The big photo at the top, if the owner added one. */
  heroImage: string | null;
};

export type SiteService = { id?: string; name: string; durationMin: number; priceCents: number; from: boolean; description?: string | null };
export type SiteMember = { id?: string; name: string; title: string | null; photo: string | null; color: string; bookUrl: string };

/** A salon with nothing filled in yet. */
export const EMPTY_SITE: Omit<SiteData, "name" | "locale" | "currency" | "bookUrl" | "brandColor"> = {
  logo: null,
  shortAbout: null,
  address: null,
  mapsUrl: null,
  phone: null,
  phoneDisplay: null,
  email: null,
  links: [],
  services: [],
  team: [],
  hours: [],
  closures: [],
  heroImage: null,
};
