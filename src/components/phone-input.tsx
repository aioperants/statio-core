"use client";
import { useEffect, useState } from "react";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { isCountry, phoneCountries, splitPhone, toE164 } from "@/lib/phone";

/**
 * A phone number with its country code: the code starts as the salon's country and can be changed
 * (a visitor from abroad). Posts `name` in one standard form (+34611222333), or reports it through
 * `onChange` for fields kept in state.
 */
export function PhoneInput(props: {
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (e164: string) => void;
  country?: string | null;
  locale: string;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const start = splitPhone(props.value ?? props.defaultValue, props.country);
  const [country, setCountry] = useState(start.country);
  const [national, setNational] = useState(start.national);
  // Country names come from the browser (server and browser can word them differently), so the
  // full list is built after the first render; until then only the chosen code is known.
  const [countries, setCountries] = useState<{ code: string; name: string; dial: string }[]>([]);
  useEffect(() => setCountries(phoneCountries(props.locale)), [props.locale]);
  // A number the phone rules can't read (too short, a new range) is kept as typed, with its country code.
  const full = (c: string, n: string) => {
    const typed = n.trim();
    if (!typed) return "";
    const e164 = toE164(typed, c) ?? typed;
    if (e164.startsWith("+") || typed.startsWith("+") || !isCountry(c)) return e164;
    return `+${getCountryCallingCode(c as CountryCode)} ${typed}`.slice(0, 30);
  };
  const update = (c: string, n: string) => {
    setCountry(c);
    setNational(n);
    props.onChange?.(full(c, n));
  };
  const dial = isCountry(country) ? getCountryCallingCode(country as CountryCode) : undefined;
  return (
    <div className="flex gap-2">
      <label className="relative shrink-0">
        <span className="field pointer-events-none flex w-20 items-center justify-center tabular-nums">{dial ? `+${dial}` : "+"}</span>
        <select
          aria-label="Country code"
          value={country}
          onChange={(e) => update(e.target.value, national)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">—</option>
          {country && !countries.length && <option value={country}>+{dial}</option>}
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </label>
      <input
        className="field min-w-0 flex-1"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        required={props.required}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        onChange={(e) => update(country, e.target.value)}
      />
      {props.name && <input type="hidden" name={props.name} value={full(country, national)} />}
    </div>
  );
}
