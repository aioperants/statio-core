import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Phone numbers in one standard form (+34611222333), so the same person is always the same number,
 * whatever way it was typed. Numbers without a country code take the salon's country.
 */
export const isCountry = (c: unknown): c is CountryCode => typeof c === "string" && (getCountries() as string[]).includes(c);

/** "+34 611 22 23 33", "611222333" (with country ES) → "+34611222333"; unreadable input is kept as typed. */
export function toE164(raw: unknown, country?: string | null): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const n = parsePhoneNumberFromString(v.replace(/^00/, "+"), isCountry(country) ? country : undefined);
  return n?.isPossible() ? n.number : v.slice(0, 30);
}

/** For the phone field: which country code to show, and the rest of the number. */
export function splitPhone(value: string | null | undefined, fallback?: string | null) {
  const n = value ? parsePhoneNumberFromString(value, isCountry(fallback) ? fallback : undefined) : undefined;
  // A number in a range the library can't place still has a calling code: pick that code's country.
  const country = n?.country ?? n?.getPossibleCountries()[0];
  if (n && country) return { country: country as string, national: n.nationalNumber as string };
  return { country: isCountry(fallback) ? fallback : "", national: value ?? "" };
}

/** Every country with its calling code, named in the given language: [{ code: "ES", name: "Spain", dial: "34" }]. */
export function phoneCountries(locale: string) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return getCountries()
    .map((code) => ({ code: code as string, name: names.of(code) ?? code, dial: getCountryCallingCode(code) as string }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** For reading: "+34622333444" → "+34 622 33 34 44" (anything else is shown as stored). */
export function formatPhone(value: string | null | undefined) {
  if (!value) return value ?? null;
  const n = value.startsWith("+") ? parsePhoneNumberFromString(value) : undefined;
  return n ? n.formatInternational() : value;
}
