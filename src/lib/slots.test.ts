import { describe, expect, it } from "vitest";
import { findSlots, recommendedStarts, type SlotInput, type SlotService, type SlotStaff } from "./slots";
import { addDays, localToUtc, utcToLocal, weekdayOf } from "./time";

const h = (hh: number, mm = 0) => hh * 60 + mm;

const cut: SlotService = { id: "cut", durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, stationKind: null };
const colour: SlotService = { id: "colour", durationMin: 90, bufferBeforeMin: 0, bufferAfterMin: 15, stationKind: "basin" };
const pedicure: SlotService = { id: "pedi", durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, stationKind: "pedicure" };

function person(id: string, over: Partial<SlotStaff> = {}): SlotStaff {
  return {
    id,
    services: { cut: {}, colour: {}, pedi: {} },
    hours: [{ start: h(9), end: h(18) }],
    off: [],
    booked: [],
    ...over,
  };
}

function input(over: Partial<SlotInput> = {}): SlotInput {
  return {
    services: [cut],
    staff: [person("anna")],
    stations: [{ id: "basin1", kind: "basin", booked: [] }, { id: "pedi1", kind: "pedicure", booked: [] }],
    closed: [],
    rules: { stepMin: 30, earliestStart: 0, compactDay: false, dailyLimit: null },
    staffId: null,
    ...over,
  };
}

const starts = (i: SlotInput) => findSlots(i).map((s) => s.start);

describe("findSlots", () => {
  it("offers every step that fits inside working hours", () => {
    const s = starts(input());
    expect(s[0]).toBe(h(9));
    expect(s[s.length - 1]).toBe(h(17)); // 17:00–18:00 is the last hour
    expect(s).toHaveLength(17);
  });

  it("never overlaps an existing booking", () => {
    const s = starts(input({ staff: [person("anna", { booked: [{ start: h(10), end: h(11) }] })] }));
    expect(s).not.toContain(h(9, 30));
    expect(s).not.toContain(h(10));
    expect(s).not.toContain(h(10, 30));
    expect(s).toContain(h(9));
    expect(s).toContain(h(11));
  });

  it("respects buffers after a service", () => {
    const i = input({
      services: [colour],
      staff: [person("anna", { booked: [{ start: h(12), end: h(13) }] })],
    });
    // 10:00 + 90 min + 15 min buffer = 11:45, fits before 12:00
    expect(starts(i)).toContain(h(10));
    // 10:30 + 90 + 15 = 12:15 overlaps the 12:00 booking
    expect(starts(i)).not.toContain(h(10, 30));
  });

  it("handles part-time hours and split shifts", () => {
    const i = input({ staff: [person("lena", { hours: [{ start: h(9), end: h(12) }, { start: h(16), end: h(18) }] })] });
    const s = starts(i);
    expect(s).toContain(h(11));
    expect(s).not.toContain(h(11, 30));
    expect(s).not.toContain(h(13));
    expect(s).toContain(h(16));
  });

  it("skips time off and salon closures", () => {
    const s1 = starts(input({ staff: [person("anna", { off: [{ start: h(9), end: h(13) }] })] }));
    expect(s1[0]).toBe(h(13));
    const s2 = starts(input({ closed: [{ start: 0, end: h(14) }] }));
    expect(s2[0]).toBe(h(14));
  });

  it("respects the earliest start (notice period)", () => {
    const s = starts(input({ rules: { stepMin: 30, earliestStart: h(15, 10), compactDay: false, dailyLimit: null } }));
    expect(s[0]).toBe(h(15, 30));
  });

  it("books several services back to back with the same person", () => {
    const slots = findSlots(input({ services: [colour, cut] }));
    const first = slots[0];
    expect(first.lines.map((l) => [l.serviceId, l.start, l.end])).toEqual([
      ["colour", h(9), h(10, 30)],
      ["cut", h(10, 30), h(11, 30)],
    ]);
    // Last start: 150 min of work must end by 18:00
    expect(slots[slots.length - 1].start).toBe(h(15, 30));
  });

  it("uses a person's own duration for a service", () => {
    const slots = findSlots(input({ staff: [person("anna", { services: { cut: { durationMin: 45 } } })] }));
    expect(slots[0].end).toBe(h(9, 45));
  });

  it("only offers people who do every chosen service", () => {
    const i = input({ staff: [person("anna", { services: { cut: {} } }), person("lena", { services: { pedi: {} } })], services: [pedicure] });
    expect(new Set(findSlots(i).map((s) => s.staffId))).toEqual(new Set(["lena"]));
  });

  it("needs a free shared station", () => {
    const busyPedicureChair = [{ id: "pedi1", kind: "pedicure", booked: [{ start: h(9), end: h(12) }] }];
    const s = starts(input({ services: [pedicure], stations: busyPedicureChair }));
    expect(s[0]).toBe(h(12));
    const noStation = starts(input({ services: [pedicure], stations: [] }));
    expect(noStation).toEqual([]);
  });

  it("assigns the station to the slot", () => {
    const slot = findSlots(input({ services: [pedicure] }))[0];
    expect(slot.lines[0].stationId).toBe("pedi1");
  });

  it("stops online booking at the daily limit", () => {
    const busy = person("anna", { booked: [{ start: h(9), end: h(10) }, { start: h(10), end: h(11) }] });
    expect(starts(input({ staff: [busy], rules: { stepMin: 30, earliestStart: 0, compactDay: false, dailyLimit: 2 } }))).toEqual([]);
    expect(starts(input({ staff: [busy], rules: { stepMin: 30, earliestStart: 0, compactDay: false, dailyLimit: 3 } })).length).toBeGreaterThan(0);
  });

  it("compact day: only offers times next to existing bookings", () => {
    const busy = person("anna", { booked: [{ start: h(10), end: h(12, 30) }] });
    const s = starts(input({ staff: [busy], rules: { stepMin: 30, earliestStart: 0, compactDay: true, dailyLimit: null } }));
    expect(s).toEqual([h(9), h(12, 30)]);
  });

  it("compact day: an empty day offers everything", () => {
    const s = starts(input({ rules: { stepMin: 30, earliestStart: 0, compactDay: true, dailyLimit: null } }));
    expect(s).toHaveLength(17);
  });

  it("compact day: finds the exact time before a booking that is off the grid", () => {
    const busy = person("anna", { booked: [{ start: h(14, 10), end: h(15) }] });
    const s = starts(input({ staff: [busy], rules: { stepMin: 30, earliestStart: 0, compactDay: true, dailyLimit: null } }));
    expect(s).toContain(h(13, 10));
    expect(s).toContain(h(15));
  });

  it("anyone: one slot per time, preferring the person it fits best", () => {
    const anna = person("anna", { booked: [{ start: h(10), end: h(11) }] });
    const marco = person("marco");
    const slots = findSlots(input({ staff: [anna, marco] }));
    const at = (t: number) => slots.find((s) => s.start === t)!;
    expect(at(h(11)).staffId).toBe("anna"); // right after Anna's booking
    expect(at(h(10)).staffId).toBe("marco"); // Anna is busy
    expect(at(h(14)).staffId).toBe("marco"); // fewer bookings
    expect(new Set(slots.map((s) => s.start)).size).toBe(slots.length);
  });

  it("a chosen person only gets their own slots", () => {
    const slots = findSlots(input({ staff: [person("anna"), person("marco")], staffId: "marco" }));
    expect(slots.every((s) => s.staffId === "marco")).toBe(true);
  });
});

describe("time helpers", () => {
  it("converts Madrid local time to UTC across daylight saving", () => {
    expect(localToUtc("2026-07-01", h(10), "Europe/Madrid").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(localToUtc("2026-12-01", h(10), "Europe/Madrid").toISOString()).toBe("2026-12-01T09:00:00.000Z");
    // Clocks go back on 25 Oct 2026: 10:00 that day is already winter time
    expect(localToUtc("2026-10-25", h(10), "Europe/Madrid").toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("round-trips UTC to local", () => {
    expect(utcToLocal(new Date("2026-07-01T08:00:00Z"), "Europe/Madrid")).toEqual({ day: "2026-07-01", minutes: h(10) });
  });

  it("knows weekdays and adds days across months", () => {
    expect(weekdayOf("2026-10-16")).toBe(4); // Friday
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("recommended times", () => {
  it("scores how well a time fits: no gap on either side is best", () => {
    const busy = person("anna", { booked: [{ start: h(10), end: h(11) }, { start: h(12), end: h(13) }] });
    const slots = findSlots(input({ staff: [busy] }));
    const fit = (m: number) => slots.find((s) => s.start === m)?.fit;
    expect(fit(h(11))).toBe(2); // fills 11:00–12:00 exactly
    expect(fit(h(9))).toBe(2); // start of the day and right before 10:00
    expect(fit(h(13))).toBe(1); // right after a booking
    expect(fit(h(14))).toBe(0);
    expect(fit(h(17))).toBe(1); // end of the day
  });

  it("recommends the best fits, everything else stays bookable", () => {
    const busy = person("anna", { booked: [{ start: h(10), end: h(11) }, { start: h(12), end: h(13) }] });
    const slots = findSlots(input({ staff: [busy] }));
    const rec = recommendedStarts(slots);
    expect(rec).toEqual([h(9), h(11), h(13), h(17)]);
    expect(slots.length).toBeGreaterThan(rec.length);
  });

  it("with recommending on, also offers the exact time right after an off-grid booking", () => {
    const busy = person("anna", { booked: [{ start: h(10), end: h(10, 45) }] });
    const s = starts(input({ staff: [busy], rules: { stepMin: 30, earliestStart: 0, compactDay: false, exactNeighbours: true, dailyLimit: null } }));
    expect(s).toContain(h(10, 45));
    expect(s).toContain(h(14)); // and still everything else
  });
});

describe("recommended times with anyone", () => {
  it("gives each time to the person it fits, so start-of-day times stay recommended", () => {
    const early = person("anna", { hours: [{ start: h(9), end: h(14) }] });
    const late = person("marco", { hours: [{ start: h(12), end: h(18) }] });
    const slots = findSlots(input({ staff: [early, late] }));
    expect(slots.find((s) => s.start === h(12))).toMatchObject({ staffId: "marco", fit: 1 });
    expect(slots.find((s) => s.start === h(9))).toMatchObject({ staffId: "anna", fit: 1 });
  });
});

describe("recommended times with a clean-up buffer", () => {
  it("the last visit of the day still counts as filling the end", () => {
    const busy = person("anna", { booked: [{ start: h(9), end: h(10) }] });
    const s = findSlots(input({ services: [colour], staff: [busy] }));
    expect(s.find((x) => x.start === h(16, 30))?.fit).toBe(1); // colour ends 18:00, clean-up after
  });
});

describe("recommended times on an empty day", () => {
  it("only the first time of the day is recommended", () => {
    const slots = findSlots(input());
    expect(recommendedStarts(slots)).toEqual([h(9)]);
  });
});
