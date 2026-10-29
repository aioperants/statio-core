import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { UUID } from "@/db";

/**
 * The website's pictures, as files instead of text inside the page (keeps the page light):
 * `?k=hero` the published big photo, `?k=logo` the logo, `?k=<staff id>` a team member's photo
 * (people clients can book only), `?k=g:<id>` a gallery photo. Addresses carry a fingerprint (?v=), so browsers may keep them
 * for good; a new picture gets a new address.
 */
export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k") ?? "hero";
  let dataUrl: string | null | undefined;
  if (k === "hero") dataUrl = (await db.query.website.findFirst({ columns: { heroPublished: true } }))?.heroPublished;
  else if (k === "logo") dataUrl = (await db.query.business.findFirst({ columns: { logo: true } }))?.logo;
  else if (k.startsWith("g:") && UUID.test(k.slice(2)))
    dataUrl = (await db.query.websitePhoto.findFirst({ where: eq(schema.websitePhoto.id, k.slice(2)), columns: { data: true } }))?.data;
  else if (UUID.test(k))
    dataUrl = (
      await db.query.staff.findFirst({
        where: and(eq(schema.staff.id, k), eq(schema.staff.active, true), eq(schema.staff.bookable, true)),
        columns: { photo: true },
      })
    )?.photo;
  const m = /^data:(image\/(?:jpeg|png|webp|svg\+xml));base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "content-type": m[1],
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      // A logo may be an SVG: shown as a picture only, never run as a page.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
