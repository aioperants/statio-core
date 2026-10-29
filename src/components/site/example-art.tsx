/**
 * Illustrated examples for photo spots the owner hasn't filled yet: a plain photo place for the top,
 * a person for the team, and work motifs for "Our work". Drawn in the website's own colours. Shown
 * only in the settings and the preview, always marked "Example": never on the published website.
 */

export type ArtColors = { bg: string; surface: string; tint: string; accent: string; text: string; line: string };

/**
 * The top photo's place: a plain shaded area with a camera, no drawn salon. A drawing there was
 * taken for a suggestion of what the photo should show (and copied by AI apps from screenshots).
 */
function Interior({ c }: { c: ArtColors }) {
  return (
    <>
      <rect width="1600" height="1000" fill={c.tint} />
      <rect width="1600" height="1000" fill={c.text} opacity="0.08" />
      <g transform="translate(800 470) scale(6) translate(-12 -12)" fill="none" stroke={c.text} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </g>
    </>
  );
}

/** A friendly person, shoulders up. */
function Person({ c }: { c: ArtColors }) {
  return (
    <>
      <rect width="400" height="400" fill={c.tint} />
      <rect x="176" y="210" width="48" height="60" rx="16" fill={c.line} />
      <circle cx="200" cy="160" r="72" fill={c.line} />
      <path d="M128 150c0-50 32-84 72-84s72 34 72 84c-20-30-50-40-72-40s-52 10-72 40z" fill={c.text} opacity="0.75" />
      <path d="M70 400c10-90 60-140 130-140s120 50 130 140z" fill={c.accent} />
      <path d="M170 262l30 40 30-40" fill="none" stroke={c.surface} strokeWidth="8" strokeLinejoin="round" />
    </>
  );
}

/** Work motifs for "Our work": scissors and comb, nail polish, a hairdryer, a brush and palette. */
function Work({ c, n }: { c: ArtColors; n: number }) {
  const motifs = [
    <g key="scissors">
      <circle cx="150" cy="330" r="46" fill="none" stroke={c.accent} strokeWidth="18" />
      <circle cx="250" cy="330" r="46" fill="none" stroke={c.accent} strokeWidth="18" />
      <path d="M180 295l90-190M220 295l-90-190" stroke={c.text} strokeWidth="18" strokeLinecap="round" opacity="0.8" />
      <rect x="300" y="110" width="40" height="260" rx="12" fill={c.surface} stroke={c.line} strokeWidth="6" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x="280" y={130 + i * 26} width="24" height="10" rx="4" fill={c.line} />
      ))}
    </g>,
    <g key="polish">
      <rect x="150" y="190" width="160" height="200" rx="40" fill={c.accent} />
      <rect x="185" y="90" width="90" height="110" rx="14" fill={c.text} opacity="0.8" />
      <rect x="175" y="230" width="40" height="110" rx="20" fill={c.surface} opacity="0.5" />
    </g>,
    <g key="dryer">
      <circle cx="200" cy="180" r="100" fill={c.accent} />
      <circle cx="200" cy="180" r="46" fill={c.surface} />
      <rect x="290" y="150" width="90" height="60" rx="20" fill={c.accent} />
      <rect x="170" y="260" width="60" height="140" rx="22" fill={c.text} opacity="0.8" />
    </g>,
    <g key="brush">
      <ellipse cx="190" cy="250" rx="120" ry="90" fill={c.surface} stroke={c.line} strokeWidth="6" />
      <circle cx="150" cy="230" r="22" fill={c.accent} />
      <circle cx="210" cy="215" r="22" fill={c.accent} opacity="0.6" />
      <circle cx="245" cy="265" r="22" fill={c.text} opacity="0.5" />
      <path d="M260 120l90-70" stroke={c.text} strokeWidth="16" strokeLinecap="round" opacity="0.8" />
      <path d="M250 130l-20 40 40-14z" fill={c.accent} />
    </g>,
  ];
  return (
    <>
      <rect width="400" height="500" fill={c.tint} />
      <g transform="translate(0 40)">{motifs[n % motifs.length]}</g>
    </>
  );
}

/**
 * One example illustration, filling its box like a photo would (cover). `label` marks it as an
 * example so nobody takes it for the salon's own picture.
 */
export function ExampleArt({ kind, colors, label, n = 0, className = "" }: { kind: "hero" | "person" | "work"; colors: ArtColors; label?: string; n?: number; className?: string }) {
  const box = kind === "hero" ? "0 0 1600 1000" : kind === "person" ? "0 0 400 400" : "0 0 400 500";
  return (
    // Positioned by the caller (e.g. "absolute inset-0" behind the top text), else a box of its own.
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative "}overflow-hidden ${className}`}>
      <svg viewBox={box} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label={label}>
        {kind === "hero" ? <Interior c={colors} /> : kind === "person" ? <Person c={colors} /> : <Work c={colors} n={n} />}
      </svg>
      {label && (
        <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white" aria-hidden>
          {label}
        </span>
      )}
    </div>
  );
}

/** A simple monogram logo from the salon's initials in its colour: a real logo the owner can keep or replace. */
export function monogramLogo(name: string, color: string, text = "#FFFFFF") {
  const initials = name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w.match(/\p{L}/u)![0].toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><circle cx="120" cy="120" r="116" fill="${color}"/><circle cx="120" cy="120" r="100" fill="none" stroke="${text}" stroke-opacity="0.5" stroke-width="3"/><text x="120" y="120" dy="0.35em" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${initials.length > 1 ? 92 : 112}" fill="${text}" letter-spacing="2">${initials.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml;base64,${typeof btoa === "function" ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg).toString("base64")}`;
}
