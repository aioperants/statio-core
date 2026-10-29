import { describe, expect, it } from "vitest";
import { bookingLookOf } from "./booking-look";

describe("the booking page's look", () => {
  it("is the website's design unless the salon chose clean", () => {
    expect(bookingLookOf("site")).toBe("site");
    expect(bookingLookOf(null)).toBe("site");
    expect(bookingLookOf("anything")).toBe("site");
    expect(bookingLookOf("clean")).toBe("clean");
  });
});
