"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field } from "@/components/admin/ui";
import { ArrowDown, ArrowUp, Camera, Check, ChevronLeft, Close, Eye, EyeOff, Layers, Monitor, Pencil, Phone2, Sliders, Sparkle } from "@/components/icons";
import { fileUrl, fitPhoto, HERO_SHAPES, squarePhoto } from "@/lib/image-helpers";
import { shrinkPhoto } from "@/lib/shrink-image";
import { LIMITS, readConfig, type Piece, type PieceKey, type SiteConfig } from "@/lib/site/config";
import { pieceHasContent } from "@/lib/site/content";
import { palettesOf, themeFor } from "@/lib/site/theme";
import { setStaffPhoto } from "../_actions/pictures";
import { useLogoAdjust } from "@/components/admin/logo-adjust";
import { saveAdjustedLogo } from "../_actions/pictures";
import { addGalleryPhoto, publishWebsite, saveDraft, setHeroPhoto, setLogo, setWebsiteOn } from "../_actions/website";
import {
  AboutPhoto,
  FaqEditor,
  Gallery,
  HeroPhoto,
  Switch,
  TypeScreen,
  type Drafts,
  type StudioProps,
} from "./parts";

/**
 * The website editor (Settings › Website): the owner's real website fills the screen and is edited
 * where it is. Tap a section to pick it (Statio Core: one design per section, in a fixed order); a floating palette
 * (on the right on a tablet or computer, along the bottom on a phone) holds the tools: with nothing
 * picked, photos, style and sections; with a section picked, edit, hide and move. Changes save by
 * themselves and show at once; clients see them after "Publish".
 */

type Key = PieceKey | "footer";
type Sheet = { kind: "photos" } | { kind: "sections" } | { kind: "more" } | { kind: "section"; key: Key } | null;

/** Where each section's information lives in the app (admin paths). */
const FIX: Partial<Record<PieceKey, { href: string; label: "goServices" | "goTeam" | "goDetails" | "goHours" }>> = {
  services: { href: "/services", label: "goServices" },
  team: { href: "/staff", label: "goTeam" },
  hours: { href: "/settings/hours", label: "goHours" },
  contact: { href: "/salon", label: "goDetails" },
};

/** Colours salons often use, to start from. Any colour works: the website keeps text readable. */
const BRAND_IDEAS = ["#7A2E5A", "#B5838D", "#C9A227", "#2E5E45", "#1F3A5F", "#6E1F24", "#9C4A2F", "#3D6E9E", "#E63946", "#1D1A1F"];

const HINT_KEY = "statio.studio.hint";
const same = (a: SiteConfig, b: SiteConfig) => JSON.stringify(readConfig(a)) === JSON.stringify(readConfig(b));

export function Studio(props: StudioProps) {
  const t = useTranslations("admin.website");
  const ts = useTranslations("admin.website.studio");
  const [c, setConfig] = useState<SiteConfig>(props.initial);
  const [published, setPublished] = useState(props.published);
  const [hero, setHero] = useState(props.hero);
  const [heroSize, setHeroSize] = useState<{ w: number; h: number } | null>(null);
  const [heroPending, setHeroPending] = useState(props.heroPending);
  const [logo, setLogoNow] = useState(props.logo);
  const [enabled, setEnabled] = useState(props.enabled);
  const [selected, setSelected] = useState<Key | null>(null);
  const [sheet, setSheet] = useState<Sheet>(props.picture === "cover" || props.picture === "logo" ? { kind: "photos" } : props.part === "about" ? { kind: "section", key: "about" } : null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [device, setDevice] = useState<"phone" | "computer">("computer");
  const [frame, setFrame] = useState(0);
  const [hint, setHint] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(JSON.stringify(props.initial));
  const scrollNext = useRef(false);
  const selectedRef = useRef<Key | null>(null);
  selectedRef.current = selected;

  const v = c;
  const brand = v.brandColor ?? props.brandColor;
  const th = themeFor(v.direction, brand, v.palette);
  const art = { bg: th.bg, surface: th.surface, tint: th.tint, accent: th.button, text: th.text, line: th.line };
  const heroLayout = c.pieces.find((p) => p.key === "hero")!.layout;
  const has = (key: PieceKey) => pieceHasContent(key, c, props.facts);
  const name = (key: Key) => (key === "footer" ? t("footerRow") : key === "about" && c.solo ? t("aboutMe") : key === "gallery" && c.solo ? t("galleryMe") : t(`pieces.${key}.name`));

  const set = useCallback((patch: Partial<SiteConfig>) => {
    setJustPublished(false);
    setConfig((x) => ({ ...x, ...patch }));
  }, []);
  const setPiece = (key: PieceKey, patch: Partial<Piece>) => set({ pieces: c.pieces.map((p) => (p.key === key ? { ...p, ...patch } : p)) });

  // The website in the frame follows every change at once.
  const post = useCallback(
    (scroll = false) =>
      frameRef.current?.contentWindow?.postMessage({ type: "studio:state", config: v, heroImage: hero, logo, selected, scroll }, window.location.origin),
    [v, hero, logo, selected],
  );
  useEffect(() => {
    post(scrollNext.current);
    scrollNext.current = false;
  }, [post]);

  // Saved a moment after each change, so nothing is lost.
  useEffect(() => {
    const json = JSON.stringify(c);
    if (json === saved.current) return;
    setSaving("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveDraft(c);
      saved.current = json;
      setSaving("saved");
    }, 600);
  }, [c]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saving === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  // The first time: one line on how it works.
  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) setHint(true);
    } catch {}
    if (window.matchMedia("(max-width: 767px)").matches) setDevice("phone");
  }, []);
  const closeHint = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
  };

  // What the owner does on the website itself.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || typeof e.data?.type !== "string") return;
      if (e.data.type === "studio:ready") post();
      if (e.data.type === "studio:select") {
        setSelected(e.data.key);
        setHint(false);
        setSheet((s) => (s?.kind === "section" && e.data.key ? { kind: "section", key: e.data.key } : s?.kind === "section" ? null : s));
      }
      if (e.data.type === "studio:edit") setSheet({ kind: "section", key: e.data.key });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [post]);
  const pick = (key: Key | null, scroll = true) => {
    scrollNext.current = scroll;
    setSelected(key);
  };

  async function publish() {
    setPublishing(true);
    if (timer.current) clearTimeout(timer.current);
    await saveDraft(c);
    await publishWebsite();
    saved.current = JSON.stringify({ ...c, brandColor: null });
    setConfig((x) => ({ ...x, brandColor: null }));
    setPublished({ ...c, brandColor: null });
    setHeroPending(false);
    setEnabled(true);
    setSaving("idle");
    setPublishing(false);
    setJustPublished(true);
  }

  /** A cover photo: cut to the design's shape. Adding one to the marquee or logo top switches to "Big photo". */
  async function changeHero(file: File | null) {
    const layout = file && (heroLayout === "marquee" || heroLayout === "brand") ? "photo" : heroLayout;
    const shape = layout === "split" ? HERO_SHAPES.split : HERO_SHAPES.photo;
    const fitted = file ? await fileUrl(file).then((src) => fitPhoto(src, shape.ratio, shape.min)) : null;
    const res = await setHeroPhoto(fitted?.url ?? "");
    if (!res.ok) return false;
    setHero(fitted?.url ?? null);
    setHeroSize(fitted ? { w: fitted.report.width, h: fitted.report.height } : null);
    setHeroPending(true);
    if (layout !== heroLayout) setPiece("hero", { layout });
    else setJustPublished(false);
    return true;
  }

  const pending = !published || !same(published, c) || heroPending;
  const live = enabled && !!published;
  const sel = selected && selected !== "footer" ? c.pieces.find((p) => p.key === selected) : null;
  const missing = [!hero, c.gallery.length < 6, !c.about.trim()].filter(Boolean).length;

  /* ---------- Sheets ---------- */

  const sectionsSheet = (
    <div className="grid gap-4">
      <p className="text-sm text-muted">{ts("sectionsHint")}</p>
      <ul className="card divide-y divide-line">
        {v.pieces
          .filter((p) => p.on)
          .map((p) => (
            <li key={p.key} className="flex items-center gap-1 py-1.5 pr-2 pl-4">
              <button
                type="button"
                onClick={() => {
                  pick(p.key);
                  setSheet(null);
                }}
                className="min-w-0 flex-1 py-1.5 text-left"
              >
                <span className="block font-medium">{name(p.key)}</span>
                <span className="block truncate text-sm text-muted">{has(p.key) ? t(`pieces.${p.key}.about`) : ts("emptyShort")}</span>
              </button>
              <IconButton label={ts("hide")} onClick={() => setPiece(p.key, { on: false })}>
                <Eye className="size-4" />
              </IconButton>
            </li>
          ))}
      </ul>
      {c.pieces.some((p) => !p.on) && (
        <section className="grid gap-2">
          <h3 className="px-1 text-sm font-semibold text-muted">{ts("hidden")}</h3>
          <ul className="card divide-y divide-line">
            {v.pieces
              .filter((p) => !p.on)
              .map((p) => (
                <li key={p.key} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-muted">{name(p.key)}</span>
                    <span className="block text-sm text-muted">{t(`pieces.${p.key}.about`)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPiece(p.key, { on: true });
                      pick(p.key);
                    }}
                    className="btn-ghost !min-h-9 shrink-0 !px-3 text-sm"
                  >
                    <EyeOff className="size-4" /> {ts("show")}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );

  const moreSheet = (
    <div className="grid gap-4">
      {published && (
        <section className="card p-4">
          <Switch label={t("switchLabel")} hint={t("switchHint")} checked={enabled} onChange={async (v) => setEnabled((await setWebsiteOn(v)).enabled)} />
        </section>
      )}
      <h3 className="px-1 font-semibold">{t("typeTitle")}</h3>
      <TypeScreen c={c} set={set} />
      <h3 className="px-1 font-semibold">{t("footerRow")}</h3>
      <FooterFields c={c} set={set} />
    </div>
  );

  function sectionSheet(key: Key) {
    if (key === "footer") return <FooterFields c={c} set={set} />;
    const p = c.pieces.find((x) => x.key === key)!;
    const fix = FIX[key];
    return (
      <div className="grid gap-4">
        {content(key)}
        {fix && (
          <a href={`/${props.locale}/admin${fix.href}`} className="card flex items-center justify-between gap-3 p-4">
            <span>
              <span className="block font-medium">{t(fix.label)}</span>
              <span className="block text-sm text-muted">{has(key) ? t("fromTheApp") : t("hiddenUntil", { why: t(`pieces.${key}.why`) })}</span>
            </span>
            <span className="text-muted">›</span>
          </a>
        )}
      </div>
    );
  }

  /** What the owner writes or adds in each section. */
  function content(key: PieceKey) {
    switch (key) {
      case "hero":
        return (
          <>
            {/* "Logo and text" only (the other designs always show the name): first, without scrolling. Off when the logo already says the name. */}
            {heroLayout === "brand" && (
              <label className="card flex cursor-pointer items-start gap-3 p-4">
                <input type="checkbox" checked={c.heroName} onChange={(e) => set({ heroName: e.target.checked })} className="mt-0.5 size-5 accent-brand" />
                <span>
                  <span className="block font-medium">{ts("heroName")}</span>
                  <span className="block text-sm text-muted">{ts("heroNameHint")}</span>
                </span>
              </label>
            )}
            <section className="card grid gap-2 p-4">
              <Field label={t("tagline")} hint={t("taglineHint")}>
                <input key={c.tagline} className="field" maxLength={LIMITS.tagline} defaultValue={c.tagline} onBlur={(e) => e.target.value !== c.tagline && set({ tagline: e.target.value })} />
              </Field>
            </section>
            {heroLayout === "marquee" ? (
              <section className="card grid gap-3 p-4">
                <p className="text-sm text-muted">{ts("marqueeHint")}</p>
                <PhotoButton label={ts("addCover")} onFile={(f) => changeHero(f)} />
              </section>
            ) : (
              <HeroPhoto design="photo" hero={hero} size={heroSize} onChange={changeHero} art={art} />
            )}
          </>
        );
      case "about":
        return (
          <section className="card grid gap-4 p-4">
            <AboutDraft drafts={props.drafts} name={props.salonName} town={props.salonTown} hasText={!!c.about.trim()} onDraft={(about) => set({ about })} />
            <Field label={name("about")} hint={t("aboutHint")}>
              <textarea key={c.about} rows={7} className="field" maxLength={LIMITS.about} defaultValue={c.about} onBlur={(e) => e.target.value !== c.about && set({ about: e.target.value })} />
            </Field>
            <p className="-mt-2 text-xs text-muted">{t("textsHint", { language: props.salonLanguage })}</p>
            {c.pieces.find((x) => x.key === "about")?.layout.startsWith("split") && (
              <AboutPhoto id={c.aboutPhoto} hero={hero} art={art} onChange={(aboutPhoto) => set({ aboutPhoto })} />
            )}
          </section>
        );
      case "gallery":
        return <Gallery gallery={c.gallery} onChange={(gallery) => set({ gallery })} art={art} services={props.services} />;
      case "faq":
        return (
          <>
            <Suggestions questions={props.drafts.questions} faq={c.faq} onAdd={(f) => set({ faq: [...c.faq, f].slice(0, LIMITS.faqCount) })} />
            <FaqEditor key={c.faq.length} faq={c.faq} onChange={(faq) => set({ faq })} />
          </>
        );
      case "services":
        return (
          <section className="card grid gap-3 p-4">
            <Switch label={t("showPrices")} hint={t("showPricesHint")} checked={c.showPrices} onChange={(v) => set({ showPrices: v })} />
            <p className="text-sm text-muted">{t("descriptionsHint")}</p>
          </section>
        );
      case "contact":
        return (
          <>
            <section className="card grid gap-3 p-4">
              <Switch label={t("whatsapp")} hint={t("whatsappHint")} checked={c.whatsapp} onChange={(v) => set({ whatsapp: v })} />
            </section>
            {/* Statio Core: the business email instead of a contact form. */}
            <section className="card grid gap-3 p-4">
              <Switch label={t("showEmail")} hint={props.facts.email ?? t("showEmailNone")} checked={c.showEmail} onChange={(v) => set({ showEmail: v })} />
            </section>
          </>
        );
      default:
        return null;
    }
  }

  const photosSheet = (
    <WhatYouNeed
      c={c}
      hero={hero}
      team={props.team}
      art={art}
      onCover={changeHero}
      onGallery={(gallery) => set({ gallery, pieces: c.pieces.map((p) => (p.key === "gallery" ? { ...p, on: true } : p)) })}
      onAbout={(aboutPhoto) =>
        set({ aboutPhoto, pieces: c.pieces.map((p) => (p.key === "about" ? { ...p, on: true, layout: aboutPhoto && p.layout === "text" ? "split" : p.layout } : p)) })
      }
      onTeam={() => setFrame((k) => k + 1)}
      onGo={(key) => setSheet({ kind: "section", key })}
    />
  );

  const sheetTitle =
    sheet?.kind === "photos" ? ts("photosTitle") : sheet?.kind === "sections" ? ts("sectionsTitle") : sheet?.kind === "more" ? ts("moreTitle") : sheet?.kind === "section" ? name(sheet.key) : "";

  /* ---------- The screen ---------- */

  return (
    <div className="statio fixed inset-0 z-40 flex flex-col bg-[#ececee]">
      {/* Top: back, where it stands, and Publish. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-white px-2 md:px-4">
        <Link href={`/${props.locale}/admin/settings/website`} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-canvas" aria-label={ts("close")}>
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{t("title")}</p>
          <p className="truncate text-xs text-muted" aria-live="polite">
            {justPublished ? ts("publishedNow") : saving === "saving" ? t("saving") : pending ? ts("draft") : live ? ts("upToDate") : t("off")}
          </p>
        </div>
        <div className="hidden items-center rounded-full bg-canvas p-1 md:flex" role="group" aria-label={ts("device")}>
          {(["phone", "computer"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`grid h-8 w-10 place-items-center rounded-full ${device === d ? "bg-white shadow-sm" : "text-muted"}`} aria-label={ts(d)} title={ts(d)}>
              {d === "phone" ? <Phone2 className="size-4" /> : <Monitor className="size-4" />}
            </button>
          ))}
        </div>
        {live && (
          <a href={props.siteHref} target="_blank" className="hidden h-10 items-center rounded-full border border-line px-4 text-sm font-medium sm:inline-flex">
            {t("view")} ↗
          </a>
        )}
        <button type="button" disabled={!pending || publishing || saving === "saving"} onClick={publish} className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-white disabled:opacity-35">
          {publishing ? t("publishing") : ts("publish")}
        </button>
      </header>

      {/* The website itself. */}
      <div className={`relative min-h-0 flex-1 ${sheet ? "md:pr-[26rem]" : ""}`}>
        <div className={`mx-auto h-full ${device === "phone" ? "md:max-w-[400px] md:py-6" : ""}`}>
          <iframe
            key={frame}
            ref={frameRef}
            src={`/${props.locale}/website-preview?studio=1`}
            title={t("preview")}
            className={`block size-full bg-white ${device === "phone" ? "md:rounded-[2rem] md:border-[6px] md:border-ink md:shadow-xl" : ""}`}
          />
        </div>

        {hint && (
          <div className="absolute inset-x-3 top-3 z-10 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink p-4 text-sm text-white shadow-xl">
            <Sparkle className="mt-0.5 size-5 shrink-0" />
            <p className="flex-1">{ts("hint")}</p>
            <button type="button" onClick={closeHint} className="shrink-0 font-semibold underline">
              {ts("gotIt")}
            </button>
          </div>
        )}

        {/* The floating palette: bottom on a phone, right side on a tablet or computer. */}
        <nav
          aria-label={ts("tools")}
          className={`absolute z-20 flex gap-1 rounded-[1.75rem] border border-white/60 bg-white/80 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.18)] backdrop-blur-xl inset-x-3 bottom-3 justify-around md:inset-x-auto md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:flex-col md:justify-start ${sheet ? "max-md:hidden md:right-[27rem]" : "md:right-4"}`}
        >
          {sel ? (
            <>
              <Tool label={ts("edit")} onClick={() => setSheet({ kind: "section", key: sel.key })} strong>
                <Pencil className="size-5" />
              </Tool>
              <Tool
                label={ts("hide")}
                onClick={() => {
                  setPiece(sel.key, { on: false });
                  pick(null, false);
                }}
              >
                <EyeOff className="size-5" />
              </Tool>
              <Tool label={ts("done")} onClick={() => pick(null, false)}>
                <Check className="size-5" />
              </Tool>
            </>
          ) : selected === "footer" ? (
            <>
              <Tool label={ts("edit")} onClick={() => setSheet({ kind: "section", key: "footer" })} strong>
                <Pencil className="size-5" />
              </Tool>
              <Tool label={ts("done")} onClick={() => pick(null, false)}>
                <Check className="size-5" />
              </Tool>
            </>
          ) : (
            <>
              <Tool label={ts("photos")} onClick={() => setSheet({ kind: "photos" })} badge={missing || undefined}>
                <Camera className="size-5" />
              </Tool>
              <Tool label={ts("sections")} onClick={() => setSheet({ kind: "sections" })}>
                <Layers className="size-5" />
              </Tool>
              <Tool label={ts("more")} onClick={() => setSheet({ kind: "more" })}>
                <Sliders className="size-5" />
              </Tool>
            </>
          )}
        </nav>

        {/* The sheet: from the bottom on a phone, a panel on the right on a tablet or computer. */}
        {sheet && (
          <>
            <button type="button" aria-label={ts("closeSheet")} onClick={() => setSheet(null)} className="absolute inset-0 z-20 bg-black/25 md:hidden" />
            <section
              role="dialog"
              aria-label={sheetTitle}
              className="absolute inset-x-0 bottom-0 z-30 flex max-h-[80%] flex-col rounded-t-3xl bg-white shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[26rem] md:rounded-none md:border-l md:border-line md:shadow-none"
            >
              <div className="shrink-0 border-b border-line px-4 pt-2 pb-3 md:pt-4">
                <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
                <div className="flex items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{sheetTitle}</h2>
                  <button type="button" onClick={() => setSheet(null)} className="grid size-9 place-items-center rounded-full bg-canvas" aria-label={ts("closeSheet")}>
                    <Close className="size-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
                {sheet.kind === "photos" && photosSheet}
                {sheet.kind === "sections" && sectionsSheet}
                {sheet.kind === "more" && moreSheet}
                {sheet.kind === "section" && sectionSheet(sheet.key)}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Parts ---------- */

function Tool({ label, onClick, children, disabled, strong, badge }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; strong?: boolean; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={badge ? `${label} (${badge})` : label}
      className={`relative grid min-w-14 place-items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-medium disabled:opacity-30 md:w-16 ${strong ? "bg-ink text-white" : "text-ink hover:bg-black/5"}`}
    >
      {children}
      <span className="leading-tight">{label}</span>
      {badge ? <span className="absolute top-0.5 right-1.5 grid size-4 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{badge}</span> : null}
    </button>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-canvas disabled:opacity-25">
      {children}
    </button>
  );
}

/** A button that opens the camera or photos (several at once with `multiple`). */
function PhotoButton({ label, onFile, onFiles, busy }: { label: string; onFile?: (f: File) => void; onFiles?: (f: FileList) => void; busy?: boolean }) {
  return (
    <label className={`btn-ghost cursor-pointer justify-self-start ${busy ? "pointer-events-none opacity-50" : ""}`}>
      <Camera className="size-4" /> {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={!!onFiles}
        className="sr-only"
        onChange={(e) => {
          if (!e.target.files?.length) return;
          if (onFiles) onFiles(e.target.files);
          else onFile?.(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FooterFields({ c, set }: { c: SiteConfig; set: (p: Partial<SiteConfig>) => void }) {
  const t = useTranslations("admin.website");
  return (
    <section className="card grid gap-4 p-4">
      <p className="text-sm text-muted">{t("legalHint")}</p>
      <Field label={t("legalName")}>
        <input className="field" maxLength={LIMITS.legal} defaultValue={c.legalName} onBlur={(e) => e.target.value !== c.legalName && set({ legalName: e.target.value })} />
      </Field>
      <Field label={t("taxId")}>
        <input className="field" maxLength={20} defaultValue={c.taxId} onBlur={(e) => e.target.value !== c.taxId && set({ taxId: e.target.value })} />
      </Field>
    </section>
  );
}

/**
 * "What you need": the photos that make the website, each with why it matters, the shape, and a
 * button straight to the camera roll. Nothing is required: the website works without any of them.
 */
function WhatYouNeed(props: {
  c: SiteConfig;
  hero: string | null;
  team: StudioProps["team"];
  art: { bg: string; surface: string; tint: string; accent: string; text: string; line: string };
  onCover: (f: File | null) => Promise<boolean>;
  onGallery: (g: SiteConfig["gallery"]) => void;
  onAbout: (id: string) => void;
  onTeam: () => void;
  onGo: (key: PieceKey) => void;
}) {
  const ts = useTranslations("admin.website.studio");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [teamPhotos, setTeamPhotos] = useState(() => Object.fromEntries(props.team.map((m) => [m.id, m.photo])));
  const run = async (what: string, job: () => Promise<boolean>) => {
    setBusy(what);
    setError(false);
    const ok = await job().catch(() => false);
    setBusy(null);
    if (!ok) setError(true);
  };
  const work = props.c.gallery.length;
  const teamDone = props.team.filter((m) => teamPhotos[m.id]).length;

  async function addWork(files: FileList) {
    const added: SiteConfig["gallery"] = [];
    let ok = true;
    for (const file of [...files].slice(0, LIMITS.photos - props.c.gallery.length)) {
      const res = await addGalleryPhoto((await shrinkPhoto(file, 1400, 1400).catch(() => null))?.url ?? "");
      if ("id" in res) added.push({ id: res.id, caption: "" });
      else ok = false;
    }
    if (added.length) props.onGallery([...props.c.gallery, ...added]);
    return ok;
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">{ts("photosIntro")}</p>
      <Need done={!!props.hero} title={ts("need.cover.title")} why={ts("need.cover.why")} shape={ts("need.cover.shape")} status={props.hero ? ts("added") : ts("recommended")}>
        {props.hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.hero} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />
        )}
        <div className="flex flex-wrap gap-2">
          <PhotoButton label={props.hero ? ts("change") : ts("addCover")} busy={busy === "cover"} onFile={(f) => run("cover", () => props.onCover(f))} />
          {props.hero && (
            <button type="button" className="btn-ghost" onClick={() => run("cover", () => props.onCover(null))}>
              {ts("remove")}
            </button>
          )}
        </div>
      </Need>

      <Need done={work >= 6} title={ts("need.work.title")} why={ts("need.work.why")} shape={ts("need.work.shape")} status={ts("photosOf", { n: work })}>
        {work > 0 && (
          <ul className="grid grid-cols-4 gap-1.5">
            {props.c.gallery.slice(0, 8).map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/site/photo?k=g:${p.id}`} alt="" className="aspect-square w-full rounded-lg object-cover" />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {work < LIMITS.photos && <PhotoButton label={ts("addSeveral")} busy={busy === "work"} onFiles={(f) => run("work", () => addWork(f))} />}
          {work > 0 && (
            <button type="button" className="btn-ghost" onClick={() => props.onGo("gallery")}>
              {ts("captions")}
            </button>
          )}
        </div>
      </Need>

      <Need done={!!props.c.aboutPhoto} title={ts("need.about.title")} why={ts("need.about.why")} shape={ts("need.about.shape")} status={props.c.aboutPhoto ? ts("added") : ts("optional")}>
        <AboutPhoto id={props.c.aboutPhoto} hero={null} art={props.art} onChange={props.onAbout} />
      </Need>

      {props.team.length > 1 && (
        <Need done={teamDone === props.team.length} title={ts("need.team.title")} why={ts("need.team.why")} shape={ts("need.team.shape")} status={ts("teamOf", { n: teamDone, total: props.team.length })}>
          <ul className="grid gap-2">
            {props.team.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas text-sm font-semibold">
                  {teamPhotos[m.id] ? <Check className="size-4" /> : m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <PhotoButton
                  label={teamPhotos[m.id] ? ts("change") : ts("add")}
                  busy={busy === m.id}
                  onFile={(f) =>
                    run(m.id, async () => {
                      const ok = (await setStaffPhoto(m.id, await squarePhoto(await fileUrl(f)))).ok;
                      if (ok) {
                        setTeamPhotos((x) => ({ ...x, [m.id]: true }));
                        props.onTeam();
                      }
                      return ok;
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{ts("need.team.note")}</p>
        </Need>
      )}


      {error && <p className="text-sm text-red-700">{ts("photoError")}</p>}

      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">{ts("tipsTitle")}</summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm">
          {(["light", "tidy", "shape", "team", "consent"] as const).map((k) => (
            <li key={k}>
              <span className="font-medium">{ts(`tips.${k}.title`)}</span> <span className="text-muted">{ts(`tips.${k}.text`)}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Need({ done, title, why, shape, status, children }: { done: boolean; title: string; why: string; shape: string; status: string; children: React.ReactNode }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${done ? "bg-ink text-white" : "border-2 border-line"}`}>{done && <Check className="size-4" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-muted">{status}</span>
        </span>
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="grid gap-3 border-t border-line p-4">
        <p className="text-sm">{why}</p>
        <p className="justify-self-start rounded-full bg-canvas px-3 py-1 text-xs font-medium">{shape}</p>
        {children}
      </div>
    </details>
  );
}


/**
 * "Help me start": three short questions, and a first About text in the website's language made
 * from the answers: a ready-made text filled in on this device (no AI, nothing sent anywhere). The
 * owner edits it as they like.
 */
function AboutDraft({ drafts, name, town, hasText, onDraft }: { drafts: Drafts; name: string; town: string; hasText: boolean; onDraft: (text: string) => void }) {
  const ts = useTranslations("admin.website.studio");
  const [open, setOpen] = useState(!hasText);
  const [since, setSince] = useState("");
  const [known, setKnown] = useState("");
  const [love, setLove] = useState("");
  const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
  function write() {
    const v = { name, town, kind: drafts.kind, year: since.trim(), known: known.trim().replace(/\.$/, ""), love: love.trim().replace(/\.$/, "") };
    const first = [fill(town ? drafts.aboutTown : drafts.aboutNoTown, v), v.year && fill(drafts.aboutSince, v), v.known && fill(drafts.aboutKnown, v)].filter(Boolean).join(" ");
    const second = [v.love && fill(drafts.aboutLove, v), drafts.aboutEnd].filter(Boolean).join(" ");
    onDraft(`${first}\n\n${second}`.slice(0, LIMITS.about));
    setOpen(false);
  }
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 justify-self-start text-sm font-medium underline">
        <Pencil className="size-4" /> {ts("aboutHelp")}
      </button>
    );
  return (
    <div className="grid gap-3 rounded-xl bg-canvas p-3">
      <p className="flex items-center gap-2 font-medium">
        <Pencil className="size-4" /> {ts("aboutHelp")}
      </p>
      <Field label={ts("aboutQ.since")}>
        <input className="field" inputMode="numeric" maxLength={4} placeholder="2015" value={since} onChange={(e) => setSince(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <Field label={ts("aboutQ.known")} hint={ts("aboutQ.knownHint")}>
        <input className="field" maxLength={120} value={known} onChange={(e) => setKnown(e.target.value)} />
      </Field>
      <Field label={ts("aboutQ.love")} hint={ts("aboutQ.loveHint")}>
        <input className="field" maxLength={120} value={love} onChange={(e) => setLove(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={write} className="btn-primary">
          {hasText ? ts("aboutReplace") : ts("aboutWrite")}
        </button>
        {hasText && (
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
            {ts("cancel")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{ts("aboutNote")}</p>
    </div>
  );
}

/** Questions clients often ask a salon like this one: tap to add, then check the answer. */
function Suggestions({ questions, faq, onAdd }: { questions: Drafts["questions"]; faq: SiteConfig["faq"]; onAdd: (f: { q: string; a: string }) => void }) {
  const ts = useTranslations("admin.website.studio");
  const [editing, setEditing] = useState<{ q: string; a: string } | null>(null);
  const left = questions.filter((x, i, all) => !faq.some((f) => f.q === x.q) && all.findIndex((y) => y.q === x.q) === i);
  if (!left.length && !editing) return null;
  return (
    <section className="card grid gap-3 p-4">
      <div>
        <h3 className="font-semibold">{ts("faqSuggest")}</h3>
        <p className="text-sm text-muted">{ts("faqSuggestHint")}</p>
      </div>
      {editing ? (
        <div className="grid gap-2">
          <input className="field" aria-label={ts("question")} maxLength={LIMITS.faqQ} value={editing.q} onChange={(e) => setEditing({ ...editing, q: e.target.value })} />
          <textarea rows={3} className="field" aria-label={ts("answer")} placeholder={ts("answerPlaceholder")} maxLength={LIMITS.faqA} value={editing.a} onChange={(e) => setEditing({ ...editing, a: e.target.value })} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!editing.q.trim() || !editing.a.trim()}
              className="btn-primary"
              onClick={() => {
                onAdd({ q: editing.q.trim(), a: editing.a.trim() });
                setEditing(null);
              }}
            >
              {ts("addIt")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              {ts("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {left.map((x) => (
              <button key={x.q} type="button" onClick={() => setEditing(x)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm hover:border-ink">
                + {x.q}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- Order of the sections ---------- */

const onKeys = (c: SiteConfig) => c.pieces.filter((p) => p.on).map((p) => p.key);
const firstOn = (c: SiteConfig, key: PieceKey) => onKeys(c)[0] === key;
const lastOn = (c: SiteConfig, key: PieceKey) => onKeys(c).at(-1) === key;
function neighbour(c: SiteConfig, key: PieceKey, by: 1 | -1) {
  const list = onKeys(c);
  return list[list.indexOf(key) + by];
}
/** Swaps two sections' places in the full list, so hidden sections keep where they were. */
function move(pieces: Piece[], key: PieceKey, other: PieceKey | undefined) {
  if (!other) return pieces;
  const i = pieces.findIndex((p) => p.key === key);
  const j = pieces.findIndex((p) => p.key === other);
  const next = [...pieces];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
