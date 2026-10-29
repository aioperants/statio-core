"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { hhmmToMinutes } from "@/lib/time";
import { addBlock, removeBlock } from "../_actions/visits";

export function BlockForm(props: { today: string; meId: string; canSalon: boolean; people: { id: string; name: string }[] }) {
  const t = useTranslations("admin.block");
  const tc = useTranslations("common");
  const ta = useTranslations("admin.absence");
  const locale = useLocale();
  const [clashes, setClashes] = useState(0);
  const router = useRouter();
  const [who, setWho] = useState<string>(props.meId);
  const [from, setFrom] = useState(props.today);
  const [to, setTo] = useState(props.today);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("18:00");
  const [reason, setReason] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, run] = useTransition();

  return (
    <form
      className="card grid gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await addBlock({
            staffId: who === "salon" ? null : who,
            from,
            to: allDay ? (to < from ? from : to) : from,
            startMin: allDay ? null : hhmmToMinutes(start),
            endMin: allDay ? null : hhmmToMinutes(end),
            reason,
            onlineOnly,
          });
          setMsg(!r.ok ? tc("error") : r.clashes ? t("clash", { count: r.clashes }) : tc("saved"));
          setClashes(r.ok ? (r.clashes ?? 0) : 0);
          if (r.ok) {
            setReason("");
            router.refresh();
          }
        });
      }}
    >
      <label>
        <span className="label">{t("who")}</span>
        <select className="field" value={who} onChange={(e) => setWho(e.target.value)}>
          {props.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {props.canSalon && <option value="salon">{t("salon")}</option>}
        </select>
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="size-5 accent-brand" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        {t("allDay")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={allDay ? "" : "col-span-2"}>
          <span className="label">{t("day")}</span>
          <input type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </label>
        {allDay ? (
          <label>
            <span className="label">{t("untilDay")}</span>
            <input type="date" className="field" value={to < from ? from : to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        ) : (
          <>
            <label>
              <span className="label">{t("from")}</span>
              <input type="time" step={300} className="field" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              <span className="label">{t("to")}</span>
              <input type="time" step={300} className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <label>
        <span className="label">
          {t("reason")} <span className="font-normal">({tc("optional")})</span>
        </span>
        <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-0.5 size-5 accent-brand" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
        <span className="text-sm">{t("onlineOnly")}</span>
      </label>
      {msg && <p className="text-sm font-medium">{msg}</p>}
      {clashes > 0 && (
        <Link href={`/${locale}/admin/affected`} className="btn-ghost">
          {ta("resolve")} ›
        </Link>
      )}
      <button disabled={pending} className="btn-primary">
        {t("save")}
      </button>
    </form>
  );
}

export function RemoveBlock({ id }: { id: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => run(async () => { await removeBlock(id); router.refresh(); })}
      className="flex size-9 items-center justify-center rounded-full text-muted active:bg-canvas"
      aria-label="Remove"
    >
      ✕
    </button>
  );
}
