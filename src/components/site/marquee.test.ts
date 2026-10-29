import { describe, expect, it } from "vitest";
import { marqueeLoop } from "./site";

describe("the running services line", () => {
  // Wider than the widest column (1152 px), so two copies loop with no gap at any screen width.
  const roundWidth = (run: string[]) => run.reduce((w, x) => w + x.length * 17 + 42, 0);
  it("repeats a few services until one round is wider than the page's column", () => {
    for (const words of [["Cuts"], ["Beard", "Shave", "Cuts"], Array.from({ length: 12 }, (_, i) => `Service number ${i + 1}`)]) {
      const { run } = marqueeLoop(words);
      expect(roundWidth(run)).toBeGreaterThanOrEqual(2200);
      expect(run.length % words.length).toBe(0);
    }
  });
  it("moves at the same pace however many services there are", () => {
    const pace = (words: string[]) => roundWidth(marqueeLoop(words).run) / marqueeLoop(words).seconds;
    expect(Math.abs(pace(["Cuts"]) - pace(Array.from({ length: 12 }, (_, i) => `Service ${i}`)))).toBeLessThan(3);
  });
});
