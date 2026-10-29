import type { MetadataRoute } from "next";
import { getAppColours } from "@/lib/app-theme";
import { getBusiness } from "@/lib/booking";

export const dynamic = "force-dynamic";

/** Makes the admin installable on a phone ("Add to Home Screen"), with the salon's own name and logo. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [business, colours] = await Promise.all([getBusiness(), getAppColours()]);
  const name = business?.name ?? "Bookings";
  return {
    name,
    short_name: name.length > 12 ? name.split(" ")[0] : name,
    start_url: `/${business?.defaultLocale ?? "es"}/admin`,
    scope: "/",
    display: "standalone",
    background_color: colours.canvas,
    theme_color: colours.brand,
    icons: [
      { src: "/api/icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/api/icon?size=512", sizes: "512x512", type: "image/png" },
      { src: "/api/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
