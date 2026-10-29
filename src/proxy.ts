import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);
const EMBEDDABLE = /^\/[a-z]{2}\/(book|manage)(\/|$)/;

export default function proxy(req: NextRequest) {
  const res = intl(req);
  if (/^\/[a-z]{2}(\/website-preview)?$/.test(req.nextUrl.pathname)) {
    // The website preview shows beside its settings: on the salon's own address only.
    res.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  } else if (EMBEDDABLE.test(req.nextUrl.pathname)) {
    // Only the salon's own website may show the booking pages in a frame. Read at request time,
    // so changing EMBED_ALLOWED_ORIGINS needs no rebuild.
    res.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${process.env.EMBED_ALLOWED_ORIGINS ?? ""}`.trim());
  } else {
    res.headers.set("X-Frame-Options", "DENY");
  }
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  // Pages only: skip API routes, Next internals and files such as embed.js or icons.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
