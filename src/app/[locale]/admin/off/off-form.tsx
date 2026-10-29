"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addDays } from "@/lib/time";
import { PersonPicker } from "@/components/admin/person-picker";
import { reportOff } from "../_actions/absence";

export function OffForm(props: { locale: string; today: string; people: { id: string; name: string; photo: string | null; color: string }[]; me: string; mode: "owner" | "staff" | "renter" }) {
  const t = useTranslations("admin.absence");
  const [who, setWho] = useState(props.people.find((p) => p.id !== props.me)?.id ?? props.me);
  const [when, setWhen] = useState<"today" | "tomorrow" | "days">("today");
  const [from, setFrom] = useState(props.today);
  const [to, setTo] = useState(props.today);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const range = when === "today" ? [props.today, props.today] : when === "tomorrow" ? [addDays(props.today, 1), addDays(props.today, 1)] : [from, to < from ? from : to];

  if (done != null) {
    return (
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <p className="card p-5 font-medium">
          {done === 0 ? t("doneNone") : props.mode === "owner" ? t("doneOwner", { count: done }) : props.mode === "renter" ? t("doneRenter", { count: done }) : t("doneStaff", { count: done })}
        </p>
        {done > 0 && props.mode !== "staff" && (
          <Link href={`/${props.locale}/admin/affected`} className="btn-primary">
            {t("resolve")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
      {props.people.length > 1 && (
        <div>
          <span className="label">{t("who")}</span>
          <PersonPicker people={props.people} value={who} onChange={(id) => id && setWho(id)} />
        </div>
      )}
      <div>
        <span className="label">{t("when")}</span>
        <div className="grid grid-cols-3 gap-2">
          {(["today", "tomorrow", "days"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setWhen(k)} className={`rounded-xl border py-3 font-medium ${when === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
              {t(k)}
            </button>
          ))}
        </div>
      </div>
      {when === "days" && (
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">{t("from")}</span>
            <input type="date" className="field" value={from} min={props.today} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label>
            <span className="label">{t("to")}</span>
            <input type="date" className="field" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
      )}
      <label>
        <span className="label">{t("reason")}</span>
        <input className="field" value={reason} placeholder={t("reasonPlaceholder")} onChange={(e) => setReason(e.target.value)} />
      </label>
      <button
        disabled={pending}
        className="btn-primary"
        onClick={() =>
          start(async () => {
            const r = await reportOff({ staffId: props.mode === "owner" ? who : undefined, from: range[0], to: range[1], reason });
            if (r.ok) setDone(r.visits);
          })
        }
      >
        {props.mode === "owner" ? t("sendOwner") : t("send")}
      </button>
    </div>
  );
}
