"use client";
import { formatPhone } from "@/lib/phone";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { eraseClient, mergeClients } from "../../_actions/clients";
import { searchClients } from "../../_actions/visits";

type Other = { id: string; name: string; phone: string | null; email: string | null };

/**
 * Owner/manager tools for one client: merge a duplicate into them (suggested when name, phone or
 * email match), and erase their personal data on request (GDPR).
 */
export function ClientTools(props: { locale: string; id: string; name: string; suggestions: Other[] }) {
  const t = useTranslations("admin.clientTools");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Other[]>([]);
  const [pending, run] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const h = setTimeout(() => searchClients(q).then((r) => setFound(r.filter((c) => c.id !== props.id))), 200);
    return () => clearTimeout(h);
  }, [q, props.id]);

  const merge = (o: Other) =>
    confirm(t("mergeConfirm", { other: o.name, name: props.name })) && run(() => mergeClients(props.locale, props.id, o.id));
  const row = (o: Other) => (
    <li key={o.id} className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{o.name}</span>
        <span className="block truncate text-xs text-muted">{[formatPhone(o.phone), o.email].filter(Boolean).join(" · ") || "—"}</span>
      </span>
      <button type="button" disabled={pending} onClick={() => merge(o)} className="btn-ghost min-h-9 shrink-0 px-3 text-sm">
        {t("merge")}
      </button>
    </li>
  );

  return (
    <details className="card p-3 text-sm" open={props.suggestions.length > 0}>
      <summary className="cursor-pointer font-semibold">
        {t("title")}
        {props.suggestions.length > 0 && <span className="chip ml-2 bg-amber-100 text-amber-900">{t("possible", { count: props.suggestions.length })}</span>}
      </summary>
      <div className="mt-3 grid gap-3">
        {props.suggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted">{t("suggestionsHint")}</p>
            <ul className="divide-y divide-line">{props.suggestions.map(row)}</ul>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs text-muted">{t("mergeHint", { name: props.name })}</p>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
          {found.length > 0 && <ul className="divide-y divide-line">{found.slice(0, 8).map(row)}</ul>}
        </div>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs text-muted">{t("eraseHint")}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm(t("eraseConfirm", { name: props.name })) && run(() => eraseClient(props.locale, props.id))}
            className="btn-ghost w-full text-red-700"
          >
            {t("erase")}
          </button>
        </div>
      </div>
    </details>
  );
}
