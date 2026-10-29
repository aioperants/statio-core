import "server-only";

/** Cloudflare Turnstile bot check. Skipped when no secret key is configured. */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const body = (await res.json()) as { success?: boolean };
  return body.success === true;
}
