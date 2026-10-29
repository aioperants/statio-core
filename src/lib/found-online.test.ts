import { describe, expect, it } from "vitest";
import { businessJsonLd, hoursLines, profileUrl, webUrl } from "./found-online";

describe("webUrl", () => {
  it("adds https and rejects things that aren't addresses", () => {
    expect(webUrl("salonaurora.es")).toBe("https://salonaurora.es/");
    expect(webUrl("http://x.com/a")).toBe("http://x.com/a");
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("hello")).toBeNull();
    expect(webUrl("")).toBeNull();
  });
});

describe("profileUrl", () => {
  it("turns handles into profile links", () => {
    expect(profileUrl("instagram", "@salon.aurora")).toBe("https://www.instagram.com/salon.aurora");
    expect(profileUrl("tiktok", "aurora")).toBe("https://www.tiktok.com/@aurora");
    expect(profileUrl("facebook", "facebook.com/aurora")).toBe("https://facebook.com/aurora");
    expect(profileUrl("instagram", "not a handle")).toBeNull();
  });
});

describe("hoursLines", () => {
  it("groups days with the same hours", () => {
    const hours = [0, 1, 2, 3, 4].map((weekday) => ({ weekday, startMin: 540, endMin: 1140 })).concat({ weekday: 5, startMin: 540, endMin: 840 });
    expect(hoursLines(hours, "en")).toEqual([
      { days: "Mon–Fri", hours: "09:00–19:00" },
      { days: "Sat", hours: "09:00–14:00" },
    ]);
  });
});

describe("businessJsonLd", () => {
  it("describes the salon from its own details", () => {
    const ld = businessJsonLd({
      business: { name: "Aurora", about: null, phone: "+34 600", email: null, address: "Calle Mayor 12", currency: "EUR", businessTypes: ["hair", "barber", "nails"], website: null, instagram: "https://www.instagram.com/a", facebook: null, tiktok: null, otherLinks: [{ label: "Booksy", url: "https://booksy.com/a" }] },
      hours: [{ weekday: 0, startMin: 540, endMin: 1140 }],
      services: [{ name: "Cut", priceCents: 1850 }],
      bookingUrl: "https://x.test/es/book",
      image: "https://x.test/icon",
    });
    expect(ld["@type"]).toEqual(["HairSalon", "NailSalon"]);
    expect(ld.url).toBe("https://x.test/es/book");
    // Social networks only: marketplaces would send clients to book elsewhere.
    expect(ld.sameAs).toEqual(["https://www.instagram.com/a"]);
    expect(ld.openingHoursSpecification?.[0]).toMatchObject({ dayOfWeek: "Monday", opens: "09:00", closes: "19:00" });
    expect(ld.hasOfferCatalog?.itemListElement[0]).toMatchObject({ price: "18.50", priceCurrency: "EUR" });
  });
});

describe("links shown to clients", () => {
  it("keep the social networks and leave out booking marketplaces", async () => {
    const { socialLinks } = await import("./found-online");
    const links = socialLinks({
      website: null,
      instagram: "https://www.instagram.com/salon",
      facebook: null,
      tiktok: "https://www.tiktok.com/@salon",
      otherLinks: [{ label: "Booksy", url: "https://booksy.com/salon" }],
    });
    expect(links.map((l) => l.label)).toEqual(["Instagram", "TikTok"]);
  });

  it("gives maps the address in parts, and only the town when the owner asks", () => {
    const base = { name: "A", about: null, phone: null, email: null, address: "Calle Mayor 12, 28013 Madrid", currency: "EUR", businessTypes: [], website: null, instagram: null, facebook: null, tiktok: null, otherLinks: [] };
    const parts = { addressStreet: "Calle Mayor 12", addressPostcode: "28013", addressTown: "Madrid", country: "ES" };
    const ld = (b: object) => businessJsonLd({ business: { ...base, ...b }, hours: [], services: [], bookingUrl: "https://a/book", image: "https://a/i" }).address;
    expect(ld(parts)).toEqual({ "@type": "PostalAddress", streetAddress: "Calle Mayor 12", postalCode: "28013", addressLocality: "Madrid", addressCountry: "ES" });
    expect(ld({ ...parts, addressTownOnly: true })).toEqual({ "@type": "PostalAddress", addressLocality: "Madrid", addressCountry: "ES" });
    expect(ld({})).toBe("Calle Mayor 12, 28013 Madrid");
  });
});

