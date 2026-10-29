"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  setCover,
  setIcon,
  setLogo,
  setStaffPhoto,
} from "@/app/[locale]/admin/_actions/pictures";
import { Camera, Check, Type, Upload } from "@/components/icons";
import {
  cutOutLogo,
  fileUrl,
  fitPhoto,
  HERO_SHAPES,
  imageSize,
  looksLikeFlyer,
  squarePhoto,
} from "@/lib/image-helpers";
import { shrinkLogo, shrinkPhoto } from "@/lib/shrink-image";
import { DeviceFrame, useHasCamera, type Device } from "./device-frame";

type What = "cover" | "logo" | "icon" | `staff:${string}`;
/** Below these, a photo is kept but the owner is told it may look blurry. */
const MIN = { icon: { w: 512, h: 512 }, team: { w: 600, h: 600 } };
const small = (s: { w: number; h: number }, min: { w: number; h: number }) =>
  Math.max(s.w, s.h) < Math.max(min.w, min.h) ||
  Math.min(s.w, s.h) < Math.min(min.w, min.h);

/**
 * The website preview with camera buttons on its pictures, like editing a cover photo on a social
 * profile: tap the cover, the logo or a team photo and change it right there (the square app icon
 * has its own row underneath). Shown as on a phone or as on a computer. Same processing as setup
 * (wide crop and light for the cover, cut-out for a photo of a card or sign).
 */
export function EditablePreview({
  src,
  title,
  height,
  className = "",
  highlight,
  logo,
  onChanged,
  appIcon = true,
}: {
  src: string;
  title: string;
  height: number;
  className?: string;
  highlight?: "cover" | "logo" | "icon";
  logo: string | null;
  onChanged?: (what: What) => void;
  /** The app icon row under the website (Settings); left out where it would only distract (setup). */
  appIcon?: boolean;
}) {
  const t = useTranslations("pictures");
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<What | null>(null);
  // The cover's shape comes with the click: wide behind the name, or upright beside it.
  const [shape, setShape] = useState<"photo" | "split">("photo");
  const [device, setDevice] = useState<Device>("phone");
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (
        e.origin !== window.location.origin ||
        e.source !== frame.current?.contentWindow ||
        e.data?.type !== "statio:edit"
      )
        return;
      const what = String(e.data.what);
      if (!(
        ["cover", "logo", "icon"].includes(what) ||
        /^staff:[0-9a-f-]{36}$/.test(what)
      ))
        return;
      setShape(e.data.layout === "split" ? "split" : "photo");
      setOpen(what as What);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  // Extra settings go before a "#piece-…" jump, which must stay last.
  const [path, hash = ""] = src.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return (
    <div className={className}>
      {/* As clients see it on a phone or on a computer (the computer one scaled down to fit). */}
      <div
        className="flex items-center justify-center gap-1 border-b border-line bg-white p-1.5"
        role="radiogroup"
        aria-label={t("device")}
      >
        {(["phone", "computer"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={device === d}
            onClick={() => setDevice(d)}
            className={`rounded-lg px-3 py-1 text-sm font-medium ${device === d ? "bg-ink text-white" : "text-muted"}`}
          >
            {t(d)}
          </button>
        ))}
      </div>
      <DeviceFrame
        ref={frame}
        key={`${version}-${device}`}
        title={title}
        device={device}
        height={height}
        src={`${path}${sep}edit=1${highlight && highlight !== "icon" ? `&highlight=${highlight}` : ""}&v=${version}${hash ? `#${hash}` : ""}`}
        className="bg-canvas"
      />
      {/* The square app icon lives outside the website itself: its own row, never over the page. */}
      {appIcon && (
        <div className="flex items-center gap-3 border-t border-line bg-white px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/icon?size=96&v=${version}`}
            alt=""
            className={`size-9 rounded-xl border border-line ${highlight === "icon" ? "ring-4 ring-ink" : ""}`}
          />
          <span className="flex-1 leading-tight">
            <span className="block text-sm font-semibold">{t("icon")}</span>
            <span className="block text-xs text-muted">{t("iconSize")}</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen("icon")}
            className="btn-ghost !min-h-9 !px-3 text-sm"
          >
            {t("change")}
          </button>
        </div>
      )}
      {open && (
        <PictureSheet
          what={open}
          shape={shape}
          logo={logo}
          onClose={(changed) => {
            if (changed) {
              setVersion((v) => v + 1);
              onChanged?.(open);
            }
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function PictureSheet({
  what,
  shape,
  logo,
  onClose,
}: {
  what: What;
  shape: "photo" | "split";
  logo: string | null;
  onClose: (changed: boolean) => void;
}) {
  const t = useTranslations("pictures");
  const [busy, start] = useTransition();
  const [error, setError] = useState(false);
  // Saved, but small: say so gently and let them pick a bigger one or carry on.
  const [warn, setWarn] = useState(false);
  const [check, setCheck] = useState<{
    cutOut: string;
    photo?: string;
    flyer?: boolean;
  } | null>(null);
  const [square, setSquare] = useState<string | null>(null);
  const [warnIcon, setWarnIcon] = useState(false);
  const hasCamera = useHasCamera();
  const staffId = what.startsWith("staff:") ? what.slice(6) : null;
  const kind = staffId ? "team" : what;

  const run = (fn: () => Promise<{ ok: boolean } | null>) =>
    start(async () => {
      setError(false);
      const r = await fn().catch(() => null);
      if (!r?.ok) return setError(true);
      onClose(true);
    });
  const runChecked = (
    fn: () => Promise<{ ok: boolean } | null>,
    size: Promise<{ w: number; h: number }>,
    min: { w: number; h: number },
  ) =>
    start(async () => {
      setError(false);
      const [r, s] = await Promise.all([
        fn().catch(() => null),
        size.catch(() => null),
      ]);
      if (!r?.ok) return setError(true);
      if (s && small(s, min)) return setWarn(true);
      onClose(true);
    });
  // "Take a photo" only where there's a camera (a phone); on a computer it would just open the file picker.
  const pick = (accept: string, camera: boolean, onFile: (f: File) => void) =>
    camera && !hasCamera ? null : (
      <label
        key={camera ? "camera" : "choose"}
        className={`${camera ? "btn-primary" : "btn-ghost"} cursor-pointer`}
      >
        {camera ? <Camera className="size-5" /> : <Upload className="size-5" />}{" "}
        {camera ? t("camera") : t("choose")}
        <input
          type="file"
          accept={accept}
          {...(camera && { capture: "environment" as const })}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </label>
    );

  return (
    <div
      className="fixed inset-0 z-50 grid items-end bg-black/50 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t(`${kind}Title` as "coverTitle")}
      onClick={(e) => e.target === e.currentTarget && onClose(warn)}
    >
      <div className="grid max-h-[90dvh] w-full gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t(`${kind}Title` as "coverTitle")}
            </h2>
            <p className="text-sm text-muted">
              {t(`${kind}Hint` as "coverHint")}
            </p>
            {kind === "cover" && (
              <p className="mt-1 text-sm font-medium">
                {t(shape === "split" ? "coverSizeSplit" : "coverSize")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClose(warn)}
            className="text-sm text-muted underline"
          >
            {t("close")}
          </button>
        </div>

        {warn && (
          <div className="grid gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t("small")}</p>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onClose(true)}
            >
              {t("done")}
            </button>
          </div>
        )}

        {what === "cover" && (
          <div className="grid gap-2">
            {[true, false].map((camera) =>
              pick("image/*", camera, (f) => {
                const src = fileUrl(f);
                const { ratio, min } = HERO_SHAPES[shape];
                runChecked(
                  async () =>
                    setCover((await fitPhoto(await src, ratio, min)).url),
                  src.then(imageSize),
                  min,
                );
              }),
            )}
          </div>
        )}

        {staffId && (
          <div className="grid gap-2">
            {[true, false].map((camera) =>
              pick("image/*", camera, (f) => {
                const src = fileUrl(f);
                runChecked(
                  async () =>
                    setStaffPhoto(staffId, await squarePhoto(await src, 600)),
                  src.then(imageSize),
                  MIN.team,
                );
              }),
            )}
          </div>
        )}

        {what === "logo" && !check && (
          <div className="grid gap-2">
            {pick("image/*", true, (f) =>
              start(async () => {
                setError(false);
                const photo = (
                  await shrinkPhoto(f, 1600, 1600).catch(() => null)
                )?.url;
                const cutOut = photo
                  ? await cutOutLogo(photo).catch(() => null)
                  : null;
                if (!photo || !cutOut) return setError(true);
                setCheck({ cutOut, photo });
              }),
            )}
            {hasCamera && (
              <p className="-mt-1 text-xs text-muted">{t("cameraLogoHint")}</p>
            )}
            {pick("image/png,image/jpeg,image/webp,image/svg+xml", false, (f) =>
              start(async () => {
                setError(false);
                const url = await shrinkLogo(f).catch(() => null);
                if (!url) return setError(true);
                // Shown first, with a gentle note when it looks more like a flyer than a logo.
                const flyer = url.startsWith("data:image/svg")
                  ? false
                  : await looksLikeFlyer(await fileUrl(f)).catch(() => false);
                setCheck({ cutOut: url, flyer });
              }),
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => run(() => setLogo(""))}
            >
              <Type className="size-5" /> {t("useName")}
            </button>
          </div>
        )}
        {what === "logo" && check && (
          <div className="grid gap-3">
            <p className="font-medium">{t("looksRight")}</p>
            <div
              className="grid min-h-32 place-items-center rounded-xl border border-line p-4"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(#f2f2f2 0% 25%, #ffffff 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={check.cutOut}
                alt=""
                className="max-h-40 max-w-full object-contain"
              />
            </div>
            {check.flyer && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {t("flyer")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => run(() => setLogo(check.cutOut))}
              >
                <Check className="size-5" /> {t("useIt")}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCheck(null)}
              >
                {t("tryAgain")}
              </button>
            </div>
          </div>
        )}

        {what === "icon" && !square && (
          <div className="grid gap-3">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/icon?size=192&v=${Date.now()}`}
                alt=""
                className="size-20 rounded-2xl border border-line"
              />
              {/* Their logo makes it only with "Logo and text" (the one design with a logo); else their initials. */}
              <p className="text-sm text-muted">
                {t(logo ? "iconNowLogo" : "iconNow")}
              </p>
            </div>
            {logo && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSquare(logo)}
              >
                {t("fromLogo")}
              </button>
            )}
            {[true, false].map((camera) =>
              pick("image/*", camera, async (f) => {
                const src = await fileUrl(f);
                const s = await imageSize(src).catch(() => null);
                setWarnIcon(Boolean(s && small(s, MIN.icon)));
                setSquare((await shrinkPhoto(f, 1200, 1200)).url);
              }),
            )}
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => run(() => setIcon(""))}
            >
              {t(logo ? "iconAutoLogo" : "iconAuto")}
            </button>
          </div>
        )}
        {what === "icon" && square && (
          <>
            {warnIcon && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {t("smallBefore")}
              </p>
            )}
            <SquareAdjust
              src={square}
              onCancel={() => setSquare(null)}
              onDone={(png) => run(() => setIcon(png))}
            />
          </>
        )}

        {busy && <p className="text-sm text-muted">{t("working")}</p>}
        {error && <p className="text-sm text-red-700">{t("error")}</p>}
      </div>
    </div>
  );
}

const FRAME = 260;

/** "Square version": move and zoom a picture in a square (white behind), saved as a 512 px PNG. */
function SquareAdjust({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (png: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("pictures");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const img = useRef<HTMLImageElement>(null);
  // At zoom 1 the whole picture fits the square.
  const base = size ? Math.min(FRAME / size.w, FRAME / size.h) : 1;
  const dw = (size?.w ?? 0) * base * zoom;
  const dh = (size?.h ?? 0) * base * zoom;

  const save = () => {
    if (!img.current) return;
    const k = 512 / FRAME;
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(
      img.current,
      (FRAME / 2 + pos.x - dw / 2) * k,
      (FRAME / 2 + pos.y - dh / 2) * k,
      dw * k,
      dh * k,
    );
    onDone(c.toDataURL("image/png"));
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">{t("adjust")}</p>
      <div
        className="relative mx-auto touch-none overflow-hidden rounded-2xl border border-line bg-white select-none"
        style={{ width: FRAME, height: FRAME }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        }}
        onPointerMove={(e) =>
          drag.current &&
          setPos({
            x: drag.current.px + e.clientX - drag.current.x,
            y: drag.current.py + e.clientY - drag.current.y,
          })
        }
        onPointerUp={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={img}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setSize({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className="pointer-events-none absolute max-w-none"
          style={{
            width: dw || undefined,
            height: dh || undefined,
            left: FRAME / 2 + pos.x - dw / 2,
            top: FRAME / 2 + pos.y - dh / 2,
          }}
        />
      </div>
      <label className="grid gap-1 text-sm">
        {t("zoom")}
        <input
          type="range"
          min={0.3}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="accent-ink"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={!size}
        >
          <Check className="size-5" /> {t("useIt")}
        </button>
      </div>
    </div>
  );
}
