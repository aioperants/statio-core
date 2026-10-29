import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { prepareLogo } from "./logo-prep";

const toUrl = async (svg: string) => `data:image/png;base64,${(await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64")}`;
const meta = async (url: string) => {
  const img = sharp(Buffer.from(url.split(",")[1], "base64"));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, alphaAt: (x: number, y: number) => data[(y * info.width + x) * 4 + 3] };
};

describe("getting a logo ready", () => {
  it("cuts the white margin around a dark rounded tile (as image generators make them), corners transparent", async () => {
    const url = await toUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#ffffff"/><rect x="60" y="60" width="280" height="280" rx="30" fill="#14271f"/><circle cx="200" cy="180" r="60" fill="#c9a24b"/><rect x="110" y="270" width="180" height="24" fill="#c9a24b"/></svg>`,
    );
    const r = (await prepareLogo(url))!;
    const m = await meta(r.image);
    expect(Math.abs(m.w - 280)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.h - 280)).toBeLessThanOrEqual(2);
    expect(m.alphaAt(0, 0)).toBe(0);
    expect(m.alphaAt(140, 140)).toBe(255);
    // The tile's own colour can be removed too, leaving the gold drawing.
    expect(r.background).toBe("#14271f");
    const c = await meta(r.cutout!);
    expect(c.w).toBeLessThan(m.w);
  });

  it("cuts a transparent margin", async () => {
    const url = await toUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect x="100" y="70" width="100" height="50" fill="#cc2233"/></svg>`);
    const m = await meta((await prepareLogo(url))!.image);
    expect([m.w, m.h]).toEqual([100, 50]);
  });

  it("leaves a logo with no margin as it is", async () => {
    const url = await toUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="120" height="60" fill="url(#g)"/></svg>`,
    );
    const r = (await prepareLogo(url))!;
    const m = await meta(r.image);
    expect([m.w, m.h]).toEqual([120, 60]);
    expect(r.cutout).toBeNull();
  });

  it("keeps a dark tile without margin whole (its colour is only removed if the owner asks)", async () => {
    const url = await toUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#14271f"/><circle cx="100" cy="100" r="40" fill="#c9a24b"/></svg>`);
    const r = (await prepareLogo(url))!;
    expect((await meta(r.image)).w).toBe(200);
    expect(r.background).toBe("#14271f");
    expect((await meta(r.cutout!)).w).toBeLessThanOrEqual(82);
  });
});
