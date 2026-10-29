const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * The address the visitor is on: the Host header. Only when that is the server itself (Next.js
 * re-rendering after a form's redirect, or a proxy in front that talks to it on localhost) does the
 * visitor's address come from x-forwarded-host; anyone can send that header, so it isn't trusted otherwise.
 */
export function requestHost(h: { get(name: string): string | null }): string | null {
  const host = h.get("host");
  if (host && !LOCAL.has(hostname(host))) return host;
  return h.get("x-forwarded-host")?.split(",")[0].trim() || host;
}

export function hostname(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.replace(/:\d+$/, "").replace(/\.$/, "");
}
