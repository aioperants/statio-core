import "server-only";
import Holidays from "date-holidays";

/**
 * Public holidays for "Add public holidays" in Opening hours: a helper only. The days the owner
 * picks become ordinary closed days. Data: the date-holidays project (CC BY 3.0), built in, no
 * external service.
 */

const lang = (locale: string) => locale.split("-")[0];

/** Countries, by name in the given language. */
export function holidayCountries(locale: string) {
  const all = new Holidays().getCountries(lang(locale)) ?? {};
  return Object.entries(all)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Regions of a country (states, communities…), or none. */
export function holidayRegions(country: string, locale: string) {
  const all = new Holidays().getStates(country, lang(locale)) ?? {};
  return Object.entries(all)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

export type Holiday = { day: string; name: string; /** public and bank holidays; the rest are local or optional */ official: boolean };

/** Holidays between two days (inclusive), one per day, school holidays left out. */
export function holidaysBetween(country: string, region: string | null, from: string, to: string, locale: string): Holiday[] {
  const h = region ? new Holidays(country, region) : new Holidays(country);
  const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
  const byDay = new Map<string, Holiday>();
  for (const y of years) {
    for (const x of h.getHolidays(y, lang(locale)) || []) {
      const day = x.date.slice(0, 10);
      if (x.type === "school" || day < from || day > to) continue;
      const official = x.type === "public" || x.type === "bank";
      const seen = byDay.get(day);
      if (!seen || (official && !seen.official)) byDay.set(day, { day, name: x.name, official });
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
