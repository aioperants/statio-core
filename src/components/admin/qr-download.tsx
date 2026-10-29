"use client";
import { qrSvg } from "@/lib/qr";

/** Saves the booking page's QR code as PNG or SVG. */
export async function downloadQr(url: string, salon: string, kind: "png" | "svg") {
  const svg = qrSvg(url);
  const a = document.createElement("a");
  a.download = `${salon.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "booking"}-qr.${kind}`;
  if (kind === "svg") a.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  else {
    const img = await new Promise<HTMLImageElement>((ok) => Object.assign(new Image(), { onload: function (this: HTMLImageElement) { ok(this); }, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }));
    const c = document.createElement("canvas");
    c.width = c.height = 1200;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 1200, 1200);
    a.href = c.toDataURL("image/png");
  }
  a.click();
}

export function QrDownload({ url, salon, label, kind = "png", className = "btn-ghost" }: { url: string; salon: string; label: string; kind?: "png" | "svg"; className?: string }) {
  return (
    <button type="button" onClick={() => downloadQr(url, salon, kind)} className={className}>
      ↓ {label}
    </button>
  );
}
