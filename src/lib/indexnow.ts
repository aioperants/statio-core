import "server-only";
import { createHash } from "node:crypto";
import { salonUrl } from "./salon-url";

/**
 * IndexNow: tells Bing (and other engines that use it) straight away that the booking page changed,
 * e.g. new hours or services. Only on a real domain; never on localhost. The key is derived from
 * the app's secret, so there's nothing to set up.
 */

export function indexNowKey() {
  return createHash("sha256").update(`indexnow:${process.env.BETTER_AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);
}

export function pingIndexNow(paths: string[]) {
  const url = salonUrl();
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url) || !process.env.BETTER_AUTH_SECRET) return;
  const host = new URL(url).host;
  // Fire and forget: a failed ping must never get in the owner's way.
  void fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: indexNowKey(), keyLocation: `${url}/api/indexnow`, urlList: paths.map((p) => `${url}${p}`) }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}
