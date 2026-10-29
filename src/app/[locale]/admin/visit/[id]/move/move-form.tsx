"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SlotPicker } from "@/components/admin/slot-picker";
import { moveVisit } from "../../../_actions/visits";

export function MoveForm(props: {
  id: string;
  locale: string;
  day: string;
  staffId: string;
  canPickStaff: boolean;
  serviceIds: string[];
  people: { id: string; name: string }[];
  hasEmail: boolean;
}) {
  const t = useTranslations("admin");
  const tb = useTranslations("book.errors");
  const router = useRouter();
  const [day, setDay] = useState(props.day);
  const [staffId, setStaffId] = useState<string | null>(props.staffId);
  const [slot, setSlot] = useState<{ start: number; staffId: string } | null>(null);
  const [notify, setNotify] = useState(props.hasEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
      {props.canPickStaff && props.people.length > 1 && (
        <label>
          <span className="label">{t("newBooking.staff")}</span>
          <select className="field" value={staffId ?? ""} onChange={(e) => setStaffId(e.target.value || null)}>
            {props.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <SlotPicker
        day={day}
        onDay={setDay}
        serviceIds={props.serviceIds}
        staffId={staffId}
        excludeId={props.id}
        value={slot}
        onChange={setSlot}
        staffNames={Object.fromEntries(props.people.map((p) => [p.id, p.name]))}
      />
      {props.hasEmail && (
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-5 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {t("newBooking.notify")}
        </label>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        disabled={!slot || pending}
        className="btn-primary"
        onClick={() =>
          start(async () => {
            const r = await moveVisit({ id: props.id, day, start: slot!.start, staffId: slot!.staffId, notify });
            if (r.ok) router.push(`/${props.locale}/admin/visit/${props.id}`);
            else setError(tb(r.error === "slot_unavailable" ? "slot_unavailable" : "invalid"));
          })
        }
      >
        {t("visit.move")}
      </button>
    </div>
  );
}
