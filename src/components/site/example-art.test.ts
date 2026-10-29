import { describe, expect, it } from "vitest";
import { monogramLogo } from "./example-art";

describe("monogram logo", () => {
  it("is an SVG with the salon's initials in its colour", () => {
    const url = monogramLogo("Salón Aurora", "#2E5E45");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(url.split(",")[1], "base64").toString();
    expect(svg).toContain(">SA</text>");
    expect(svg).toContain('fill="#2E5E45"');
    expect(svg).not.toMatch(/<script|on\w+=/i);
  });
});
