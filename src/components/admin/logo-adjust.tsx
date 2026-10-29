"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { prepareLogoUpload } from "@/app/[locale]/admin/_actions/pictures";

type Prepared = { image: string; cutout: string | null; background: string | null };

/** A picked file as a data URL: SVG kept (without scripts), others at most 1600 px PNG. */
async function readLogo(file: File): Promise<string | null> {
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    if (file.size > 300_000 || /<script|on\w+=|javascript:/i.test(text)) return null;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  // The load event, not decode(): decode() can wait forever in a background tab.
  const img = await new Promise<HTMLImageElement | null>((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = URL.createObjectURL(file);
  });
  if (!img) return null;
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/**
 * Picking a logo goes through "Adjust your logo": the empty margin is cut off on the server, then
 * the owner moves and sizes it (drag, pinch or the slider), can remove a plain background, and
 * sees it on the website and on print before saving. `adjust(original)` reopens it later.
 */
export function useLogoAdjust(o: { name: string; onSave: (logo: string, original: string) => void | Promise<void> }) {
  const t = useTranslations("admin.logoAdjust");
  const [src, setSrc] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function open(data: string | null) {
    setError(false);
    if (!data) return setError(true);
    setBusy(true);
    const prepared = await prepareLogoUpload(data).catch(() => null);
    setBusy(false);
    if (!prepared) return setError(true);
    setSrc(prepared);
  }
  return {
    busy,
    error: error ? t("error") : null,
    pick: async (file: File) => open(await readLogo(file).catch(() => null)),
    adjust: (original: string) => open(original),
    sheet: src && (
      <LogoAdjust
        key={src.image}
        name={o.name}
        source={src}
        onCancel={() => setSrc(null)}
        onSave={async (logo) => {
          await o.onSave(logo, src.image);
          setSrc(null);
        }}
      />
    ),
  };
}

function LogoAdjust({ name, source, onCancel, onSave }: { name: string; source: Prepared; onCancel: () => void; onSave: (logo: string) => void }) {
  const t = useTranslations("admin.logoAdjust");
  const [cut, setCut] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [out, setOut] = useState("");
  const [saving, setSaving] = useState(false);
  const frame = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const href = cut && source.cutout ? source.cutout : source.image;

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = href;
  }, [href]);

  // The result: the logo's own shape, the picture moved and sized inside it (smaller = some room around).
  useEffect(() => {
    if (!img || !frame.current) return;
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const c = frame.current;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const dw = w * zoom;
    const dh = h * zoom;
    ctx.drawImage(img, (w - dw) / 2 + pos.x * w, (h - dh) / 2 + pos.y * h, dw, dh);
    let url = c.toDataURL("image/png");
    // A logo stays light enough to keep with the salon.
    for (let k = 0.8; url.length > 650_000 && k > 0.2; k -= 0.15) {
      const s = document.createElement("canvas");
      s.width = Math.round(w * k);
      s.height = Math.round(h * k);
      s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
      url = s.toDataURL("image/png");
    }
    setOut(url);
  }, [img, zoom, pos]);

  const reset = () => {
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setCut(false);
  };
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    }
  };
  const move = (e: React.PointerEvent) => {
    const before = pointers.current.get(e.pointerId);
    if (!before) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoom(Math.min(2, Math.max(0.5, (pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d)));
      return;
    }
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos((p) => ({ x: Math.max(-0.5, Math.min(0.5, p.x + (e.clientX - before.x) / box.width)), y: Math.max(-0.5, Math.min(0.5, p.y + (e.clientY - before.y) / box.height)) }));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const preview = (bg: string, fg: string) => ({ background: bg, color: fg });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl md:rounded-3xl md:p-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted">{t("hint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="grid content-start gap-3">
            {/* Drag to move; two fingers (or the slider) to size it. The check pattern is see-through. */}
            <div
              className="relative grid aspect-square touch-none cursor-grab place-items-center overflow-hidden rounded-2xl border border-line"
              style={{ backgroundImage: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%)", backgroundSize: "16px 16px" }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <canvas ref={frame} className="max-h-[85%] max-w-[85%] outline-1 outline-brand/40 outline-dashed" />
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-medium">{t("size")}</span>
              <input type="range" min={0.5} max={2} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="accent-brand" />
            </label>
            {source.cutout && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} className="mt-0.5 size-5 accent-brand" />
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t("removeBg")}
                    {source.background && <span className="inline-block size-4 rounded border border-line" style={{ background: source.background }} />}
                  </span>
                  <span className="block text-xs text-muted">{t("removeBgHint")}</span>
                </span>
              </label>
            )}
          </div>
          <div className="grid content-start gap-3">
            <p className="text-sm font-medium">{t("onWebsite")}</p>
            {/* The website first: its header and the "Logo and text" top, on light and dark. */}
            {[preview("#ffffff", "#111111"), preview("#14171a", "#ffffff")].map((s, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line" style={s}>
                <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: i ? "#2a2d31" : "#eeeeee" }}>
                  {out && <img src={out} alt="" className="h-8 max-w-28 object-contain" />}
                  <span className="truncate text-sm font-semibold">{name}</span>
                  <span className="ml-auto text-lg leading-none">≡</span>
                </div>
                <div className="grid place-items-center px-3 py-5">{out && <img src={out} alt="" className="h-20 max-w-[70%] object-contain" />}</div>
              </div>
            ))}
            <p className="text-sm font-medium">{t("onPrint")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[preview("#ffffff", "#111111"), preview("#14171a", "#ffffff")].map((s, i) => (
                <div key={i} className="grid aspect-[85/55] place-items-center rounded-lg border border-line p-3 shadow-sm" style={s}>
                  {out && <img src={out} alt="" className="max-h-[60%] max-w-[80%] object-contain" />}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 mt-5 flex flex-wrap items-center gap-2 bg-white pt-2">
          <button type="button" onClick={reset} className="btn-ghost">
            ↺ {t("reset")}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onCancel} className="btn-ghost">
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={!out || saving}
            onClick={async () => {
              setSaving(true);
              await onSave(out);
              setSaving(false);
            }}
            className="btn-primary"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
