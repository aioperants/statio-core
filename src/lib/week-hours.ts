import { hhmmToMinutes } from "./time";

/** Reads the week posted by <WeekHours>: up to two ranges per day, for days that are on. */
export function weekHoursFrom(form: FormData) {
  const time = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? hhmmToMinutes(v) : null);
  const out: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (form.get(`on${wd}`) !== "on") continue;
    for (const n of ["", "b"]) {
      const s = time(form.get(`start${n}${wd}`));
      const e = time(form.get(`end${n}${wd}`));
      if (s != null && e != null && e > s) out.push({ weekday: wd, startMin: s, endMin: e });
    }
  }
  return out;
}
