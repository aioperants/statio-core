"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SlotPicker } from "@/components/admin/slot-picker";
import { clientSlots, rescheduleByClient } from "../actions";

export function ClientMoveForm(props: { token: string; locale: string; day: string; today: string; staffId: string; staffName: string; serviceIds: string[] }) {
  const t = useTranslations("manage");
  const tb = useTranslations("book.errors");
  const [day, setDay] = useState(props.day);
  const [anyone, setAnyone] = useState(false);
  const [slot, setSlot] = useState<{ start: number; staffId: string } | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="grid gap-3">
        <p className="card p-5 font-medium">{t("changed")}</p>
        <a className="btn-ghost" href={`/${props.locale}/manage/${props.token}`}>
          {t("back")}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        {[false, true].map((a) => (
          <button
            key={String(a)}
            type="button"
            onClick={() => setAnyone(a)}
            className={`rounded-xl border px-2 py-3 text-sm font-medium ${anyone === a ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
          >
            {a ? t("anyone") : t("samePerson", { name: props.staffName })}
          </button>
        ))}
      </div>
      <SlotPicker
        day={day}
        onDay={setDay}
        min={props.today}
        serviceIds={props.serviceIds}
        staffId={anyone ? null : props.staffId}
        value={slot}
        onChange={setSlot}
        staffNames={{}}
        load={(q) => clientSlots(props.token, q.day, anyone)}
      />
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button
        disabled={!slot || pending}
        className="btn-primary"
        onClick={() =>
          start(async () => {
            const r = await rescheduleByClient(props.token, day, slot!.start, anyone);
            if (r.ok) setDone(true);
            else setError(r.error && tb.has(r.error) ? tb(r.error) : tb("slot_unavailable"));
          })
        }
      >
        {t("confirmChange")}
      </button>
    </div>
  );
}
