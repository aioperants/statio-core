import type { Direction } from "./site/config";
import { mix, readableOn, themeFor } from "./site/theme";

/**
 * The colours of the app itself (admin, booking page, sign-in, app icon). By default black and
 * white, whatever the website looks like; the owner can switch to their website's colours in
 * Settings › Salon. The public website always keeps its own look (lib/site/theme.ts).
 */
export const APP_COLOURS = ["neutral", "website"] as const;
export type AppColours = (typeof APP_COLOURS)[number];

export const NEUTRAL = { brand: "#111111", canvas: "#FAFAFA" } as const;

export type Colours = { brand: string; canvas: string };

/** The website's look, as the app uses it: its accent on buttons (deepened until white text reads on it) and a light version of its page tone. */
export function websiteColours(direction: Direction, brandColor: string, palette: string): Colours {
  const t = themeFor(direction, brandColor, palette);
  const brand = readableOn(t.brand, ["#FFFFFF"], false);
  // Dark looks keep a light app (white cards on a dark page don't read); light ones a softer page tone.
  const canvas = t.dark ? mix("#FFFFFF", brand, 0.04) : mix(t.bg, "#FFFFFF", 0.4);
  return { brand, canvas };
}
