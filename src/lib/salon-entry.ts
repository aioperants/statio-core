import "server-only";
import { randomBytes } from "node:crypto";
import { auth } from "./auth";

/** A one-time sign-in link (used at once, valid 15 minutes) that signs `email` in at `origin` and opens `next`. */
export async function signInLink(o: { origin: string; email: string; name: string; next: string; errorNext: string }) {
  const token = randomBytes(24).toString("base64url");
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `magic-link:${token}`,
    value: JSON.stringify({ type: "magic-link", email: o.email, name: o.name }),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  const verify = new URL(`${o.origin}/api/auth/magic-link/verify`);
  verify.searchParams.set("token", token);
  verify.searchParams.set("callbackURL", o.next);
  verify.searchParams.set("errorCallbackURL", o.errorNext);
  return verify.toString();
}
