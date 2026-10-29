import { textIn, type Texts } from "./texts";

/** Station types every salon starts with; any other name the salon types becomes its own type. */
export const BUILT_IN_KINDS = ["styling", "basin", "nail", "pedicure", "room"] as const;
type BuiltIn = (typeof BUILT_IN_KINDS)[number];
const isBuiltIn = (k: string): k is BuiltIn => (BUILT_IN_KINDS as readonly string[]).includes(k);
/** The built-in types' names in one language (messages admin.chairs.kinds). */
export type KindNames = Record<BuiltIn, string>;

/** Shown name of a station type: the translated built-in one, or the salon's own words. */
export function kindLabel(kind: string, names: KindNames) {
  return isBuiltIn(kind) ? names[kind] : kind;
}

/** Typing "Lavacabezas" or "Basin" (in any language the app speaks) picks the built-in type, so services and stations still match. */
export function normalizeKind(input: string, languages: KindNames[]) {
  const v = input.trim().replace(/\s+/g, " ").slice(0, 40);
  const lower = v.toLowerCase();
  return BUILT_IN_KINDS.find((k) => k === lower || languages.some((m) => m[k]?.toLowerCase() === lower)) ?? v;
}

/** The salon's name for the "Chairs & stations" section, if it set one. */
export function stationsLabel(b: { stationsLabels: Texts; defaultLocale: string }, locale: string) {
  return textIn(b.stationsLabels, locale, b.defaultLocale) || null;
}
