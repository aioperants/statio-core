import type { MetadataRoute } from "next";
import { currentSalonId } from "@/db";
import { publicSite } from "@/lib/site/data";
import { salonUrl } from "@/lib/salon-url";

export const dynamic = "force-dynamic";

/** The public pages, in the language clients see: the website (when it's on) and the booking page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const id = await currentSalonId();
  const site = id ? await publicSite(id) : null;
  if (!site?.setupDone) return [];
  const base = salonUrl();
  const book = { url: `${base}${site.data.bookUrl}`, changeFrequency: "weekly" as const };
  return site.enabled
    ? [
        { url: `${base}/${site.data.locale}`, changeFrequency: "weekly", priority: 1 },
        { ...book, priority: 0.9 },
      ]
    : [{ ...book, priority: 1 }];
}
