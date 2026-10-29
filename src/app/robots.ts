import type { MetadataRoute } from "next";
import { getBusiness } from "@/lib/booking";
import { salonUrl } from "@/lib/salon-url";

export const dynamic = "force-dynamic";

/** Search engines may read the website and the booking page; everything private (admin, sign-in, links) stays out. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: { userAgent: "*", allow: ["/", "/api/icon", "/api/indexnow", "/api/site/photo"], disallow: ["/api/", "/*/admin", "/*/signin", "/*/setup", "/*/join/", "/*/manage/", "/*/unsubscribe/", "/*/website-preview"] },
    sitemap: `${salonUrl()}/sitemap.xml`,
  };
}
