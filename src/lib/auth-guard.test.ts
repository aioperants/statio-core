import { describe, expect, it } from "vitest";
import { refusal, sameAddressUrl } from "./auth-guard";

const base = { method: "POST", host: "aurora.statiocrm.com", origin: "https://aurora.statiocrm.com", fetchSite: "same-origin", hasCookie: true, params: new URLSearchParams(), body: null, embedOrigins: ["https://www.salonaurora.com"] };

describe("sign-in requests only act on their own address", () => {
  it("lets the salon's own pages through", () => {
    expect(refusal(base)).toBeNull();
    expect(refusal({ ...base, origin: "https://www.salonaurora.com" })).toBeNull();
    expect(refusal({ ...base, method: "GET", origin: null, fetchSite: "cross-site" })).toBeNull();
  });
  it("refuses another salon's address, outside sites and hidden origins", () => {
    expect(refusal({ ...base, origin: "https://nova.statiocrm.com" })).toBe("Invalid origin");
    expect(refusal({ ...base, origin: "https://evil.example" })).toBe("Invalid origin");
    expect(refusal({ ...base, origin: "null" })).toBe("Invalid origin");
    expect(refusal({ ...base, origin: null, fetchSite: "same-site" })).toBe("Invalid origin");
    expect(refusal({ ...base, origin: null, fetchSite: null })).toBe("Invalid origin");
    expect(refusal({ ...base, origin: null, fetchSite: null, hasCookie: false })).toBeNull();
  });
  it("only sends people back to this address", () => {
    const h = "aurora.statiocrm.com";
    expect(sameAddressUrl("/en/admin", h)).toBe(true);
    expect(sameAddressUrl("https://aurora.statiocrm.com/en/admin", h)).toBe(true);
    for (const bad of ["https://nova.statiocrm.com/en/admin", "//evil.example", "/\\evil.example", "/%5Cevil.example", "https://evil.example"]) expect(sameAddressUrl(bad, h)).toBe(false);
    expect(refusal({ ...base, body: { email: "a@b.co", callbackURL: "https://nova.statiocrm.com/en/admin" } })).toBe("Invalid callbackURL");
    expect(refusal({ ...base, method: "GET", params: new URLSearchParams({ callbackURL: "https://evil.example" }) })).toBe("Invalid callbackURL");
  });
});
