"use client";
import { createTranslator, type AbstractIntlMessages } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Site, type SiteT } from "@/components/site/site";
import { LAYOUTS, type PieceKey, type SiteConfig } from "@/lib/site/config";
import { themeFor } from "@/lib/site/theme";
import type { SiteData } from "@/lib/site/types";

/**
 * The website inside the website editor (Settings › Website): drawn here in the browser, so every
 * change the owner makes shows at once. The editor around it sends the draft; this page sends back
 * what the owner taps (a section).
 *
 * Messages, same origin only:
 *   editor → here: { type: "studio:state", config, heroImage, logo, selected }
 *   here → editor: { type: "studio:ready" } · { type: "studio:select", key } · { type: "studio:swipe", by } · { type: "studio:edit", key }
 */

export type StudioKey = PieceKey | "footer";

type Words = {
  empty: Record<string, string>;
  emptyTap: string;
  swipe: string;
  prev: string;
  next: string;
  names: Record<string, string>;
  example: string;
  exampleLogo: string;
};

export function StudioSite(props: { config: SiteConfig; data: SiteData; messages: AbstractIntlMessages; fontClass: string; words: Words }) {
  const [config, setConfig] = useState(props.config);
  const [data, setData] = useState(props.data);
  const [selected, setSelected] = useState<StudioKey | null>(null);
  const t = useMemo(() => {
    const tr = createTranslator({ locale: props.data.locale, messages: { site: props.messages }, namespace: "site" });
    return ((key: string, values?: Record<string, string | number>) => tr(key as never, values as never)) as SiteT;
  }, [props.messages, props.data.locale]);
  const send = (msg: object) => window.parent !== window && window.parent.postMessage(msg, window.location.origin);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // The editor's state, as it changes.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "studio:state") return;
      setConfig(e.data.config);
      setData((d) => ({ ...d, heroImage: e.data.heroImage ?? null, logo: e.data.logo ?? null }));
      if (e.data.selected !== selectedRef.current) {
        setSelected(e.data.selected);
        if (e.data.selected && e.data.scroll) document.getElementById(`piece-${e.data.selected}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("message", on);
    send({ type: "studio:ready" });
    return () => window.removeEventListener("message", on);
  }, []);

  // A tap picks the section under it (links and buttons do nothing here); tapping it again opens its settings.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-studio-ui]")) return;
      e.preventDefault();
      const piece = el.closest<HTMLElement>("[id^='piece-']");
      const key = (piece?.id.slice(6) ?? null) as StudioKey | null;
      if (key && key === selectedRef.current) return send({ type: "studio:edit", key });
      setSelected(key);
      send({ type: "studio:select", key });
    };
    // Forms (contact) never send from here.
    const submit = (e: Event) => e.preventDefault();
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
    };
  }, []);

  const theme = themeFor(config.direction, data.brandColor, config.palette);
  const w = props.words;
  return (
    <>
      <style>{`html,body{background:${theme.bg}}
body{padding-bottom:9rem}
.s-header{position:static!important}
[id^='piece-']{position:relative;cursor:pointer;scroll-margin-top:12px}
[data-studio-selected]{outline:3px solid #0a0a0a;outline-offset:-3px;box-shadow:inset 0 0 0 6px rgba(255,255,255,.85)}
[id^='piece-']:not([data-studio-selected]):hover{outline:2px dashed rgba(10,10,10,.35);outline-offset:-2px}
.studio-pill{bottom:6rem}
@media (min-width:768px){.studio-pill{bottom:1.5rem}}`}</style>
      <Site
        config={config}
        data={data}
        t={t}
        fontClass={props.fontClass}
        exampleLabel={w.example}
        exampleLogoLabel={w.exampleLogo}
        empty={(key) => (
          <div className="mx-auto grid max-w-6xl place-items-center px-4 py-10 md:px-8">
            <div className="grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center" style={{ borderColor: theme.line }}>
              <p className="s-h text-xl">{w.names[key]}</p>
              <p className="s-muted text-sm">{w.empty[key] ?? ""}</p>
              <p className="s-muted text-sm font-semibold">{w.emptyTap}</p>
            </div>
          </div>
        )}
      />
      {selected && <Selection key={selected} which={selected} config={config} words={w} />}
    </>
  );
}

/**
 * The outline on the selected section, and its name, kept at the bottom of the screen, within thumb
 * reach, above the editor's tools (Statio Core: one design per section, so no design arrows).
 */
function Selection({ which, words }: { which: StudioKey; config: SiteConfig; words: Words }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const found = document.getElementById(`piece-${which}`);
    found?.setAttribute("data-studio-selected", "");
    setEl(found);
    return () => found?.removeAttribute("data-studio-selected");
  });
  if (!el) return null;
  return createPortal(
    <div data-studio-ui className="studio-pill fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#0a0a0a] p-1 text-white shadow-lg" style={{ fontFamily: "system-ui, sans-serif" }}>
      <span className="px-2 text-center text-[13px] leading-tight font-semibold whitespace-nowrap">
        {words.names[which]}
      </span>
    </div>,
    document.body,
  );
}
