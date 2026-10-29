import { ImageResponse } from "next/og";
import { getAppColours } from "@/lib/app-theme";
import { getBusiness } from "@/lib/booking";
import { initials } from "@/lib/format";
import { publicLogo } from "@/lib/public-logo";

export const dynamic = "force-dynamic";

/**
 * The square icon (app icon, browser tab, search engines): the one the owner made, else their logo
 * on white, else their initials in white on the app colour (black by default).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = Math.min(Math.max(Number(url.searchParams.get("size")) || 192, 48), 512);
  const maskable = url.searchParams.has("maskable");
  const business = await getBusiness();
  const { brand } = await getAppColours();
  const own = business?.icon ?? null;
  // Their logo only with the "Logo and text" design; otherwise their initials (see lib/public-logo).
  const shown = await publicLogo(business);
  const logo = shown && !shown.startsWith("data:image/svg") ? shown : null;
  const pad = Math.round(size * (maskable ? 0.2 : 0.1));
  return new ImageResponse(
    own ? (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={own} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "cover" }} />
      </div>
    ) : logo ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" style={{ maxWidth: size - pad * 2, maxHeight: size - pad * 2, objectFit: "contain" }} />
      </div>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand,
          color: "#fff",
          fontSize: size * 0.4,
          fontWeight: 700,
        }}
      >
        {initials(business?.name ?? "B")}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
