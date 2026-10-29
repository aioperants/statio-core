import { describe, expect, it } from "vitest";
import { countryDefaults, guessCountry } from "./countries";

const h = (o: Record<string, string>) => new Headers(o);

describe("countries", () => {
  it("guess the country from the hosting's header, then the browser language", () => {
    expect(guessCountry(h({ "x-vercel-ip-country": "mx", "accept-language": "es-ES" }))).toBe("MX");
    expect(guessCountry(h({ "accept-language": "es-ES,es;q=0.9,en;q=0.8" }))).toBe("ES");
    expect(guessCountry(h({ "accept-language": "en,es;q=0.9" }))).toBeNull();
  });

  it("set currency and time zone", () => {
    expect(countryDefaults("ES")).toEqual({ currency: "EUR", timezone: "Europe/Madrid" });
    expect(countryDefaults("GB")).toEqual({ currency: "GBP", timezone: "Europe/London" });
    expect(countryDefaults("MX").currency).toBe("MXN");
    expect(countryDefaults(null)).toEqual({ currency: null, timezone: null });
  });
});

describe("language for a country", () => {
  it("is Spanish or English where clear, else unchanged", async () => {
    const { languageFor } = await import("./countries");
    expect(languageFor("MX")).toBe("es");
    expect(languageFor("GB")).toBe("en");
    expect(languageFor("FR")).toBeNull();
  });
});
