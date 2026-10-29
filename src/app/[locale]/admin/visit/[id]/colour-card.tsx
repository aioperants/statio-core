"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { recordConsent, saveFormula } from "../../_actions/visits";

/**
 * For colour services (and others the salon marks): the formula used at this visit, the client's
 * previous formulas to repeat, and whether the patch test / allergy check was confirmed.
 */
export function ColourCard(props: {
  id: string;
  card: boolean;
  formula: string;
  previous: { day: string; formula: string }[];
  consent: { needed: boolean; at: string | null };
}) {
  const t = useTranslations("admin.colourCard");
  const router = useRouter();
  const [formula, setFormula] = useState(props.formula);
  const [saved, setSaved] = useState(false);
  const [pending, run] = useTransition();
  return (
    <div className="card grid gap-3 p-4">
      {props.consent.needed && (
        <div className={`flex items-center gap-3 rounded-xl p-3 text-sm ${props.consent.at ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          <span className="flex-1">{props.consent.at ? `✓ ${t("consentGiven", { day: props.consent.at })}` : t("consentMissing")}</span>
          {!props.consent.at && (
            <button disabled={pending} onClick={() => run(async () => (await recordConsent(props.id), router.refresh()))} className="btn-ghost min-h-9 shrink-0 bg-white px-3 text-sm">
              {t("record")}
            </button>
          )}
        </div>
      )}
      {props.card && (
        <>
          <h2 className="font-semibold">{t("title")}</h2>
          {props.previous.length > 0 && (
            <div className="grid gap-1.5 rounded-xl bg-canvas p-3 text-sm">
              <span className="text-xs text-muted">{t("previous")}</span>
              {props.previous.map((p) => (
                <p key={p.day + p.formula}>
                  <span className="text-muted">{p.day}:</span> <span className="whitespace-pre-line">{p.formula}</span>
                </p>
              ))}
              {!formula && (
                <button type="button" onClick={() => setFormula(props.previous[0].formula)} className="justify-self-start text-sm font-medium text-brand">
                  {t("repeat")}
                </button>
              )}
            </div>
          )}
          <textarea
            className="field"
            rows={3}
            maxLength={1000}
            value={formula}
            placeholder={t("placeholder")}
            onChange={(e) => (setFormula(e.target.value), setSaved(false))}
            onBlur={() => formula !== props.formula && run(async () => (await saveFormula(props.id, formula), setSaved(true), router.refresh()))}
          />
          {saved && <p className="text-xs text-emerald-800">✓ {t("saved")}</p>}
        </>
      )}
    </div>
  );
}
