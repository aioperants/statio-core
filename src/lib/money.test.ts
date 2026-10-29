import { describe, expect, it } from "vitest";
import { dueDays, salaryDays } from "./money";

describe("money due days", () => {
  it("monthly on a day, within the period", () => {
    expect(dueDays("month", 1, "2026-10-01", "2026-11-01")).toEqual(["2026-10-01"]);
    expect(dueDays("month", 15, "2026-10-01", "2026-10-08")).toEqual([]);
    expect(dueDays("month", 10, "2026-09-20", "2026-11-15")).toEqual(["2026-10-10", "2026-11-10"]);
  });
  it("weekly on a weekday (0 = Monday)", () => {
    expect(dueDays("week", 0, "2026-10-01", "2026-11-01")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  });
  it("salaries on the last day of the month", () => {
    expect(salaryDays("2026-02-01", "2026-03-01")).toEqual(["2026-02-28"]);
    expect(salaryDays("2026-10-19", "2026-10-26")).toEqual([]);
  });
});
