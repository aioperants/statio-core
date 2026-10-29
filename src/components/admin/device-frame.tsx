"use client";
import { forwardRef, useEffect, useRef, useState } from "react";

/** Phones (a touch screen) get "Take a photo"; on a computer that would only open the file picker again. */
export function useHasCamera() {
  const [yes, setYes] = useState(false);
  useEffect(() => setYes(window.matchMedia("(pointer: coarse)").matches), []);
  return yes;
}

export type Device = "phone" | "computer";
const SIZES: Record<Device, { w: number; h: number }> = { phone: { w: 390, h: 780 }, computer: { w: 1366, h: 800 } };

/**
 * A page shown at a phone's or a computer's real width, scaled down to fit its box, so the owner sees
 * exactly what clients see on each (crops and all). `height` = the box's height; or `fit`: the box
 * takes the full width and is as tall as the page's content (at most a screen), with no empty space
 * below it (for a page showing one section, like the top of the website).
 */
export const DeviceFrame = forwardRef<HTMLIFrameElement, { src: string; device: Device; height?: number; fit?: boolean; title: string; className?: string }>(function DeviceFrame(
  { src, device, height = 0, fit = false, title, className = "" },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [width, setWidth] = useState(0);
  const real = SIZES[device];
  // With `fit`, how tall the page's content is (at its real width), once it has loaded.
  const [content, setContent] = useState(real.h);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const measure = () => {
    const doc = frame.current?.contentDocument;
    const el = doc?.querySelector<HTMLElement>(".site") ?? doc?.body;
    if (!el) return;
    const update = () => setContent(Math.min(real.h, Math.max(120, Math.ceil(el.getBoundingClientRect().height))));
    update();
    new ResizeObserver(update).observe(el);
  };
  // The page keeps its real width (and a real screen's height, as its layout expects); the box shows
  // it smaller. A phone is shown at most full size.
  const scale = width ? (fit ? Math.min(1, width / real.w) : Math.min(1, width / real.w, height / real.h)) : 0;
  const boxHeight = fit ? Math.round(content * scale) : height;
  return (
    <div ref={box} className={`relative w-full overflow-hidden ${className}`} style={{ height: boxHeight || undefined, minHeight: fit ? 80 : undefined }}>
      {scale > 0 && (
        <iframe
          ref={(el) => {
            frame.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          title={title}
          src={src}
          onLoad={fit ? measure : undefined}
          className="absolute top-0 left-1/2 origin-top border-0 bg-white"
          style={{ width: real.w, height: fit ? real.h : height / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      )}
    </div>
  );
});
