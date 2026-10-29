import { describe, expect, it } from "vitest";
import { birthdayIn, clientRhythm, type PastVisit } from "./client-rhythm";

const base = { today: "2026-10-18", created: "2026-01-10", nextBooked: null, rhythmDays: null };
const v = (day: string, o: Partial<PastVisit> = {}): PastVisit => ({ day, group: "cuts", chosen: null, standard: 35, ...o });

describe("client rhythm", () => {
  it("starts from the service's standard estimate", () => {
    const r = clientRhythm({ ...base, visits: [v("2026-09-01", { standard: 30 })] });
    expect([r.everyDays, r.source, r.nextDue, r.state]).toEqual([30, "standard", "2026-10-01", "overdue"]);
  });
  it("uses what the professional chose at checkout when it differs from the standard", () => {
    const r = clientRhythm({ ...base, visits: [v("2026-09-20", { chosen: 56, standard: 35 })] });
    expect([r.everyDays, r.source, r.state]).toEqual([56, "professional", "regular"]);
  });
  it("learns the median gap after enough visits of the same kind, ignoring other services", () => {
    const visits = [v("2026-06-01"), v("2026-06-15", { group: "colour" }), v("2026-07-01"), v("2026-07-29"), v("2026-09-30")];
    const r = clientRhythm({ ...base, visits });
    expect([r.everyDays, r.source, r.learnedFrom]).toEqual([30, "learned", 4]);
  });
  it("a rhythm set by hand always wins", () => {
    const r = clientRhythm({ ...base, rhythmDays: 21, visits: [v("2026-10-01", { chosen: 56 })] });
    expect([r.everyDays, r.source, r.nextDue]).toEqual([21, "client", "2026-10-22"]);
  });
  it("is due soon from about 80% of the interval, booked when a visit is booked, new with no visits", () => {
    expect(clientRhythm({ ...base, visits: [v("2026-09-18", { standard: 35 })] }).state).toBe("dueSoon"); // due 23 Oct, soon from 16 Oct
    expect(clientRhythm({ ...base, visits: [v("2026-09-01")], nextBooked: "2026-10-25" }).state).toBe("booked");
    expect(clientRhythm({ ...base, visits: [] }).state).toBe("new");
    expect(clientRhythm({ ...base, visits: [], nextBooked: "2026-10-19" }).state).toBe("booked");
  });
  it("client since is the earlier of being added and the first visit", () => {
    expect(clientRhythm({ ...base, created: "2026-05-01", visits: [v("2025-12-01")] }).since).toBe("2025-12-01");
  });
});

describe("birthdays", () => {
  it("finds birthdays in the coming week, across the new year", () => {
    expect(birthdayIn("10-18", "2026-10-18")).toBe(0);
    expect(birthdayIn("10-24", "2026-10-18")).toBe(6);
    expect(birthdayIn("10-25", "2026-10-18")).toBeNull();
    expect(birthdayIn("01-02", "2026-12-29")).toBe(4);
    expect(birthdayIn("02-29", "2027-02-27")).toBe(1);
    expect(birthdayIn(null, "2026-10-18")).toBeNull();
  });
});
