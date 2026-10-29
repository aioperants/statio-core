/* eslint-disable @next/next/no-img-element -- photos are stored with the salon (data URLs or our own route), not optimised by Next. */
import { initials, money } from "@/lib/format";
import type { Piece, SiteConfig } from "@/lib/site/config";
import { pieceHasContent, siteFacts } from "@/lib/site/content";
import { themeFor, themeVars, type Theme } from "@/lib/site/theme";
import { ExampleArt, monogramLogo, type ArtColors } from "./example-art";
import { SiteMenu } from "./site-menu";
import { menuLinks } from "@/lib/site/menu";
import type { SiteData, SiteMember, SiteService } from "@/lib/site/types";

/**
 * The salon's website: header, the owner's sections in their fixed order, footer, and a "Book"
 * bar on phones. Plain server-rendered HTML (no client code, no cookies, no outside scripts).
 * A piece with nothing to show is left out; nothing here is ever made up.
 */

export type SiteT = (key: string, values?: Record<string, string | number>) => string;

type Props = {
  config: SiteConfig;
  data: SiteData;
  /** Words in the website's language (messages: "site"). */
  t: SiteT;
  /** Shown on top while the owner previews the draft. */
  previewNote?: string;
  /** "Website by Statio CRM" in the footer. */
  badge?: boolean;
  /** Extra classes for the fonts (lib/site/fonts.ts). */
  fontClass?: string;
  /** The booking page in the website's look: `children` between the header and footer. */
  page?: "book";
  children?: React.ReactNode;
  /** The website is live: the menu leads to its sections (the booking page can wear the look without it). */
  live?: boolean;
  /**
   * Settings and preview only: empty photo spots show illustrated examples marked with this label.
   * Never set on the published website.
   */
  exampleLabel?: string;
  /** With `exampleLabel`: the mark on the example logo. */
  exampleLogoLabel?: string;
  /** Settings preview on a phone: just this section (or the footer), without the page around it. */
  only?: string;
  /**
   * The owner's preview only: camera buttons on the cover photo and the logo (their clicks are
   * picked up by the page around it, see website-preview). `highlight` draws attention to one.
   */
  edit?: Edit;
  /**
   * The website editor only: sections that are on but have nothing to show yet are drawn with this
   * (an empty spot saying what's missing) instead of being left out, so the owner can tap them.
   */
  empty?: (key: Piece["key"]) => React.ReactNode;
};

/** The owner's preview: every picture spot labelled, with its shape and size, and a camera button. */
export type Edit = {
  /** The size line depends on the layout of the top: wide behind the name, or upright beside it. */
  cover: { label: string; size: { photo: string; split: string }; required: string };
  /** On the logo spot the design uses: required with "Logo and text", optional (the small header logo) otherwise. */
  logo: { add: string; change: string; size: string; required: string; optional: string };
  team: { label: string; size: string };
  highlight?: "cover" | "logo" | "icon";
};
type Ctx = {
  config: SiteConfig;
  data: SiteData;
  t: SiteT;
  example?: { label: string; logoLabel: string; colors: ArtColors };
  edit?: Edit;
  /** The top of the page as shown: its layout, or null when it's off. The header leaves out what it already shows. */
  hero?: string | null;
};

const artColors = (th: Theme): ArtColors => ({ bg: th.bg, surface: th.surface, tint: th.tint, accent: th.button, text: th.text, line: th.line });

export function Site({ config, data: raw, t, previewNote, badge = true, fontClass = "", page, children, live = true, exampleLabel, exampleLogoLabel, only, edit, empty }: Props) {
  // "We come to you": no salon address or map anywhere, the area served instead.
  const located = config.mobile ? { ...raw, address: null, mapsUrl: null } : raw;
  // The website shows the salon's name in the look's lettering, not a logo.
  const data = { ...located, logo: null };
  const theme = themeFor(config.direction, data.brandColor, config.palette);
  const example = exampleLabel ? { label: exampleLabel, logoLabel: exampleLogoLabel ?? exampleLabel, colors: artColors(theme) } : undefined;
  const facts = siteFacts(data);
  // In the preview an empty gallery shows examples, so the owner sees what it will look like.
  const filled = (key: Piece["key"]) => pieceHasContent(key, config, facts) || Boolean(example && key === "gallery");
  const pieces = config.pieces;
  const shown = pieces.filter((p) => p.on && (filled(p.key) || empty));
  const heroPiece = shown.find((p) => p.key === "hero");
  // The menu's sections, named as on the page.
  const sectionName = (key: Piece["key"]) =>
    key === "gallery" && config.solo ? t("galleryMe") : key === "about" && config.solo ? t("aboutMe") : key === "hours" ? t("menuHours") : t(key);
  const menu = live ? menuLinks(pieces, filled).map((l) => ({ href: l.href, label: sectionName(l.key) })) : [];
  const ctx: Ctx = { config, data, t, example, edit, hero: heroPiece ? heroLayoutShown(heroPiece.layout, data, example) : null };
  // Hero first if it's on; the rest alternate between the page colour and a light brand wash.
  let band = 0;
  return (
    <div
      data-direction={config.direction}
      className={`site ${only ? "" : "min-h-dvh"} ${fontClass}`}
      style={themeVars(theme) as React.CSSProperties}
      lang={data.locale}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 s-btn">
        {t("skip")}
      </a>
      {previewNote && !only && <p className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">{previewNote}</p>}
      {!only && <Header {...ctx} menu={menu} booking={page === "book"} home={live} />}
      <main id="main">
        {page === "book" && children}
        {!page && shown.map((p) => {
          // Empty spots (editor only) don't count, so the colour bands match the live website.
          if (!filled(p.key))
            return only && only !== p.key ? null : (
              <div key={p.key} id={`piece-${p.key}`}>
                {empty!(p.key)}
              </div>
            );
          const tinted = p.key !== "hero" && band++ % 2 === 1;
          if (only && only !== p.key) return null;
          // Each section can be jumped to (the settings preview scrolls to the one being edited).
          return (
            <div key={p.key} id={`piece-${p.key}`} className={edit && p.key === "hero" ? "relative" : undefined}>
              <PieceView piece={p} ctx={ctx} tinted={tinted} />
              {edit && p.key === "hero" && ctx.hero === "photo" && (
                <EditButton
                  what="cover"
                  layout="photo"
                  label={edit.cover.label}
                  size={`${edit.cover.required} · ${edit.cover.size.photo}`}
                  highlight={edit.highlight === "cover"}
                  className="absolute top-3 right-3"
                />
              )}
            </div>
          );
        })}
      </main>
      {(!only || only === "footer") && (
        <div id="piece-footer">
          <Footer {...ctx} badge={badge} live={live} />
        </div>
      )}
    </div>
  );
}

/** The top's layout as it will show: the photo when there is one, else the marquee (name and services). */
function heroLayoutShown(layout: string, data: SiteData, example: Ctx["example"]) {
  return layout === "photo" && (data.heroImage || example) ? "photo" : "marquee";
}

/**
 * The running line: the words repeated until one round is wider than the widest column (so the two
 * copies loop with no gap at any screen width), and how long a round takes at a steady pace.
 */
export function marqueeLoop(words: string[]) {
  // About 17 px per letter at the larger size, plus the dot between words; a round of 2200 px leaves
  // room for narrow lettering (a real round is never narrower than the 1152 px column).
  const width = (list: string[]) => list.reduce((w, x) => w + x.length * 17 + 42, 0);
  const one = Math.max(1, width(words));
  const run = Array.from({ length: Math.ceil(2200 / one) }, () => words).flat();
  return { run, seconds: Math.round(width(run) / 45) };
}

/** What the marquee runs: the service groups (or, with fewer than three, the services), each once. */
function marqueeWords(data: SiteData) {
  const groups = data.services.map((g) => g.name).filter((n): n is string => Boolean(n));
  const words = groups.length >= 3 ? groups : data.services.flatMap((g) => g.items.map((x) => x.name));
  return [...new Set(words)].slice(0, 10);
}

/**
 * A labelled camera button on a picture spot, in the owner's preview only (website-preview passes
 * the click to the screen around it): the spot's name and, underneath, its shape and size.
 */
function EditButton({ what, layout, label, size, highlight, compact, className = "" }: { what: string; layout?: string; label: string; size?: string; highlight?: boolean; compact?: boolean; className?: string }) {
  // Compact: just the camera, named for screen readers and on hover (e.g. beside the name in the top bar).
  if (compact)
    return (
      <button
        type="button"
        data-statio-edit={what}
        data-statio-layout={layout}
        aria-label={label}
        title={size ? `${label} · ${size}` : label}
        className={`z-20 grid size-9 shrink-0 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-md ring-1 ring-black/10 ${highlight ? "animate-pulse ring-4 ring-black" : ""} ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13.5" r="3.5" />
        </svg>
      </button>
    );
  return (
    <button
      type="button"
      data-statio-edit={what}
      data-statio-layout={layout}
      className={`z-20 flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-1.5 text-left text-neutral-900 shadow-lg ring-1 ring-black/10 ${highlight ? "animate-pulse ring-4 ring-black" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0" aria-hidden>
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">{label}</span>
        {size && <span className="block text-[11px] text-neutral-500">{size}</span>}
      </span>
    </button>
  );
}

function PieceView({ piece, ctx, tinted }: { piece: Piece; ctx: Ctx; tinted: boolean }) {
  const l = piece.layout;
  switch (piece.key) {
    case "hero":
      return <Hero ctx={ctx} layout={l} />;
    case "services":
      return <Services ctx={ctx} tinted={tinted} />;
    case "team":
      return <Team ctx={ctx} tinted={tinted} />;
    case "gallery":
      return <Gallery ctx={ctx} tinted={tinted} />;
    case "about":
      return <About ctx={ctx} layout={l} tinted={tinted} />;
    case "faq":
      return <Faq ctx={ctx} tinted={tinted} />;
    case "hours":
      return <Hours ctx={ctx} tinted={tinted} />;
    case "contact":
      return <Contact ctx={ctx} tinted={tinted} />;
  }
}

/* ---------- Building blocks ---------- */

function Section({ id, title, tinted, children, narrow }: { id: string; title: string; tinted: boolean; children: React.ReactNode; narrow?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`px-4 py-16 md:px-8 md:py-24 ${tinted ? "s-tint" : ""}`}>
      {/* Every title lines up on the same edge; narrow pieces keep their text to a readable width. */}
      <div className="mx-auto max-w-6xl">
        <h2 id={`${id}-title`} className="s-h s-section-title mb-8 text-3xl md:mb-12 md:text-5xl">
          {title}
        </h2>
        {narrow ? <div className="max-w-3xl">{children}</div> : children}
      </div>
    </section>
  );
}

function BookButton({ ctx, className = "" }: { ctx: Ctx; className?: string }) {
  return (
    <a href={ctx.data.bookUrl} className={`s-btn ${className}`}>
      {ctx.t("book")}
    </a>
  );
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const whatsapp = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

function duration(min: number, t: SiteT) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? t("minutes", { min: m }) : m === 0 ? t("hoursOnly", { h }) : t("hoursMinutes", { h, min: m });
}

function price(s: SiteService, ctx: Ctx) {
  if (!ctx.config.showPrices || s.priceCents <= 0) return null;
  const p = money(s.priceCents, ctx.data.currency, ctx.data.locale);
  return s.from ? ctx.t("from", { price: p }) : p;
}

function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`grid gap-4 text-lg leading-relaxed ${className}`}>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}

function Logo({ data, size }: { data: SiteData; size: number }) {
  return data.logo ? <img src={data.logo} alt={data.name} style={{ height: size, maxWidth: size * 3 }} className="object-contain" /> : null;
}

/* ---------- Header, footer, book bar ---------- */

function Header({ data, t, menu, booking, home = true }: Ctx & { menu: { href: string; label: string }[]; booking?: boolean; home?: boolean }) {
  // As the templates were made: the salon's name, typed in the look's lettering. (The logo, when the
  // design is "Logo and text", is shown large at the top instead.) On the right, Book and the menu
  // (≡), the same on phones and computers; the bar stays at the top while scrolling, so the phone's
  // bottom Book bar isn't needed any more.
  return (
    <header className="s-header s-line sticky top-0 z-30 border-b px-4 py-3 md:px-8" style={{ background: "var(--s-bg)" }}>
      {/* Same column as the content below, so the name and the buttons line up with it on wide screens. */}
      <div className="mx-auto flex max-w-6xl items-center gap-2 md:gap-3">
        {/* Without a live website, the name has nowhere else to go (the booking page is the home page). */}
        <a href={home ? `/${data.locale}` : data.bookUrl} className="flex min-h-10 min-w-0 flex-1 items-center">
          <span className="s-h truncate text-xl">{data.name}</span>
        </a>
        {data.phone && (
          <a href={tel(data.phone)} className="s-muted hidden text-sm font-medium lg:inline">
            {data.phoneDisplay}
          </a>
        )}
        {/* On the booking page already: no Book button. */}
        {!booking && (
          <a href={data.bookUrl} className="s-btn !min-h-10 shrink-0 !px-4 !py-2 text-sm">
            {t("book")}
          </a>
        )}
        <SiteMenu
          label={t("menu")}
          close={t("menuClose")}
          links={menu}
          phone={data.phone ? { href: tel(data.phone), label: `${t("call")} · ${data.phoneDisplay}` } : null}
          book={{ href: data.bookUrl, label: t("book") }}
        />
      </div>
    </header>
  );
}

function Footer({ config, data, t, badge, live = true }: Ctx & { badge: boolean; live?: boolean }) {
  const legal = config.legalName || config.taxId;
  return (
    <footer className="s-line border-t px-4 py-12 text-sm md:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <p className="s-h text-2xl">{data.name}</p>
          {data.address && <p className="s-muted">{data.address}</p>}
          {legal && <p className="s-muted">{[config.legalName, config.taxId && t("taxId", { id: config.taxId }), data.email].filter(Boolean).join(" · ")}</p>}
          <p id="privacy" className="s-muted max-w-prose">
            {t("privacy", { salon: config.legalName || data.name })}
          </p>
        </div>
        <div className="grid content-start gap-2 md:text-right">
          {data.links.map((l) => (
            <a key={l.url} href={l.url} rel="noopener me" target="_blank" className="s-link">
              {l.label}
            </a>
          ))}
          {badge && (
            // Statio Core's credit, on every website.
            <p className="s-muted mt-2 text-xs">
              <a href="https://statiocrm.com" rel="nofollow noopener" target="_blank" className="hover:underline">
                {t("badge")}
              </a>
              {" · "}
              <a href="https://aioperants.com" rel="nofollow noopener" target="_blank" className="hover:underline">
                {t("madeBy")}
              </a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

/* ---------- Pieces ---------- */

function Hero({ ctx, layout }: { ctx: Ctx; layout: string }) {
  const { data, config, t } = ctx;
  const line = config.tagline || data.shortAbout;
  // The photo when there is one (in the preview, an illustrated example marked as one), else the name with the services running across.
  const l = heroLayoutShown(layout, data, ctx.example);
  if (l === "photo") {
    return (
      <section aria-labelledby="hero-title" className="relative isolate flex min-h-[72svh] items-end overflow-hidden">
        {data.heroImage ? (
          <img src={data.heroImage} alt="" fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <ExampleArt kind="hero" colors={ctx.example!.colors} label={ctx.example!.label} className="absolute inset-0 -z-10" />
        )}
        {/* A soft wash of the website's colour, so any photo sits well with the colour set. */}
        <div className="s-photo-tint absolute inset-0 -z-10" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/45 to-black/10" />
        <div className="mx-auto w-full max-w-6xl px-4 pt-32 pb-12 text-white md:px-8 md:pb-20">
          {place(ctx) && <p className="mb-3 text-sm font-medium tracking-wide text-white/90">{place(ctx)}</p>}
          <h1 id="hero-title" className="s-h text-5xl md:text-7xl">
            {data.name}
          </h1>
          {line && <p className="mt-4 max-w-xl text-lg text-white/90 md:text-xl">{line}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <BookButton ctx={ctx} />
            {data.phone && (
              <a
                href={tel(data.phone)}
                className="inline-flex min-h-12 items-center rounded-[var(--s-button-radius)] border border-white px-6 font-semibold text-white"
              >
                {t("call")}
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }
  const words = marqueeWords(data);
  return (
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:px-8 md:pt-28 md:pb-20">
          {place(ctx) && <p className="s-eyebrow mb-4">{place(ctx)}</p>}
          <h1 id="hero-title" className="s-h text-6xl break-words md:text-8xl">
            {data.name}
          </h1>
          {line && <p className="s-muted mt-6 max-w-xl text-lg md:text-2xl">{line}</p>}
          <div className="mt-10 flex flex-wrap gap-3">
            <BookButton ctx={ctx} />
            {data.phone && (
              <a href={tel(data.phone)} className="s-btn-ghost">
                {t("call")}
              </a>
            )}
          </div>
        </div>
        {/* What the salon does, running slowly across in its colour (still for visitors who ask their
            phone for less motion). Read once by screen readers. */}
        {words.length > 0 && (
          // The band's colour runs edge to edge; the words move inside the page's column, fading in and out.
          <div className="s-marquee py-4 md:py-5" style={{ background: "var(--s-button)", color: "var(--s-button-text)" }}>
            <div className="s-marquee-window mx-auto max-w-6xl px-4 md:px-8">
              <div className="s-marquee-track" style={{ animationDuration: `${marqueeLoop(words).seconds}s` }} aria-hidden>
                {[0, 1].map((copy) => (
                  <ul key={copy} className="s-marquee-list">
                    {marqueeLoop(words).run.map((w, i) => (
                      <li key={i} className="s-h text-2xl whitespace-nowrap md:text-3xl">
                        {w}
                        <span className="px-5 opacity-60">·</span>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
              {/* Still (for less motion), and what screen readers read: each service once, centred. */}
              <ul className="s-marquee-still">
                {words.map((w) => (
                  <li key={w} className="s-h text-2xl whitespace-nowrap md:text-3xl">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
  );
}

function ServiceRow({ s, ctx }: { s: SiteService; ctx: Ctx }) {
  const p = price(s, ctx);
  return (
    <li className="py-3">
      <div className="flex items-end">
        <span className="text-lg font-medium">{s.name}</span>
        {p && <span className="s-leader" aria-hidden />}
        {p && <span className="s-accent text-lg font-semibold whitespace-nowrap">{p}</span>}
      </div>
      <p className="s-muted text-sm">{duration(s.durationMin, ctx.t)}</p>
    </li>
  );
}

function Services({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { data, t } = ctx;
  const groups = data.services.filter((g) => g.items.length);
  const named = groups.length > 1 || !!groups[0]?.name;
  return (
    <Section id="services" title={t("services")} tinted={tinted}>
      <div className={named ? "grid gap-12 md:grid-cols-2 md:gap-x-16" : "max-w-3xl"}>
        {groups.map((g, i) => (
          <div key={i}>
            {named && <h3 className="s-eyebrow mb-2">{g.name ?? t("otherServices")}</h3>}
            <ul className="s-line divide-y">
              {g.items.map((s, j) => (
                <ServiceRow key={j} s={s} ctx={ctx} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <BookButton ctx={ctx} className="mt-10" />
    </Section>
  );
}

/** A team member's photo, or their initials in the website's own colours (never a stock face). */
function Avatar({ m, size, tall, example }: { m: SiteMember; size: number; tall?: boolean; example?: Ctx["example"] }) {
  const shape = `${tall ? "aspect-[4/5]" : "aspect-square"} w-full rounded-[var(--s-radius)]`;
  if (!m.photo && example) return <ExampleArt kind="person" colors={example.colors} label={size > 100 ? example.label : undefined} className={`${shape} s-line border`} />;
  return m.photo ? (
    <img
      src={m.photo}
      alt=""
      width={size}
      height={tall ? Math.round(size * 1.25) : size}
      loading="lazy"
      className={`${shape} object-cover`}
      style={{ maxWidth: size }}
    />
  ) : (
    <div aria-hidden className={`${shape} s-surface s-line s-h s-ornament flex items-center justify-center border text-4xl`} style={{ maxWidth: size }}>
      {initials(m.name)}
    </div>
  );
}

/** A team member's photo; in the owner's preview, with its labelled camera button. */
function TeamPhoto({ m, ctx, size, tall }: { m: SiteMember; ctx: Ctx; size: number; tall?: boolean }) {
  if (!ctx.edit || !m.id) return <Avatar m={m} size={size} tall={tall} example={ctx.example} />;
  return (
    <div className="relative">
      <Avatar m={m} size={size} tall={tall} example={ctx.example} />
      <EditButton what={`staff:${m.id}`} label={ctx.edit.team.label} size={ctx.edit.team.size} className="absolute bottom-1.5 left-1.5 !px-2 !py-1" />
    </div>
  );
}

function Team({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { data, t } = ctx;
  return (
    <Section id="team" title={t("team")} tinted={tinted}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {data.team.map((m, i) => (
          <li key={i}>
            <TeamPhoto m={m} ctx={ctx} size={320} />
            <p className="mt-3 text-lg font-semibold">{m.name}</p>
            {m.title && <p className="s-muted text-sm">{m.title}</p>}
            <a href={m.bookUrl} className="s-link mt-2 inline-block text-sm">
              {t("bookWith", { name: m.name })}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A gallery photo's address (api/site/photo): its id never changes, so it can be kept for good. */
export const galleryPhotoUrl = (id: string) => `/api/site/photo?k=g:${id}`;

type Shown = { id: string | null; caption: string; book: { name: string; id: string } | null; n: number };

/** "Book this" (booking that service) under a photo. */
function PhotoLinks({ p, ctx, light }: { p: Shown; ctx: Ctx; light?: boolean }) {
  const { data, t } = ctx;
  if (!p.book) return null;
  const cls = light ? "font-semibold text-white underline underline-offset-4" : "s-link";
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {p.book && (
        <a href={`${data.bookUrl}?service=${p.book.id}`} className={cls}>
          {t("bookThis")}
        </a>
      )}
    </p>
  );
}

/** A photo, or (in the preview, with no photos yet) an illustrated example. */
function GalleryImage({ p, ctx, className, unlabelled }: { p: Shown; ctx: Ctx; className: string; unlabelled?: boolean }) {
  return p.id ? (
    <img src={galleryPhotoUrl(p.id)} alt={p.caption} loading="lazy" className={`${className} w-full object-cover`} />
  ) : (
    <ExampleArt kind="work" n={p.n} colors={ctx.example!.colors} label={unlabelled ? undefined : ctx.example!.label} className={`${className} s-line w-full border`} />
  );
}

/** "Our work": a grid of small squares, three across even on a phone. No script: a tap opens the photo big. */
function Gallery({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { config, data, t } = ctx;
  const services = data.services.flatMap((g) => g.items);
  const photos: Shown[] = config.gallery.length
    ? config.gallery.map((p, n) => {
        const s = services.find((x) => x.id === p.serviceId);
        return { id: p.id, caption: p.caption, book: s?.id ? { name: s.name, id: s.id } : null, n };
      })
    : ctx.example
      ? [0, 1, 2, 3].map((n) => ({ id: null, caption: "", book: null, n }))
      : [];
  const instagram = data.links.find((l) => l.label === "Instagram");
  return (
    <Section id="gallery" title={config.solo ? t("galleryMe") : t("gallery")} tinted={tinted}>
      <ul className="grid max-w-4xl grid-cols-3 gap-1 md:gap-2">
        {photos.map((p) => (
          <li key={p.id ?? p.n}>
            {p.id ? (
              <a href={`#photo-${p.id}`} aria-label={p.caption || t("openPhoto")} className="block">
                <GalleryImage p={p} ctx={ctx} className="aspect-square" />
              </a>
            ) : (
              <GalleryImage p={p} ctx={ctx} className="aspect-square" unlabelled={p.n > 0} />
            )}
          </li>
        ))}
      </ul>
      {photos
        .filter((p) => p.id)
        .map((p) => (
          <div key={p.id} id={`photo-${p.id}`} className="s-lightbox" role="dialog" aria-label={p.caption || t("openPhoto")}>
            <a href="#gallery" className="absolute inset-0" aria-label={t("closePhoto")} />
            <figure className="relative z-10 max-h-full max-w-3xl">
              <img src={galleryPhotoUrl(p.id!)} alt={p.caption} className="max-h-[80dvh] w-auto rounded-[var(--s-radius)] object-contain" />
              <figcaption className="mt-3 text-white">
                {p.caption}
                <PhotoLinks p={p} ctx={ctx} light />
              </figcaption>
            </figure>
            <a href="#gallery" className="absolute top-4 right-4 z-10 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
              {t("closePhoto")}
            </a>
          </div>
        ))}
      {/* Their Instagram as a plain link: an embedded feed would add tracking cookies. */}
      {instagram && (
        <a href={instagram.url} target="_blank" rel="noopener" className="s-link mt-8 inline-block">
          {t("moreOnInstagram")}
        </a>
      )}
    </Section>
  );
}

function About({ ctx, layout, tinted }: { ctx: Ctx; layout: string; tinted: boolean }) {
  const { data, config, t } = ctx;
  // Its own photo, else the top photo, else the logo (or, in the preview, an example).
  const photo = config.aboutPhoto ? galleryPhotoUrl(config.aboutPhoto) : data.heroImage;
  const picture = photo ?? data.logo ?? (ctx.example ? "example" : null);
  if (layout === "split" && picture) {
    // Photo left, text right (on phones the photo comes first).
    return (
      <Section id="about" title={config.solo ? t("aboutMe") : t("about")} tinted={tinted}>
        <div className="grid items-start gap-10 md:grid-cols-[2fr_3fr]">
          {photo ? (
            <img src={photo} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-[var(--s-radius)] object-cover" />
          ) : !data.logo && ctx.example ? (
            <ExampleArt kind="hero" colors={ctx.example.colors} label={ctx.example.label} className="aspect-[4/5] w-full rounded-[var(--s-radius)]" />
          ) : (
            <div className="s-surface s-line flex aspect-square items-center justify-center rounded-[var(--s-radius)] border p-8">
              <Logo data={data} size={140} />
            </div>
          )}
          <Paragraphs text={config.about} />
        </div>
      </Section>
    );
  }
  return (
    <Section id="about" title={config.solo ? t("aboutMe") : t("about")} tinted={tinted} narrow>
      <Paragraphs text={config.about} />
    </Section>
  );
}


function Faq({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { config, t } = ctx;
  return (
    <Section id="faq" title={t("faq")} tinted={tinted} narrow>
      <div className="s-line divide-y border-y">
        {config.faq.map((f, i) => (
          <details key={i}>
            <summary className="flex items-center justify-between gap-4 py-5 text-lg font-semibold">
              {f.q}
              <span className="s-chevron s-ornament text-2xl leading-none" aria-hidden>
                +
              </span>
            </summary>
            <p className="s-muted pb-5 whitespace-pre-line">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function HoursTable({ ctx }: { ctx: Ctx }) {
  const { data, t } = ctx;
  return (
    <div className="grid gap-6">
      {data.hours.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-lg">
          {data.hours.map((h) => (
            <div key={h.days} className="contents">
              <dt className="capitalize">{h.days}</dt>
              <dd className="font-medium">{h.hours}</dd>
            </div>
          ))}
        </dl>
      )}
      {data.closures.length > 0 && (
        <div>
          <h3 className="s-eyebrow mb-2">{t("closedDays")}</h3>
          <ul className="s-muted grid gap-1">
            {data.closures.map((c, i) => (
              <li key={i}>
                {c.when}
                {c.reason ? ` · ${c.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Where the salon is: its address, or for "We come to you" the area served. */
function place({ data, config, t }: Ctx) {
  if (data.address) return data.address;
  return config.mobile && config.serviceArea ? t("weComeTo", { area: config.serviceArea }) : null;
}

/**
 * Where the salon is. With an address, a map card: a drawn street map with a pin (no embedded map,
 * which would add cookies and outside scripts) and one-tap directions in Google Maps, Apple Maps
 * or Waze, which open the phone's own navigation app.
 */
function Where({ ctx }: { ctx: Ctx }) {
  const { data, t } = ctx;
  const there = data.address ? encodeURIComponent(`${data.name}, ${data.address}`) : null;
  return (
    <div className="grid content-start gap-4">
      {there ? (
        <div className="s-card overflow-hidden">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${there}`} target="_blank" rel="noopener" aria-label={t("directions")} className="block">
            <MapArt />
          </a>
          <div className="grid gap-3 p-4">
            <p className="text-lg">{data.address}</p>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${there}`} target="_blank" rel="noopener" className="s-btn justify-self-start">
              {t("directions")}
            </a>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="s-muted">{t("openIn")}</span>
              <a href={`https://maps.apple.com/?daddr=${encodeURIComponent(data.address!)}&q=${encodeURIComponent(data.name)}`} target="_blank" rel="noopener" className="s-link">
                Apple Maps
              </a>
              <a href={`https://waze.com/ul?q=${there}&navigate=yes`} target="_blank" rel="noopener" className="s-link">
                Waze
              </a>
            </p>
          </div>
        </div>
      ) : (
        place(ctx) && <p className="text-lg">{place(ctx)}</p>
      )}
      {/* At the salon and at clients' homes too: the area served as well. */}
      {there && ctx.config.serviceArea && <p className="s-muted">{t("weComeTo", { area: ctx.config.serviceArea })}</p>}
      {data.phone && (
        <a href={tel(data.phone)} className="s-btn-ghost justify-self-start">
          {t("call")}
        </a>
      )}
    </div>
  );
}

/** A drawn street map with a pin, in the website's colours: a picture, not a real map. */
function MapArt() {
  return (
    <svg viewBox="0 0 600 220" className="block h-44 w-full md:h-52" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="600" height="220" style={{ fill: "var(--s-tint)" }} />
      <path d="M-20 170C120 140 200 200 330 160S520 90 640 120" style={{ fill: "none", stroke: "var(--s-surface)", strokeWidth: 26 }} />
      <rect x="420" y="20" width="120" height="70" rx="10" style={{ fill: "var(--s-surface)", opacity: 0.8 }} />
      <g style={{ stroke: "var(--s-line)", strokeWidth: 10 }}>
        <path d="M0 60H600M0 120H600M90 0V220M210 0V220M380 0V220M500 0V220" />
      </g>
      <g style={{ stroke: "var(--s-surface)", strokeWidth: 4 }}>
        <path d="M0 60H600M0 120H600M90 0V220M210 0V220M380 0V220M500 0V220" />
      </g>
      <circle cx="300" cy="104" r="34" style={{ fill: "var(--s-ornament)", opacity: 0.18 }} />
      <path d="M300 112c-16-20-24-33-24-45a24 24 0 0 1 48 0c0 12-8 25-24 45z" style={{ fill: "var(--s-button)", stroke: "var(--s-button-text)", strokeWidth: 3 }} />
      <circle cx="300" cy="67" r="8" style={{ fill: "var(--s-button-text)" }} />
    </svg>
  );
}

function Hours({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { t } = ctx;
  return (
    <Section id="hours" title={t("hours")} tinted={tinted}>
      <div className="grid gap-12 md:grid-cols-2">
        <HoursTable ctx={ctx} />
        <Where ctx={ctx} />
      </div>
    </Section>
  );
}

function Contact({ ctx, tinted }: { ctx: Ctx; tinted: boolean }) {
  const { data, config, t } = ctx;
  const items = [
    data.phone && {
      label: t("call"),
      detail: data.phoneDisplay ?? data.phone,
      href: tel(data.phone),
      external: false,
    },
    data.phone &&
      config.whatsapp && {
        label: t("whatsapp"),
        detail: data.phoneDisplay ?? data.phone,
        href: whatsapp(data.phone),
        external: true,
      },
    data.email &&
      config.showEmail && {
      label: t("email"),
      detail: data.email,
      href: `mailto:${data.email}`,
      external: false,
    },
    ...data.links.map((l) => ({
      label: l.label,
      detail: l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
      href: l.url,
      external: true,
    })),
  ].filter(
    (
      x,
    ): x is {
      label: string;
      detail: string;
      href: string;
      external: boolean;
    } => !!x,
  );
  return (
    <Section id="contact" title={t("contact")} tinted={tinted}>
      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => (
            <li key={x.href}>
              <a href={x.href} className="s-card flex min-h-16 flex-col justify-center px-5 py-4" {...(x.external ? { target: "_blank", rel: "noopener" } : {})}>
                <span className="font-semibold">{x.label}</span>
                <span className="s-muted text-sm break-all">{x.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

