import { describe, expect, it } from "vitest";
import { freeGaps, mergeGaps, minutesInside, withinOpening } from "./gaps";

const h = (hh: number, mm = 0) => hh * 60 + mm;

describe("free gaps", () => {
  it("finds gaps between bookings in split shifts", () => {
    const hours = [{ start: h(9), end: h(13) }, { start: h(16), end: h(20) }];
    const busy = [{ start: h(9), end: h(10) }, { start: h(11), end: h(13) }, { start: h(16), end: h(16, 30) }];
    expect(freeGaps(hours, busy, 60)).toEqual([{ start: h(10), end: h(11) }, { start: h(16, 30), end: h(20) }]);
  });

  it("ignores time already past and short gaps", () => {
    expect(freeGaps([{ start: h(9), end: h(18) }], [{ start: h(15), end: h(17, 45) }], 30, h(14))).toEqual([{ start: h(14), end: h(15) }]);
  });

  it("counts booked minutes inside working hours only", () => {
    expect(minutesInside([{ start: h(9), end: h(12) }], [{ start: h(8), end: h(10) }, { start: h(11), end: h(13) }])).toBe(120);
  });
});

describe("merged gaps", () => {
  it("shows overlapping free time once, with everyone who is free", () => {
    const gaps = [
      { start: h(9), end: h(18), name: "Vitalik" },
      { start: h(9), end: h(14), name: "Marta" },
      { start: h(12), end: h(16), name: "Lena" },
      { start: h(18), end: h(20), name: "Ana" },
    ];
    expect(mergeGaps(gaps)).toEqual([
      { start: h(9), end: h(18), names: ["Vitalik", "Marta", "Lena"] },
      { start: h(18), end: h(20), names: ["Ana"] },
    ]);
  });
});

describe("opening hours", () => {
  it("cuts a person's hours to when the salon is open", () => {
    const opening = [{ start: h(10), end: h(14) }, { start: h(16), end: h(20) }];
    expect(withinOpening([{ start: h(9), end: h(18) }], opening)).toEqual([{ start: h(10), end: h(14) }, { start: h(16), end: h(18) }]);
  });
  it("closed day: nothing; not set up: unchanged", () => {
    expect(withinOpening([{ start: h(9), end: h(18) }], [])).toEqual([]);
    expect(withinOpening([{ start: h(9), end: h(18) }], null)).toEqual([{ start: h(9), end: h(18) }]);
  });
});
