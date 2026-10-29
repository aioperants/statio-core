/**
 * The salon website, as the owner sets it up: fixed sections in a fixed order, each with one
 * design, in one look (Minimalist, Snow colours). The owner switches sections on or off, writes the
 * texts and adds photos. No sample content: a section without data hides.
 */

export const PIECES = ["hero", "services", "team", "gallery", "about", "faq", "hours", "contact"] as const;
export type PieceKey = (typeof PIECES)[number];

/**
 * Each section's design. Two follow the owner's content: the top shows the photo when there is one
 * ("photo"), else the name with the services running across ("marquee"); About sits beside its
 * photo when it has one ("split").
 */
export const LAYOUTS = {
  hero: ["marquee", "photo"],
  services: ["list"],
  team: ["grid"],
  gallery: ["grid"],
  about: ["text", "split"],
  faq: ["accordion"],
  hours: ["split"],
  contact: ["buttons"],
} as const satisfies Record<PieceKey, readonly string[]>;
export type Layout<K extends PieceKey = PieceKey> = (typeof LAYOUTS)[K][number];

export const DIRECTIONS = ["minimalist"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** The salon archetypes, by what they sell: they pick the ready-made texts (questions, About). */
export const PRESETS = ["barbershop", "hair", "nails", "aesthetics", "spa", "laser"] as const;
export type Preset = (typeof PRESETS)[number];

export type Piece = { key: PieceKey; on: boolean; layout: string };
export type Faq = { q: string; a: string };
/** A photo in "Our work": its id (website_photo), an optional caption (also read aloud to blind visitors) and the service ("Book this"). */
export type GalleryPhoto = { id: string; caption: string; serviceId?: string };

export type SiteConfig = {
  preset: Preset;
  direction: Direction;
  /** The look's colours (lib/site/theme.ts). */
  palette: string;
  /** Always null: the look's own colours. */
  brandColor: string | null;
  /** Every section, in page order; `on` = shown (when it has something to show). */
  pieces: Piece[];
  /** One line under the salon's name at the top; empty = the short description from Business details. */
  tagline: string;
  /** The salon's name under the logo at the top (off when the logo already says it). */
  heroName: boolean;
  /** Longer "About us" text; paragraphs separated by blank lines. */
  about: string;
  faq: Faq[];
  /** "Our work": photos in order. */
  gallery: GalleryPhoto[];
  /** About's own photo (a website_photo id); empty = the top photo. */
  aboutPhoto: string;
  showPrices: boolean;
  /** A WhatsApp button on the salon's phone number, only if the owner says they use it. */
  whatsapp: boolean;
  /** The business email in the Contact section (on unless hidden). */
  showEmail: boolean;
  /** Company name and tax / VAT number for the legal notice, shown in the footer when filled. */
  legalName: string;
  taxId: string;
  /** Just me: one person, so "About me" instead of a team. */
  solo: boolean;
  /** We come to you: no salon address on the website, the area served instead. */
  mobile: boolean;
  serviceArea: string;
};

/** The look every archetype uses. */
export const POPULAR: Record<Preset, { direction: Direction; palette: string }[]> = Object.fromEntries(
  PRESETS.map((p) => [p, [{ direction: "minimalist", palette: "snow" }]]),
) as Record<Preset, { direction: Direction; palette: string }[]>;

/** The archetype that fits the business types picked at setup (hair, barber, nails, beauty, spa, laser). */
export function presetFor(businessTypes: string[]): Preset {
  const has = (t: string) => businessTypes.includes(t);
  if (has("barber") && !has("hair")) return "barbershop";
  if (has("hair")) return "hair";
  if (has("laser") && !has("beauty") && !has("spa")) return "laser";
  if (has("spa") && !has("beauty")) return "spa";
  if (has("beauty")) return "aesthetics";
  if (has("nails")) return "nails";
  return "hair";
}

/** Every section on, in the fixed order, each with its first design. */
export function presetPieces(): Piece[] {
  return PIECES.map((key) => ({ key, on: true, layout: LAYOUTS[key][0] }));
}

export function defaultConfig(preset: Preset, solo = false): SiteConfig {
  return {
    preset,
    direction: "minimalist",
    palette: "snow",
    brandColor: null,
    pieces: presetPieces(),
    tagline: "",
    heroName: true,
    about: "",
    faq: [],
    gallery: [],
    aboutPhoto: "",
    showPrices: true,
    whatsapp: false,
    showEmail: true,
    legalName: "",
    taxId: "",
    solo,
    mobile: false,
    serviceArea: "",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const LIMITS = { tagline: 140, about: 2000, faqQ: 140, faqA: 600, faqCount: 10, legal: 120, photos: 12, caption: 120, area: 160 } as const;

/**
 * A stored or submitted config, made safe: the fixed sections in their fixed order (keeping which
 * are on), designs from the content, texts trimmed to their limits. Anything unreadable falls back.
 */
export function readConfig(raw: unknown, fallbackPreset: Preset = "hair"): SiteConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const preset = oneOf(PRESETS, r.preset, fallbackPreset);
  const stored = Array.isArray(r.pieces) ? (r.pieces as Piece[]) : [];
  const pieces: Piece[] = PIECES.map((key) => {
    const p = stored.find((x) => x?.key === key);
    return { key, on: p ? p.on === true : true, layout: oneOf<string>(LAYOUTS[key], p?.layout, LAYOUTS[key][0]) };
  });
  return {
    preset,
    direction: "minimalist",
    palette: "snow",
    brandColor: null,
    pieces,
    tagline: str(r.tagline, LIMITS.tagline),
    heroName: r.heroName !== false,
    about: str(r.about, LIMITS.about),
    faq: (Array.isArray(r.faq) ? r.faq : [])
      .map((f) => ({ q: str((f as Faq)?.q, LIMITS.faqQ), a: str((f as Faq)?.a, LIMITS.faqA) }))
      .filter((f) => f.q && f.a)
      .slice(0, LIMITS.faqCount),
    gallery: (Array.isArray(r.gallery) ? r.gallery : [])
      .map((x) => ({
        id: str((x as GalleryPhoto)?.id, 40),
        caption: str((x as GalleryPhoto)?.caption, LIMITS.caption),
        ...(UUID_RE.test(String((x as GalleryPhoto)?.serviceId)) && { serviceId: String((x as GalleryPhoto).serviceId) }),
      }))
      .filter((x, i, all) => UUID_RE.test(x.id) && all.findIndex((y) => y.id === x.id) === i)
      .slice(0, LIMITS.photos),
    aboutPhoto: UUID_RE.test(String(r.aboutPhoto)) ? String(r.aboutPhoto) : "",
    showPrices: r.showPrices !== false,
    whatsapp: r.whatsapp === true,
    showEmail: r.showEmail !== false,
    legalName: str(r.legalName, LIMITS.legal),
    taxId: str(r.taxId, 20),
    solo: r.solo === true,
    mobile: r.mobile === true,
    serviceArea: str(r.serviceArea, LIMITS.area),
  };
}

/** Same content, ignoring key order: for "you have changes that aren't published yet". */
export function sameConfig(a: SiteConfig, b: SiteConfig) {
  return JSON.stringify(readConfig(a)) === JSON.stringify(readConfig(b));
}
