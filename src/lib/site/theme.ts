import type { Direction } from "./config";

/**
 * Design directions: the look only (colours, type, shapes, spacing), never the pieces. Each one
 * takes the salon's brand colour and keeps every text readable (WCAG AA, 4.5:1) whatever that
 * colour is: a brand colour too light or too dark for the background is deepened or lightened for
 * text, and button text is black or white, whichever reads better.
 */

type Base = {
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  /** CSS font stacks; the variables come from lib/site/fonts.ts. */
  display: string;
  body: string;
  headingWeight: number;
  /** Headings in capitals. */
  headingUpper: boolean;
  headingTracking: string;
  radius: string;
  buttonRadius: string;
  /** Small labels above headings ("Our services"): uppercase and spaced in most directions. */
  eyebrowUpper: boolean;
};

// The look's lettering (served from our own address, see components/site/fonts.ts).
const MANROPE = 'var(--font-manrope), "Manrope", ui-sans-serif, system-ui, sans-serif';

export const DIRECTION_BASE: Record<Direction, Base> = {
  minimalist: {
    dark: false, bg: "#FFFFFF", surface: "#F6F6F5", text: "#141414", muted: "#595959", line: "#E4E4E2",
    display: MANROPE, body: MANROPE, headingWeight: 600, headingUpper: false, headingTracking: "-0.03em",
    radius: "4px", buttonRadius: "4px", eyebrowUpper: true,
  },
};

/** The look's colours: page, panels, text, lines and accent together. */
type Palette = Pick<Base, "dark" | "bg" | "surface" | "text" | "muted" | "line"> & { accent: string };

const light = (bg: string, surface: string, text: string, muted: string, line: string, accent: string): Palette => ({ dark: false, bg, surface, text, muted, line, accent });

export const PALETTES: Record<Direction, Record<string, Palette>> = {
  minimalist: {
    snow: light("#FFFFFF", "#F5F5F4", "#141414", "#595959", "#E4E4E2", "#141414"),
  },
};

/** Every ready-made palette by name (names are unique across looks), with the look it was made for. */
export const ALL_PALETTES: Record<string, Palette & { look: Direction }> = Object.fromEntries(
  (Object.entries(PALETTES) as [Direction, Record<string, Palette>][]).flatMap(([look, sets]) => Object.entries(sets).map(([k, p]) => [k, { ...p, look }])),
);

/**
 * The palettes a look can use: "brand" first, then its own, then every other look's. Colours and
 * look are separate choices: a palette sets all the colours (page, panels, text, accent), so it reads
 * well with any look's lettering and shapes, and changing the look keeps the colours chosen.
 */
export const palettesOf = (d: Direction) => {
  const own = Object.keys(PALETTES[d] ?? {});
  return ["brand", ...own, ...Object.keys(ALL_PALETTES).filter((k) => !own.includes(k))];
};

/* ---------- Colour maths (WCAG 2) ---------- */

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? "111111";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (c: Rgb) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** `a` mixed with `b`: share 0 = a, 1 = b. */
export function mix(a: string, b: string, share: number) {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * share) as Rgb);
}

/** The brand colour, deepened (light pages) or lightened (dark pages) just enough to read as text on every background given. */
export function readableOn(color: string, backgrounds: string[], dark: boolean, min = 4.5) {
  const toward = dark ? "#FFFFFF" : "#000000";
  for (let share = 0; share <= 1; share += 0.05) {
    const c = mix(color, toward, share);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

/** How far `color` must move towards black/white to read as text on every background (0 = not at all). */
export function readableShift(color: string, backgrounds: string[], dark: boolean, min = 4.5) {
  const toward = dark ? "#FFFFFF" : "#000000";
  for (let share = 0; share <= 1; share += 0.05) if (backgrounds.every((bg) => contrast(mix(color, toward, share), bg) >= min)) return share;
  return 1;
}

/** Black or white text on a coloured button, whichever reads better (one of them always reaches 4.5:1). */
export const textOn = (bg: string) => (contrast(bg, "#FFFFFF") >= contrast(bg, "#111111") ? "#FFFFFF" : "#111111");

export type Theme = Base & {
  brand: string;
  /** A light wash of the brand for alternating sections. */
  tint: string;
  /** Brand-coloured text (prices, links, small labels), readable on bg, surface and tint. */
  accent: string;
  /** The brand colour as it is, for decoration only (stars, rules, icons): never for text. */
  ornament: string;
  button: string;
  buttonText: string;
  /** Outline for a button whose colour is close to the page (e.g. a pale yellow brand on white). */
  buttonBorder: string;
};

export function themeFor(direction: Direction, brandColor: string, palette = "brand"): Theme {
  const look = DIRECTION_BASE[direction] ?? DIRECTION_BASE.minimalist;
  const own = PALETTES[direction]?.[palette] ?? ALL_PALETTES[palette];
  const base: Base = own ? { ...look, ...own } : look;
  const brand = toHex(hexToRgb(own ? own.accent : brandColor));
  // Alternate sections: a palette's own panel tone, or a light wash of the salon's brand colour.
  const tint = own ? mix(base.bg, base.surface, 0.7) : mix(base.bg, brand, base.dark ? 0.12 : 0.07);
  const backgrounds = [base.bg, base.surface, tint];
  // Body text and muted text stay readable on the tint too (a strong brand wash can darken it).
  const text = readableOn(base.text, backgrounds, base.dark, 7);
  const muted = readableOn(base.muted, backgrounds, base.dark);
  return {
    ...base,
    text,
    muted,
    brand,
    tint,
    // Brand-coloured text only where the colour reads as itself; a light gold or blush that would turn
    // muddy brown as text stays for lines, stars and badges (ornament), and text uses the ink colour.
    accent: readableShift(brand, backgrounds, base.dark) <= 0.15 ? readableOn(brand, backgrounds, base.dark) : text,
    ornament: brand,
    button: brand,
    buttonText: textOn(brand),
    buttonBorder: contrast(brand, base.bg) >= 3 ? brand : text,
  };
}

/** The theme as CSS variables on the website's outer element. */
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--s-bg": t.bg,
    "--s-surface": t.surface,
    "--s-tint": t.tint,
    "--s-text": t.text,
    "--s-muted": t.muted,
    "--s-line": t.line,
    "--s-accent": t.accent,
    "--s-ornament": t.ornament,
    "--s-button": t.button,
    "--s-button-text": t.buttonText,
    "--s-button-border": t.buttonBorder,
    "--s-display": t.display,
    "--s-body": t.body,
    "--s-radius": t.radius,
    "--s-button-radius": t.buttonRadius,
    "--s-heading-weight": String(t.headingWeight),
    "--s-heading-tracking": t.headingTracking,
    "--s-heading-case": t.headingUpper ? "uppercase" : "none",
    "--s-eyebrow-case": t.eyebrowUpper ? "uppercase" : "none",
    "--s-eyebrow-tracking": t.eyebrowUpper ? "0.14em" : "0",
    colorScheme: t.dark ? "dark" : "light",
  };
}
