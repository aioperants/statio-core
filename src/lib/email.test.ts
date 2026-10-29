import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {}, schema: {} }));
const { emailProvider } = await import("./email");

describe("email provider", () => {
  it("picks the one configured, Resend first", () => {
    expect(emailProvider({})).toBe("log");
    expect(emailProvider({ SMTP_HOST: "smtp.salon.com" })).toBe("smtp");
    expect(emailProvider({ RESEND_API_KEY: "re_x", SMTP_HOST: "smtp.salon.com" })).toBe("resend");
  });
  it("lets EMAIL_PROVIDER switch", () => {
    expect(emailProvider({ EMAIL_PROVIDER: "smtp", RESEND_API_KEY: "re_x", SMTP_HOST: "h" })).toBe("smtp");
    expect(emailProvider({ EMAIL_PROVIDER: "log", RESEND_API_KEY: "re_x" })).toBe("log");
  });
});
