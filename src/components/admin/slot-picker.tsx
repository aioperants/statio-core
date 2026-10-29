"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { hhmm } from "@/lib/format";
import { adminSlots } from "@/app/[locale]/admin/_actions/visits";

type Load = (q: { day: string; serviceIds: string[]; staffId: string | null; excludeId?: string }) => Promise<{ start: number; staffId: string }[]>;

/** Day + free times (the admin's by default; the client's reschedule page passes its own `load`). Reports the chosen slot. */
export function SlotPicker(props: {
  day: string;
  onDay: (d: string) => void;
  serviceIds: string[];
  staffId: string | null;
  excludeId?: string;
  value: { start: number; staffId: string } | null;
  onChange: (s: { start: number; staffId: string } | null) => void;
  staffNames: Record<string, string>;
  load?: Load;
  min?: string;
}) {
  const t = useTranslations("admin.newBooking");
  const tc = useTranslations("common");
  const [slots, setSlots] = useState<{ start: number; staffId: string }[] | null>(null);
  const { day, serviceIds, staffId, excludeId, onChange } = props;
  const key = serviceIds.join(",");

  useEffect(() => {
    let live = true;
    onChange(null);
    if (!serviceIds.length) {
      setSlots([]);
      return;
    }
    setSlots(null);
    (props.load ?? adminSlots)({ day, serviceIds, staffId, excludeId }).then((s) => live && setSlots(s));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, key, staffId, excludeId]);

  return (
    <div className="grid gap-3">
      <label>
        <span className="label">{t("day")}</span>
        <input type="date" className="field" value={day} min={props.min} onChange={(e) => e.target.value && props.onDay(e.target.value)} />
      </label>
      <div>
        <span className="label">{t("time")}</span>
        {slots === null ? (
          <p className="text-sm text-muted">{tc("loading")}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted">{serviceIds.length ? t("noSlots") : "—"}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => {
              const on = props.value?.start === s.start;
              return (
                <button
                  type="button"
                  key={s.start}
                  onClick={() => onChange(s)}
                  className={`rounded-xl border py-2.5 text-center text-sm font-semibold ${on ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                >
                  {hhmm(s.start)}
                  {!staffId && Object.keys(props.staffNames).length > 1 && (
                    <span className="block text-[10px] font-normal opacity-80">{props.staffNames[s.staffId]}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
