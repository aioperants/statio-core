"use client";
import { useState } from "react";
import { hhmm } from "@/lib/format";

type Range = { start: number; end: number };

/**
 * A week of hours: each day on or off, with an optional second range for a split day.
 * Posts on{wd}, start{wd}/end{wd} and startb{wd}/endb{wd} (read back with weekHoursFrom).
 */
export function WeekHours({ weekdays, hours, labels }: { weekdays: string[]; hours: (Range & { weekday: number })[]; labels: { split: string; off: string } }) {
  const initial = (wd: number) => hours.filter((h) => h.weekday === wd).sort((a, b) => a.start - b.start);
  const [split, setSplit] = useState<boolean[]>(() => weekdays.map((_, i) => initial(i).length > 1));
  const [on, setOn] = useState<boolean[]>(() => weekdays.map((_, i) => initial(i).length > 0));
  return (
    <>
      {weekdays.map((name, wd) => {
        const h = initial(wd);
        const time = (m: number | undefined, fallback: number) => hhmm(m ?? fallback);
        return (
          <div key={wd} className="grid gap-2 border-b border-line py-2.5 last:border-0">
            <div className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  name={`on${wd}`}
                  checked={on[wd]}
                  onChange={(e) => setOn(on.map((x, i) => (i === wd ? e.target.checked : x)))}
                  className="size-5 accent-brand"
                />
                <span className="font-medium">{name}</span>
              </label>
              {on[wd] ? (
                <button type="button" onClick={() => setSplit(split.map((x, i) => (i === wd ? !x : x)))} className="text-xs font-semibold text-brand">
                  {split[wd] ? "− " : "+ "}
                  {labels.split}
                </button>
              ) : (
                <span className="text-sm text-muted">{labels.off}</span>
              )}
            </div>
            {on[wd] && (
              <div className="grid gap-2 pl-8 sm:grid-cols-2">
                <div className="flex items-center gap-1.5">
                  <input type="time" step={300} name={`start${wd}`} defaultValue={time(h[0]?.start, 540)} className="field min-w-0 flex-1 px-2 py-2" />
                  <span>–</span>
                  <input type="time" step={300} name={`end${wd}`} defaultValue={time(h[0]?.end, split[wd] ? 840 : 1080)} className="field min-w-0 flex-1 px-2 py-2" />
                </div>
                {split[wd] && (
                  <div className="flex items-center gap-1.5">
                    <input type="time" step={300} name={`startb${wd}`} defaultValue={time(h[1]?.start, 960)} className="field min-w-0 flex-1 px-2 py-2" />
                    <span>–</span>
                    <input type="time" step={300} name={`endb${wd}`} defaultValue={time(h[1]?.end, 1200)} className="field min-w-0 flex-1 px-2 py-2" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
