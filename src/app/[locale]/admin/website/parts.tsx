"use client";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/admin/ui";
import { DIRECTIONS, LAYOUTS, LIMITS, POPULAR, PRESETS, presetPieces, readConfig, type Piece, type PieceKey, type Preset, type SiteConfig } from "@/lib/site/config";
import { pieceHasContent, type SiteFacts } from "@/lib/site/content";
import { palettesOf, themeFor } from "@/lib/site/theme";
import { useLogoAdjust } from "@/components/admin/logo-adjust";
import { saveAdjustedLogo } from "../_actions/pictures";
import { addGalleryPhoto, publishWebsite, saveDraft, setHeroPhoto, setLogo, setWebsiteOn } from "../_actions/website";
import { ExampleArt, monogramLogo, type ArtColors } from "@/components/site/example-art";
import { shrinkPhoto } from "@/lib/shrink-image";
import { EditablePreview } from "@/components/admin/editable-preview";
import { Camera } from "@/components/icons";
import { fileUrl, fitPhoto, HERO_SHAPES } from "@/lib/image-helpers";

/** The pieces of the website editor (studio.tsx): the settings each sheet shows. */

export type StudioProps = {
  locale: string;
  initial: SiteConfig;
  published: SiteConfig | null;
  heroPending: boolean;
  enabled: boolean;
  facts: SiteFacts;
  hero: string | null;
  logo: string | null;
  brandColor: string;
  address: string;
  siteHref: string;
  salonLanguage: string;
  salonName: string;
  /** For the AI brief ("a barbershop in Valencia"). */
  salonTown: string;
  /** For tagging "Our work" photos: who did it, and which service "Book this" opens. */
  people: { id: string; name: string }[];
  services: { id: string; name: string }[];
  /** The team as the Team section shows them: whether each has a photo yet. */
  team: { id: string; name: string; photo: boolean }[];
  /** From "Getting started": the picture to point at. */
  picture?: "cover" | "logo" | "icon";
  /** Open the About section's editor straight away. */
  part?: "about";
  /** Ready-made texts in the website's language: the About draft and suggested questions. */
  drafts: Drafts;
};

/** Texts in the website's language (messages: siteDrafts), filled in on the owner's phone. */
export type Drafts = {
  kind: string;
  aboutTown: string;
  aboutNoTown: string;
  aboutSince: string;
  aboutKnown: string;
  aboutLove: string;
  aboutEnd: string;
  questions: { q: string; a: string }[];
};

/* ---------- Screens and parts ---------- */


/** Type of business: what the salon sells (resets sections and style, after asking), and the two options. */
export function TypeScreen({ c, set }: { c: SiteConfig; set: (p: Partial<SiteConfig>) => void }) {
  const t = useTranslations("admin.website");
  const [asking, setAsking] = useState<Preset | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="card grid gap-2 p-4">
        <p className="text-sm text-muted">{t("presetHint")}</p>
        {PRESETS.map((p) => (
          <div key={p} className={`rounded-xl border ${c.preset === p ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-white"}`}>
            <button type="button" onClick={() => c.preset !== p && setAsking(p)} aria-pressed={c.preset === p} className="grid w-full gap-1 p-3 text-left">
              <span className="flex items-center justify-between gap-2 font-medium">
                {t(`presets.${p}.name`)}
                {c.preset === p && <span className="chip bg-brand text-white">{t("presetCurrent")}</span>}
              </span>
              <span className="text-sm text-muted">{t(`presets.${p}.hint`)}</span>
            </button>
            {asking === p && (
              <div className="grid gap-2 border-t border-line p-3">
                <p className="text-sm">{t("confirmType", { type: t(`presets.${p}.name`) })}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      set({ preset: p });
                      setAsking(null);
                    }}
                  >
                    {t("useIt")}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setAsking(null)}>
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
      <section className="card grid gap-4 p-4">
        <Switch label={t("solo")} hint={t("soloHint")} checked={c.solo} onChange={(v) => set({ solo: v })} />
        <Switch label={t("mobile")} hint={t("mobileHint")} checked={c.mobile} onChange={(v) => set({ mobile: v })} />
        {c.mobile && (
          <Field label={t("serviceArea")} hint={t("serviceAreaHint")}>
            <input className="field" maxLength={LIMITS.area} defaultValue={c.serviceArea} onBlur={(e) => e.target.value !== c.serviceArea && set({ serviceArea: e.target.value })} />
          </Field>
        )}
      </section>
    </div>
  );
}


/** About's own upright photo (e.g. the owner at work); without one, the top photo is used. */
export function AboutPhoto({ id, hero, art, onChange }: { id: string; hero: string | null; art: ArtColors; onChange: (id: string) => void }) {
  const t = useTranslations("admin.website");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function pick(file: File) {
    setBusy(true);
    setError(false);
    const res = await addGalleryPhoto((await shrinkPhoto(file, 1200, 1500).catch(() => null))?.url ?? "");
    setBusy(false);
    if ("id" in res) onChange(res.id);
    else setError(true);
  }
  const src = id ? `/api/site/photo?k=g:${id}` : hero;
  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <div>
        <span className="block font-medium">{t("aboutPhoto")}</span>
        <p className="text-sm text-muted">{t("aboutPhotoHint")}</p>
      </div>
      <div className="grid grid-cols-[8rem_1fr] items-start gap-4">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
        ) : (
          <ExampleArt kind="hero" colors={art} label={t("example")} className="aspect-[4/5] w-full rounded-xl" />
        )}
        <div className="grid gap-2">
          {!id && hero && <p className="text-sm text-muted">{t("aboutUsesTop")}</p>}
          <label className={`btn-ghost cursor-pointer justify-self-start ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Camera className="size-4" /> {busy ? t("uploading") : id ? t("changePhoto") : t("addPhoto")}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          </label>
          {id && (
            <button type="button" className="justify-self-start text-sm text-muted underline" onClick={() => onChange("")}>
              {t("removePhoto")}
            </button>
          )}
          {error && <p className="text-sm text-red-700">{t("photoError")}</p>}
        </div>
      </div>
    </div>
  );
}

/** What a picture is for, where it shows and the best file, in three short lines. */
export function SpecLines({ where, best, tip }: { where: string; best: string[]; tip?: string }) {
  const t = useTranslations("admin.website");
  return (
    <dl className="grid gap-1.5 rounded-xl bg-canvas p-3 text-sm">
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted">{t("whereLabel")}</dt>
        <dd>{where}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="w-24 shrink-0 text-muted">{t("bestLabel")}</dt>
        <dd className="flex flex-wrap gap-1">
          {best.map((x) => (
            <span key={x} className="chip bg-white text-ink ring-1 ring-line">
              {x}
            </span>
          ))}
        </dd>
      </div>
      {tip && (
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t("tipLabel")}</dt>
          <dd>{tip}</dd>
        </div>
      )}
    </dl>
  );
}

/** The cover photo, explained for the chosen design: wide behind the name, or upright beside it. */
export function HeroPhoto({ design, hero, size, onChange, art }: { design: "photo" | "split"; hero: string | null; size: { w: number; h: number } | null; onChange: (f: File | null) => void; art: ArtColors }) {
  const t = useTranslations("admin.website");
  const wide = design === "photo";
  const min = wide ? HERO_SHAPES.photo.min : HERO_SHAPES.split.min;
  const small = size && (size.w < min.w || size.h < min.h);
  const frame = wide ? "aspect-[16/9]" : "aspect-[4/5] max-w-56";
  return (
    <section className="card grid gap-3 p-4">
      <div>
        <h3 className="font-semibold">{wide ? t("photoTitleBig") : t("photoTitleSplit")}</h3>
        <p className="text-sm text-muted">{t("photoWhy")}</p>
      </div>
      <SpecLines
        where={wide ? t("whereBig") : t("whereSplit")}
        best={[wide ? t("landscape") : t("portrait"), `${min.w} × ${min.h} px+`, "JPG · PNG"]}
        tip={wide ? t("tipBig") : t("tipSplit")}
      />
      {hero ? (
        <div className={`relative overflow-hidden rounded-xl ${frame}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="size-full object-cover" />
          {wide && (
            <>
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-3 left-3 h-2.5 w-1/3 rounded bg-white/90" aria-hidden />
            </>
          )}
        </div>
      ) : (
        <ExampleArt kind="hero" colors={art} label={t("exampleLabel")} className={`w-full rounded-xl ${frame}`} />
      )}
      {hero && <p className="text-xs text-muted">{wide ? t("cropBig") : t("cropSplit")}</p>}
      {small && <p className="text-sm text-amber-800">{t("photoSmall", { w: size!.w, h: size!.h })}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="btn-ghost cursor-pointer">
          <Camera className="size-4" /> {hero ? t("changePhoto") : t("addPhoto")}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        </label>
        {hero && (
          <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
            {t("removePhoto")}
          </button>
        )}
      </div>
    </section>
  );
}

export function Gallery({
  gallery,
  onChange,
  art,
  services,
}: {
  gallery: SiteConfig["gallery"];
  onChange: (g: SiteConfig["gallery"]) => void;
  art: ArtColors;
  services: StudioProps["services"];
}) {
  const t = useTranslations("admin.website");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add(files: FileList) {
    setError(null);
    setUploading(true);
    const added: SiteConfig["gallery"] = [];
    try {
      for (const file of [...files].slice(0, LIMITS.photos - gallery.length)) {
        const res = await addGalleryPhoto((await shrinkPhoto(file, 1400, 1400).catch(() => null))?.url ?? "");
        if ("id" in res) added.push({ id: res.id, caption: "" });
        else setError(res.error === "full" ? t("galleryFull") : t("photoError"));
      }
    } finally {
      setUploading(false);
      if (added.length) onChange([...gallery, ...added]);
    }
  }
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= gallery.length) return;
    const next = [...gallery];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <section className="card grid gap-3 p-4">
      <p className="text-sm text-muted">
        {t("galleryHint")} {t("gallerySize")}
      </p>
      {gallery.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.map((p, i) => (
            <li key={p.id} className="grid content-start gap-1.5">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/site/photo?k=g:${p.id}`} alt={p.caption} className="aspect-[4/5] w-full rounded-xl object-cover" />
              </div>
              <input
                className="field !py-2 text-sm"
                placeholder={t("caption")}
                aria-label={t("caption")}
                maxLength={LIMITS.caption}
                defaultValue={p.caption}
                onBlur={(e) => e.target.value !== p.caption && onChange(gallery.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)))}
              />
              {services.length > 0 && (
                <select
                  className="field !py-2 text-sm"
                  aria-label={t("photoService")}
                  value={p.serviceId ?? ""}
                  onChange={(e) => onChange(gallery.map((x, k) => (k === i ? { ...x, serviceId: e.target.value || undefined } : x)))}
                >
                  <option value="">
                    {t("photoService")}: {t("noOne")}
                  </option>
                  {services.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-1">
                <MoveButton label={t("moveLeft")} disabled={i === 0} onClick={() => move(i, -1)}>
                  ←
                </MoveButton>
                <MoveButton label={t("moveRight")} disabled={i === gallery.length - 1} onClick={() => move(i, 1)}>
                  →
                </MoveButton>
                <button type="button" onClick={() => onChange(gallery.filter((_, k) => k !== i))} className="ml-auto p-2 text-sm text-muted underline">
                  {t("remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {gallery.length === 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label={t("exampleLabel")}>
          {[0, 1, 2].map((n) => (
            <li key={n}>
              <ExampleArt kind="work" n={n} colors={art} label={n === 0 ? t("exampleLabel") : undefined} className="aspect-[4/5] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {gallery.length < LIMITS.photos && (
        <label className={`btn-ghost cursor-pointer justify-self-start ${uploading ? "pointer-events-none opacity-50" : ""}`}>
          <Camera className="size-4" /> {uploading ? t("uploading") : t("addPhotos")}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.length && add(e.target.files)} />
        </label>
      )}
    </section>
  );
}

export function FaqEditor({ faq, onChange }: { faq: SiteConfig["faq"]; onChange: (f: SiteConfig["faq"]) => void }) {
  const t = useTranslations("admin.website");
  const update = (i: number, patch: Partial<SiteConfig["faq"][number]>) => onChange(faq.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <section className="card grid gap-3 p-4">
      <p className="text-sm text-muted">{t("faqHint")}</p>
      {faq.map((f, i) => (
        <div key={`${i}-${f.q}`} className="grid gap-2 rounded-xl border border-line p-3">
          <input className="field" aria-label={t("question")} maxLength={LIMITS.faqQ} defaultValue={f.q} onBlur={(e) => e.target.value.trim() && e.target.value !== f.q && update(i, { q: e.target.value })} />
          <textarea rows={2} className="field" aria-label={t("answer")} maxLength={LIMITS.faqA} defaultValue={f.a} onBlur={(e) => e.target.value.trim() && e.target.value !== f.a && update(i, { a: e.target.value })} />
          <button type="button" className="justify-self-start text-sm text-muted underline" onClick={() => onChange(faq.filter((_, k) => k !== i))}>
            {t("remove")}
          </button>
        </div>
      ))}
      {faq.length < LIMITS.faqCount && <NewEntry fields={[t("question"), t("answer")]} max={[LIMITS.faqQ, LIMITS.faqA]} onAdd={([q, a]) => onChange([...faq, { q, a }])} />}
    </section>
  );
}


/** Two fields and an Add button, for questions. */
export function NewEntry({ fields, max, secondOptional, onAdd }: { fields: [string, string]; max: [number, number]; secondOptional?: boolean; onAdd: (v: [string, string]) => void }) {
  const t = useTranslations("admin.website");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const ready = !!a.trim() && (secondOptional || !!b.trim());
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-line p-3">
      <textarea rows={2} className="field" placeholder={fields[0]} aria-label={fields[0]} maxLength={max[0]} value={a} onChange={(e) => setA(e.target.value)} />
      <input className="field" placeholder={fields[1]} aria-label={fields[1]} maxLength={max[1]} value={b} onChange={(e) => setB(e.target.value)} />
      <button type="button" disabled={!ready} className="btn-ghost justify-self-start" onClick={() => (onAdd([a.trim(), b.trim()]), setA(""), setB(""))}>
        ＋ {t("add")}
      </button>
    </div>
  );
}

export function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line disabled:opacity-25">
      {children}
    </button>
  );
}

/** An on/off switch that acts at once (no Save button). */
export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-gray-300 transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

/** Swaps two sections' places in the full list, so switched-off sections keep where they were. */
export function swap(pieces: Piece[], key: PieceKey, other: PieceKey | undefined) {
  if (!other) return pieces;
  const i = pieces.findIndex((p) => p.key === key);
  const j = pieces.findIndex((p) => p.key === other);
  const next = [...pieces];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
