"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cancelForAbsence, markClientMessaged, reassign } from "../_actions/absence";

type Visit = {
  id: string;
  client: string;
  clientId: string;
  what: string;
  when: string;
  staffId: string;
  staffName: string;
  renter: boolean;
  messaged: string | null;
  hasEmail: boolean;
  wa: string | null;
  sms: string | null;
};

export function AffectedVisit(props: { visit: Visit; locale: string; people: { id: string; name: string }[]; canAct: boolean; canReassign: boolean; own?: boolean }) {
  const t = useTranslations("admin.absence");
  const router = useRouter();
  const v = props.visit;
  const [to, setTo] = useState("");
  const [notify, setNotify] = useState(v.hasEmail);
  const [messaged, setMessaged] = useState(v.messaged);
  const [pending, start] = useTransition();
  const others = props.people.filter((p) => p.id !== v.staffId);
  const message = () => {
    setMessaged(messaged ?? "✓");
    void markClientMessaged(v.id);
  };

  return (
    <div className="card grid gap-3 p-4">
      <div>
        <Link href={`/${props.locale}/admin/clients/${v.clientId}`} className="font-medium">
          {v.client}
        </Link>
        <p className="text-sm">
          {v.when} · {v.what}
        </p>
        <p className="text-sm text-red-700">{t("off", { name: v.staffName })}</p>
        {messaged && <p className="text-sm text-emerald-700">{t("messaged", { day: messaged })}</p>}
        {v.renter && props.own && <p className="text-xs text-muted">{t("renterHint")}</p>}
      </div>

      {!props.canAct ? (
        <p className="text-sm text-muted">{t("salonWillHandle")}</p>
      ) : (
        <>
          {props.canReassign && others.length > 0 && (
            <div className="grid gap-2">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select className="field" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("moveTo")}>
                  <option value="">{t("moveTo")}…</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!to || pending}
                  className="btn-primary"
                  onClick={() =>
                    start(async () => {
                      await reassign(v.id, to, notify);
                      router.refresh();
                    })
                  }
                >
                  {t("move")}
                </button>
              </div>
              {v.hasEmail && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  {t("emailClient")}
                </label>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {v.wa && (
              <a href={v.wa} target="_blank" rel="noreferrer" onClick={message} className="chip border border-emerald-200 bg-emerald-50 py-2 text-emerald-800">
                WhatsApp
              </a>
            )}
            {v.sms && (
              <a href={v.sms} onClick={message} className="chip border border-line bg-white py-2">
                SMS
              </a>
            )}
            <button
              disabled={pending}
              className="chip ml-auto border border-red-200 bg-white py-2 text-red-700"
              onClick={() => {
                if (!confirm(t("cancelConfirm"))) return;
                start(async () => {
                  await cancelForAbsence(v.id);
                  router.refresh();
                });
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
