import "server-only";
import { createHash } from "node:crypto";
import pkg from "../../package.json";

/** Where Core says hello: the Statio team's count of installs and the owners who asked for updates. */
const HELLO_URL = process.env.STATIO_HELLO_URL || "https://app.statiocrm.com/api/core/hello";

/**
 * An anonymous id for this install, the same every time: a hash of its secret, so it says nothing
 * about the salon and can't be turned back into the secret.
 */
export function installId() {
  const secret = process.env.BETTER_AUTH_SECRET;
  return secret ? createHash("sha256").update(`statio-core:${secret}`).digest("hex") : null;
}

/** Off with STATIO_TELEMETRY=off, and on copies without a secret (local tries). */
export const helloOn = () => process.env.STATIO_TELEMETRY !== "off" && installId() !== null;

/**
 * Tells the Statio team this install exists ("install" once at setup, "ping" weekly): its id,
 * version, country and language. The owner's email and salon name only when they ticked
 * "Email me about updates". Never waits long and never fails the caller.
 */
export async function sayHello(event: "install" | "ping", info: { country: string | null; locale: string; contact?: { email: string; salon: string } }) {
  if (!helloOn()) return;
  const body = {
    id: installId(),
    event,
    version: pkg.version,
    country: info.country,
    locale: info.locale,
    ...(info.contact && { email: info.contact.email, salon: info.contact.salon, consent: true }),
  };
  try {
    await fetch(HELLO_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(4000) });
  } catch {
    // Offline or the other end is down: nothing for the salon to do.
  }
}
