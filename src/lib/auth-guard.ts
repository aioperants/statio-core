import { requestHost } from "./address";

/**
 * A wall in front of the sign-in library (api/auth): a request only acts on the sign-in of the
 * address it came to, and only sends people back to that same address. Zero trust: same address only.
 */

const CALLBACK_KEYS = ["callbackURL", "errorCallbackURL", "newUserCallbackURL", "redirectTo"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const hostOf = (url: string) => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
};

/** Where a sign-in may send someone afterwards: a path here, or an address on this same host. */
export function sameAddressUrl(value: unknown, host: string): boolean {
  if (typeof value !== "string" || !value) return true;
  if (value.startsWith("/")) return !value.startsWith("//") && !value.startsWith("/\\") && !/^\/[^/]*%5c/i.test(value);
  return hostOf(value) === host;
}

/** Why the request is refused, or null when it may go on. `body`: the parsed JSON body, if any. */
export function refusal(o: { method: string; host: string | null; origin: string | null; fetchSite: string | null; hasCookie: boolean; params: URLSearchParams; body: unknown; embedOrigins: string[] }): string | null {
  const host = o.host?.toLowerCase();
  if (!host) return "No address";
  if (!SAFE_METHODS.has(o.method)) {
    if (o.origin) {
      if (o.origin !== "null" && hostOf(o.origin) === host) {
        // Same address: fine.
      } else if (!o.embedOrigins.includes(o.origin)) return "Invalid origin";
    } else if (o.fetchSite && o.fetchSite !== "same-origin" && o.fetchSite !== "none") return "Invalid origin";
    // A browser always says where a change comes from; without it, no cookie may ride along.
    else if (!o.fetchSite && o.hasCookie) return "Invalid origin";
  }
  const fields = o.body && typeof o.body === "object" ? (o.body as Record<string, unknown>) : {};
  for (const key of CALLBACK_KEYS) {
    if (!sameAddressUrl(o.params.get(key), host) || !sameAddressUrl(fields[key], host)) return "Invalid callbackURL";
  }
  return null;
}

/** Runs `handler` for requests that pass `refusal`, else answers 403. */
export async function sameAddressOnly(req: Request, handler: (req: Request) => Promise<Response>): Promise<Response> {
  let body: unknown = null;
  if (!SAFE_METHODS.has(req.method) && (req.headers.get("content-type") ?? "").includes("application/json")) {
    body = await req.clone().json().catch(() => null);
  }
  const why = refusal({
    method: req.method,
    host: requestHost(req.headers),
    origin: req.headers.get("origin"),
    fetchSite: req.headers.get("sec-fetch-site"),
    hasCookie: Boolean(req.headers.get("cookie")),
    params: new URL(req.url).searchParams,
    body,
    embedOrigins: (process.env.EMBED_ALLOWED_ORIGINS ?? "").split(/\s+/).filter(Boolean),
  });
  if (why) return Response.json({ message: why, code: why === "Invalid callbackURL" ? "INVALID_CALLBACK_URL" : "INVALID_ORIGIN" }, { status: 403 });
  return handler(req);
}
