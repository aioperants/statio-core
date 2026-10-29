/**
 * Picture helpers that run in the owner's browser (free and instant), used by setup:
 * a logo cut out of a photo of a card or sign, the colours of a logo, and a main photo made wide
 * and bright. Each is a first version; an outside AI service can replace one later (see the notes).
 */

const loadImage = async (src: string) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
};

function canvasOf(img: HTMLImageElement, max: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** The colour around the picture's edges (the card's paper, the sign's paint). */
function edgeColour(px: Uint8ClampedArray, w: number, h: number) {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const edge: number[][] = [];
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 60))) for (const y of [0, 1, h - 2, h - 1]) edge.push([px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 60))) for (const x of [0, 1, w - 2, w - 1]) edge.push([px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  const median = (i: number) => edge.map((c) => c[i]).sort((a, b) => a - b)[Math.floor(edge.length / 2)];
  return [median(0), median(1), median(2)];
}

/**
 * A logo from a photo of a business card or shop sign: the plain background becomes transparent,
 * the picture is cropped to the logo with a little margin, and it's at most 512 px. Null when no
 * logo stands out (then the owner frames it by hand). Later an AI cut-out or vectorising service
 * can do this instead, behind the same function.
 */
export async function cutOutLogo(src: string): Promise<string | null> {
  const c = canvasOf(await loadImage(src), 1200);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const bg = edgeColour(px, w, h);
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
      // Close to the background: see-through, with a soft edge so letters stay smooth.
      const keep = d < 40 ? 0 : d < 90 ? (d - 40) / 50 : 1;
      px[i + 3] = Math.round(px[i + 3] * keep);
      if (keep > 0.5) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const area = (x1 - x0) * (y1 - y0);
  if (x1 < 0 || area < w * h * 0.002 || area > w * h * 0.97) return null;
  ctx.putImageData(data, 0, 0);
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.06);
  const [sx, sy] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
  const [sw, sh] = [Math.min(w, x1 + pad) - sx, Math.min(h, y1 + pad) - sy];
  const scale = Math.min(1, 512 / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/**
 * The main colours of a logo, most used first (up to 3, clearly different from each other). Near
 * white and see-through parts are left out; a black-and-white logo gives its dark colour.
 */
export async function logoColours(src: string): Promise<string[]> {
  const c = canvasOf(await loadImage(src), 200);
  const px = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    if (Math.min(r, g, b) > 230) continue;
    const key = `${r >> 5}${g >> 5}${b >> 5}`;
    const s = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { n: s.n + 1, r: s.r + r, g: s.g + g, b: s.b + b });
  }
  const total = [...buckets.values()].reduce((a, s) => a + s.n, 0);
  const colours = [...buckets.values()]
    // Enough of it to matter (not the blend along letter edges), and either colourful or near black.
    .filter((s) => s.n > Math.max(8, total * 0.03))
    .filter((s) => saturation([s.r / s.n, s.g / s.n, s.b / s.n]) > 0.2 || Math.max(s.r, s.g, s.b) / s.n < 70)
    .map((s) => ({ n: s.n, c: [s.r / s.n, s.g / s.n, s.b / s.n] }))
    // Colourful ones count a little more than greys of the same amount.
    .sort((a, b) => b.n * (1 + saturation(b.c)) - a.n * (1 + saturation(a.c)));
  const picked: number[][] = [];
  for (const { c: col } of colours) {
    if (picked.every((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) > 70)) picked.push(col);
    if (picked.length === 3) break;
  }
  return picked.map((p) => hex(p[0], p[1], p[2]));
}

function saturation([r, g, b]: number[]) {
  const max = Math.max(r, g, b);
  return max ? (max - Math.min(r, g, b)) / max : 0;
}

/** What was done to a photo, said plainly to the owner. */
export type PhotoReport = { width: number; height: number; cropped: "none" | "topBottom" | "sides"; brightened: boolean; small: boolean };

/**
 * A photo for the top of the website, in the shape of the chosen layout (`ratio` = width / height:
 * 16/10 for "big photo behind your name", 4/5 for "photo beside your name"): cropped from the middle
 * (a little towards the top for upright photos), the light evened out only when it needs it (the
 * darkest and brightest 1% stretched), and at most `max` px wide. Below `min` it's kept but marked
 * small. Later an AI service could widen a photo instead of cropping it, behind the same function.
 */
export async function fitPhoto(src: string, ratio: number, min: { w: number; h: number }, max = 1600): Promise<{ url: string; report: PhotoReport }> {
  const img = await loadImage(src);
  const [w, h] = [img.naturalWidth, img.naturalHeight];
  let [sw, sh] = [w, h];
  if (w / h > ratio + 0.01) sw = h * ratio;
  else if (w / h < ratio - 0.01) sh = w / ratio;
  const [sx, sy] = [(w - sw) / 2, (h - sh) / 2.4];
  const scale = Math.min(1, max / sw);
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, sx, Math.max(0, sy), sw, sh, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < px.length; i += 4) hist[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++;
  const total = px.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  // Only a gentle stretch: photos that are already fine stay as they are.
  const brightened = hi - lo > 40 && (lo > 8 || hi < 247);
  if (brightened) {
    const k = 255 / (hi - lo);
    for (let i = 0; i < px.length; i += 4) for (let ch = 0; ch < 3; ch++) px[i + ch] = Math.max(0, Math.min(255, (px[i + ch] - lo) * k));
    ctx.putImageData(data, 0, 0);
  }
  let q = 0.85;
  let url = c.toDataURL("image/jpeg", q);
  while (url.length > 850_000 && q > 0.4) url = c.toDataURL("image/jpeg", (q -= 0.1));
  const cropped = sw < w - 1 ? "sides" : sh < h - 1 ? "topBottom" : "none";
  return { url, report: { width: w, height: h, cropped, brightened, small: sw < min.w || sh < min.h } };
}

/**
 * The shape and least size of the top photo for each layout of the top of the website. The least
 * sizes fit what AI apps make (ChatGPT: 1536 × 1024 wide, 1024 × 1536 upright), so a picture made
 * with "Make it with your AI app" passes once cropped to the shape.
 */
export const HERO_SHAPES = {
  photo: { ratio: 16 / 10, min: { w: 1500, h: 900 } },
  split: { ratio: 4 / 5, min: { w: 1000, h: 1250 } },
} as const;

/** The About us photo: upright beside the words (also what AI apps make upright, 1024 × 1536, trimmed). */
export const ABOUT_SHAPE = { ratio: 4 / 5, min: { w: 1000, h: 1250 } } as const;

/** The main photo for "big photo behind your name" (kept for callers that don't pick a layout). */
export async function enhanceMainPhoto(src: string): Promise<string> {
  return (await fitPhoto(src, HERO_SHAPES.photo.ratio, HERO_SHAPES.photo.min)).url;
}

/** A picked file as a data URL (no resizing). */
export const fileUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });

/** A picture's own size in pixels (before any resizing). */
export async function imageSize(src: string) {
  const img = await loadImage(src);
  return { w: img.naturalWidth, h: img.naturalHeight };
}

/**
 * A team photo: square, head and shoulders (the middle, a little towards the top, where faces
 * are), `size` px, JPEG.
 */
export async function squarePhoto(src: string, size = 600): Promise<string> {
  const img = await loadImage(src);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = Math.max(0, (img.naturalHeight - side) * 0.25);
  const c = document.createElement("canvas");
  c.width = c.height = Math.min(size, side);
  c.getContext("2d")!.drawImage(img, sx, sy, side, side, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/**
 * Whether a picture picked as a logo looks more like a flyer, poster or photo: wide, with lots of
 * fine detail (text, textures) and many colours. Only a gentle hint, never a block: a busy logo can
 * trip it, and a plain flyer can pass.
 */
export async function looksLikeFlyer(src: string): Promise<boolean> {
  const img = await loadImage(src);
  if (img.naturalWidth / img.naturalHeight < 1.4) return false;
  const c = canvasOf(img, 200);
  const { width: w, height: h } = c;
  const px = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  const lum = (i: number) => 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  let edges = 0;
  const colours = new Set<number>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) continue;
      if (Math.abs(lum(i) - lum(i + 4)) > 40) edges++;
      colours.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4));
    }
  // Tuned on a real barbershop flyer (edges 0.08, 126 colours) against cut-out logos and card photos (edges ≤ 0.02, ≤ 65 colours).
  return edges / (w * h) > 0.06 && colours.size > 100;
}
