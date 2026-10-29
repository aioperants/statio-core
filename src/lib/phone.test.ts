import { describe, expect, it } from "vitest";
import { splitPhone, toE164 } from "./phone";

describe("phone numbers", () => {
  it("stores every way of typing the same number the same", () => {
    expect(toE164("611 222 333", "ES")).toBe("+34611222333");
    expect(toE164("+34 611-222-333", "ES")).toBe("+34611222333");
    expect(toE164("0034611222333", "GB")).toBe("+34611222333");
    expect(toE164("07911 123456", "GB")).toBe("+447911123456");
  });
  it("keeps what it can't read, and empty stays empty", () => {
    expect(toE164("ask at desk", "ES")).toBe("ask at desk");
    expect(toE164("  ", "ES")).toBeNull();
  });
  it("splits a stored number for the country-code picker", () => {
    expect(splitPhone("+34611222333", "GB")).toEqual({ country: "ES", national: "611222333" });
    expect(splitPhone(null, "ES")).toEqual({ country: "ES", national: "" });
  });
});
