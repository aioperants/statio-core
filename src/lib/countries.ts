import Holidays from "date-holidays";
import { isCountry } from "./phone";

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK"];
const CURRENCY: Record<string, string> = {
  GB: "GBP", US: "USD", MX: "MXN", CO: "COP", AR: "ARS", CH: "CHF", CL: "CLP", PE: "PEN", UY: "UYU", BR: "BRL", CA: "CAD", AU: "AUD",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", SE: "SEK", NO: "NOK", DK: "DKK", MA: "MAD", DO: "DOP", EC: "USD", PA: "USD",
  GT: "GTQ", CR: "CRC", VE: "VES", PY: "PYG", BO: "BOB", UA: "UAH", TR: "TRY", AE: "AED", IL: "ILS", ZA: "ZAR",
};

/** What a country sets for a new salon: its currency and main time zone (null = keep the current one). */
export function countryDefaults(country: string | null | undefined): { currency: string | null; timezone: string | null } {
  if (!country || !isCountry(country)) return { currency: null, timezone: null };
  const currency = EURO.includes(country) ? "EUR" : (CURRENCY[country] ?? null);
  let timezone: string | null = null;
  try {
    timezone = new Holidays(country).getTimezones()?.[0] ?? null;
  } catch {}
  // Spain's islands have their own zone; the mainland is the usual one.
  if (country === "ES") timezone = "Europe/Madrid";
  return { currency, timezone: timezone && Intl.supportedValuesOf("timeZone").includes(timezone) ? timezone : null };
}

/**
 * The visitor's country, as well as we can tell before asking: the hosting's location header, then
 * the region in their browser language ("es-ES" → ES). Null when neither says.
 */
export function guessCountry(h: Headers): string | null {
  const geo = h.get("x-vercel-ip-country")?.toUpperCase();
  if (geo && isCountry(geo)) return geo;
  for (const part of (h.get("accept-language") ?? "").split(",")) {
    const region = /^[a-z]{2,3}-([A-Z]{2})\b/i.exec(part.trim())?.[1]?.toUpperCase();
    if (region && isCountry(region)) return region;
  }
  return null;
}

const SPANISH = ["ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR", "GQ", "AD"];
const ENGLISH = ["GB", "US", "IE", "AU", "NZ", "CA", "ZA", "MT", "GI", "JM", "TT", "SG"];

/** The language clients most likely read in this country, among the ones the app speaks; null = keep the current one. */
export const languageFor = (country: string | null | undefined): "es" | "en" | null =>
  country && SPANISH.includes(country) ? "es" : country && ENGLISH.includes(country) ? "en" : null;
