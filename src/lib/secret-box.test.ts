import { describe, expect, it } from "vitest";
import { open, seal } from "./secret-box";

describe("secret box", () => {
  it("round-trips and refuses tampering", () => {
    process.env.BETTER_AUTH_SECRET = "test-secret-1234567890";
    const s = seal("app-password");
    expect(s).not.toContain("app-password");
    expect(open(s)).toBe("app-password");
    expect(open(s.slice(0, -4) + "AAAA")).toBeNull();
    process.env.BETTER_AUTH_SECRET = "another-secret";
    expect(open(s)).toBeNull();
  });
});
