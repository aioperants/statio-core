import { minutesToHHMM } from "./time";
import { textIn, type Texts } from "./texts";

export function money(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  );
}

export const hhmm = minutesToHHMM;

/** "Friday 16 October" in the given language, for a YYYY-MM-DD day. */
export function dayLabel(day: string, locale: string, style: "long" | "short" = "long") {
  const [y, m, d] = day.split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, {
    weekday: style,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A service's group in the visitor's language, else the salon's default language (`fallback`), else any. */
export function categoryName(s: { categoryNames?: Texts | null; category: string | null; categoryEn?: string | null }, locale: string, fallback?: string) {
  return textIn(s.categoryNames, locale, fallback) || (s.category ?? "");
}

/** A service's name in the visitor's language, else the salon's default language (`fallback`), else any. */
export function serviceName(s: { names?: Texts | null; nameEn: string; nameEs: string }, locale: string, fallback?: string) {
  return textIn(s.names, locale, fallback) || s.nameEs;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
