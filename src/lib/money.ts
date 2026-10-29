import { addDays, weekdayOf } from "./time";

/**
 * Money for a period, in the owner's words: money in (services, chair rent), money out (staff pay,
 * regular costs) and profit. Regular amounts count on their due day, like a bank statement.
 */

export type Every = "month" | "week";

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The due days of something paid every month (on day 1–28) or week (weekday 0 = Monday) in [from, to). */
export function dueDays(every: Every, day: number, from: string, to: string): string[] {
  const out: string[] = [];
  if (every === "week") {
    for (let d = from; d < to; d = addDays(d, 1)) if (weekdayOf(d) === day) out.push(d);
    return out;
  }
  let [y, m] = from.split("-").map(Number);
  for (let i = 0; i < 400; i++) {
    const d = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, "0")}`;
    if (d >= to) break;
    if (d >= from) out.push(d);
    m === 12 ? ((y += 1), (m = 1)) : (m += 1);
  }
  return out;
}

/** Salaries are paid on the last day of the month. */
export function salaryDays(from: string, to: string) {
  return dueDays("month", 31, from, to);
}

/** The due day from a form: 1–28 for monthly, 0–6 (Monday…Sunday) for weekly. */
export function dueDayOf(every: unknown, day: unknown) {
  const n = Number(day);
  return every === "week" ? (Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0) : Number.isInteger(n) && n >= 1 && n <= 28 ? n : 1;
}
