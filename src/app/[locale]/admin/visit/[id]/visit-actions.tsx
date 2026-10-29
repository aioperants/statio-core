"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { changeVisit, saveVisitNote } from "../../_actions/visits";

export function VisitActions(props: { id: string; status: string; notes: string; locale: string; past: boolean; checkout?: boolean; paid?: boolean }) {
  const t = useTranslations("admin.visit");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState(props.notes);
  const [error, setError] = useState(false);

  const act = (action: Parameters<typeof changeVisit>[1], ask?: string) => {
    if (ask && !confirm(ask)) return;
    start(async () => {
      const r = await changeVisit(props.id, action);
      setError(!r.ok);
      router.refresh();
    });
  };
  const s = props.status;
  // With the Finish box above, closing is "Charge and finish" there: no second "Done" next to it.
  const hideDone = props.checkout && s !== "completed";
  // Paid and closed: nothing left to mark (the payment can still be changed above).
  const closed = props.checkout && props.paid && s === "completed";

  return (
    <div className="grid gap-3">
      {error && <p className="text-sm text-red-700">{tc("error")}</p>}
      {s === "pending" && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={() => act("approve")} className="btn-primary">
            ✓ {t("approve")}
          </button>
          <button disabled={pending} onClick={() => act("decline")} className="btn-danger">
            {t("decline")}
          </button>
        </div>
      )}
      {s === "confirmed" && !props.past && <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("doneLater")}</p>}
      {!closed && ((s === "confirmed" && props.past) || s === "completed" || s === "no_show") && (
        <div className={`grid gap-2 ${hideDone ? "" : "grid-cols-2"}`}>
          {!hideDone && (
            <button disabled={pending || s === "completed"} onClick={() => act("done")} className={s === "completed" ? "btn-primary" : "btn-ghost"}>
              ✓ {t("done")}
            </button>
          )}
          <button disabled={pending || s === "no_show"} onClick={() => act("no_show")} className={s === "no_show" ? "btn-danger bg-red-50" : "btn-ghost"}>
            {t("noShow")}
          </button>
        </div>
      )}
      {(s === "pending" || s === "confirmed") && (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/${props.locale}/admin/visit/${props.id}/move`} className="btn-ghost">
            {t("move")}
          </Link>
          <button disabled={pending} onClick={() => act("cancel", t("cancelConfirm"))} className="btn-danger">
            {t("cancel")}
          </button>
        </div>
      )}
      <label className="mt-2">
        <span className="label">{t("notes")}</span>
        <textarea
          className="field"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== props.notes && start(() => saveVisitNote(props.id, notes).then(() => router.refresh()))}
        />
      </label>
    </div>
  );
}
