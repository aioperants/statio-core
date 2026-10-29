import "server-only";
import sharp from "sharp";

/**
 * A logo as uploaded, made ready to use: the empty margin around it cut off (white, transparent or
 * any plain colour, as image generators often leave), and the bits of that margin left in the
 * corners of a rounded tile made transparent. When the logo then sits on one plain colour, also a
 * version without that background ("Remove background", the owner's choice).
 */
export async function prepareLogo(dataUrl: string) {
  const m = dataUrl.match(/^data:image\/([\w.+-]+);base64,(.+)$/);
  if (!m) return null;
  try {
    const src = sharp(Buffer.from(m[2], "base64"), { density: m[1] === "svg+xml" ? 300 : 72 }).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: m[1] !== "svg+xml" });
    const { data, info } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Px(data, info.width, info.height);

    // 1. The margin: everything joined to the corners that looks like the corner colour.
    // Only a light or transparent margin is cut automatically: a dark plain colour edge to edge is
    // more likely the logo's own background (the owner can still remove it).
    const found = px.cornerColour();
    const corner = found && (found[3] < 24 || found[0] + found[1] + found[2] > 600) ? found : null;
    const margin = corner ? px.flood(px.border().filter((i) => px.near(i, corner)), corner) : new Uint8Array(px.n);
    const box = px.bounds((i) => !margin[i] && px.a(i) > 8);
    if (!box) return null;
    // Margin pixels left inside the box are a rounded tile's corners: transparent.
    for (let i = 0; i < px.n; i++) if (margin[i]) px.clear(i);
    const trimmed = px.crop(box);

    // 2. One plain background left (the tile's own colour, or white behind a drawing)?
    const bg = trimmed.plainEdge();
    let cutout: string | null = null;
    if (bg) {
      const cut = trimmed.copy();
      // That colour everywhere, the insides of letters (O, A, R…) included.
      for (let i = 0; i < cut.n; i++) if (cut.near(i, bg)) cut.clear(i);
      // The soft outline left where the tile met the old margin (a mix of the two colours) goes too.
      if (corner) cut.clearBlends(bg, corner);
      const inner = cut.bounds((i) => cut.a(i) > 8);
      if (inner) cutout = await cut.crop(inner).png();
    }
    return { image: await trimmed.png(), cutout, background: bg ? hex(bg) : null };
  } catch {
    return null;
  }
}

type RGBA = [number, number, number, number];
const hex = ([r, g, b]: RGBA) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

/** Raw RGBA pixels with the few operations the logo needs. */
class Px {
  n: number;
  constructor(
    public d: Buffer,
    public w: number,
    public h: number,
  ) {
    this.n = w * h;
  }
  a = (i: number) => this.d[i * 4 + 3];
  rgba = (i: number): RGBA => [this.d[i * 4], this.d[i * 4 + 1], this.d[i * 4 + 2], this.d[i * 4 + 3]];
  clear = (i: number) => {
    this.d[i * 4 + 3] = 0;
  };
  /** Close to a colour (both transparent counts as close). */
  near(i: number, c: RGBA, tol = 36) {
    const [r, g, b, a] = this.rgba(i);
    if (a < 24 && c[3] < 24) return true;
    if (a < 24 || c[3] < 24) return false;
    return Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) <= tol * 1.5;
  }
  /** The ring of pixels `inset` in from the edge. */
  border(inset = 0) {
    const out: number[] = [];
    const [x0, y0, x1, y1] = [inset, inset, this.w - 1 - inset, this.h - 1 - inset];
    if (x1 < x0 || y1 < y0) return out;
    for (let x = x0; x <= x1; x++) out.push(y0 * this.w + x, y1 * this.w + x);
    for (let y = y0 + 1; y < y1; y++) out.push(y * this.w + x0, y * this.w + x1);
    return out;
  }
  /** The colour of the corners when at least three of them agree (else there's no margin). */
  cornerColour(): RGBA | null {
    const cs = [0, this.w - 1, (this.h - 1) * this.w, this.n - 1];
    for (const c of cs) {
      const col = this.rgba(c);
      if (cs.filter((o) => this.near(o, col)).length >= 3) return col;
    }
    return null;
  }
  /** Pixels reachable from `start` through colours near `c`. */
  flood(start: number[], c: RGBA) {
    const seen = new Uint8Array(this.n);
    const stack = start.filter((i) => !seen[i] && (seen[i] = 1));
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % this.w;
      for (const j of [x > 0 ? i - 1 : -1, x < this.w - 1 ? i + 1 : -1, i - this.w, i + this.w])
        if (j >= 0 && j < this.n && !seen[j] && this.near(j, c)) {
          seen[j] = 1;
          stack.push(j);
        }
    }
    return seen;
  }
  /** Pixels next to transparent ones whose colour is a mix of `a` and `b` (a soft edge), a few layers deep. */
  clearBlends(a: RGBA, b: RGBA) {
    const mixOf = (i: number) => {
      const p = this.rgba(i);
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / len));
      return Math.abs(p[0] - a[0] - t * d[0]) + Math.abs(p[1] - a[1] - t * d[1]) + Math.abs(p[2] - a[2] - t * d[2]) < 45;
    };
    for (let round = 0; round < 3; round++) {
      const edge: number[] = [];
      for (let i = 0; i < this.n; i++) {
        if (this.a(i) <= 8) continue;
        const x = i % this.w;
        const next = [x > 0 ? i - 1 : -1, x < this.w - 1 ? i + 1 : -1, i - this.w, i + this.w];
        if (next.some((j) => j < 0 || j >= this.n || this.a(j) <= 8) && mixOf(i)) edge.push(i);
      }
      edge.forEach((i) => this.clear(i));
    }
  }
  /** The box around the kept pixels; rows and columns with fewer than `min` of them don't count. */
  bounds(keep: (i: number) => boolean, min = 1) {
    const rows = new Array(this.h).fill(0);
    const cols = new Array(this.w).fill(0);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (keep(y * this.w + x)) {
          rows[y]++;
          cols[x]++;
        }
    const first = (a: number[]) => a.findIndex((v) => v >= min);
    const last = (a: number[]) => a.length - 1 - [...a].reverse().findIndex((v) => v >= min);
    const [x0, y0] = [first(cols), first(rows)];
    if (x0 < 0 || y0 < 0) return null;
    const [x1, y1] = [last(cols), last(rows)];
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  crop(b: { x: number; y: number; w: number; h: number }) {
    const out = Buffer.alloc(b.w * b.h * 4);
    for (let y = 0; y < b.h; y++) this.d.copy(out, y * b.w * 4, ((b.y + y) * this.w + b.x) * 4, ((b.y + y) * this.w + b.x + b.w) * 4);
    return new Px(out, b.w, b.h);
  }
  copy() {
    return new Px(Buffer.from(this.d), this.w, this.h);
  }
  /** The one colour most of the edge has (90%+ of its visible pixels), if any. */
  plainEdge(): RGBA | null {
    // A couple of pixels in, past the soft (anti-aliased) outline.
    const ring = this.border(Math.min(3, Math.floor(Math.min(this.w, this.h) / 10)));
    const edge = ring.filter((i) => this.a(i) > 200);
    if (edge.length < ring.length * 0.5) return null;
    // The most common colour along it, roughly.
    const count = new Map<number, number[]>();
    for (const i of edge) {
      const [r, g, b] = this.rgba(i);
      const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      if (!count.has(k)) count.set(k, []);
      count.get(k)!.push(i);
    }
    const top = [...count.values()].sort((a, b) => b.length - a.length)[0];
    const c = this.rgba(top[0]);
    return edge.filter((i) => this.near(i, c)).length >= edge.length * 0.9 ? c : null;
  }
  /** As a PNG, as big as fits what a logo may weigh (about 650 KB), at most 900 px. */
  async png() {
    for (let size = 900; ; size = Math.round(size * 0.8)) {
      const buf = await sharp(this.d, { raw: { width: this.w, height: this.h, channels: 4 } })
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      if (buf.length * 1.37 < 650_000 || size < 200) return `data:image/png;base64,${buf.toString("base64")}`;
    }
  }

}
