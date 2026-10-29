"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { money } from "@/lib/format";
import { addDays } from "@/lib/time";
import { checkoutVisit } from "../../_actions/visits";

const WEEKS = [3, 4, 5, 6, 8];

/**
 * Checkout: what the client actually paid and how, plus when they should come back.
 * An internal record for cashing up, not an invoice or ticket.
 */
type Method = "cash" | "card" | "other";

export function Checkout(props: {
  id: string;
  locale: string;
  currency: string;
  priceCents: number;
  paid: { cents: number; method: Method } | null;
  rebookDays: number | null;
  rebookBase: string;
  /** A walk-in guest: no "when next" or "book next visit" (there's no client to invite back). */
  guest?: boolean;
  today: string;
}) {
  const t = useTranslations("admin.checkout");
  const router = useRouter();
  const [amount, setAmount] = useState(((props.paid?.cents ?? props.priceCents) / 100).toString());
  const [days, setDays] = useState<number | null>(props.rebookDays);
  const [method, setMethod] = useState<Method>(props.paid?.method ?? "card");
  const [editing, setEditing] = useState(!props.paid);
  const [pending, run] = useTransition();
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const valid = Number.isFinite(cents) && cents >= 0;

  const nextDay = addDays(props.today, days && days > 0 ? days : 35);
  const rebookHref = `${props.rebookBase}&day=${nextDay}`;

  if (!editing && props.paid) {
    return (
      <div className="card grid gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex-1 font-semibold">✓ {t("paid", { amount: money(props.paid.cents, props.currency, props.locale), method: t(`methods.${props.paid.method}`) })}</span>
          <button onClick={() => setEditing(true)} className="text-sm font-medium text-brand">
            ✎
          </button>
        </div>
        {!props.guest && (
          <Link href={rebookHref} className="btn-primary">
            {t("bookNext")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="card grid gap-4 border-brand/30 p-4">
      <h2 className="font-semibold">{t("title")}</h2>
      <label>
        <span className="label">{t("price")}</span>
        <input className="field text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div>
        <span className="label">{t("method")}</span>
        <div className="grid grid-cols-3 gap-2">
          {(["cash", "card", "other"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-xl border py-2.5 text-sm font-semibold ${method === m ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
            >
              {t(`methods.${m}`)}
            </button>
          ))}
        </div>
      </div>
      {!props.guest && (
      <div>
        <span className="label">{t("next")}</span>
        <div className="flex flex-wrap gap-2">
          {[null, ...WEEKS.map((w) => w * 7)].map((d) => {
            const on = d === null ? !days : days === d;
            return (
              <button
                key={d ?? 0}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
              >
                {d === null ? t("noNext") : t("weeks", { n: d / 7 })}
              </button>
            );
          })}
          {days && !WEEKS.includes(days / 7) && <span className="rounded-full border border-brand bg-brand px-3 py-1.5 text-sm font-medium text-white">{days} d</span>}
        </div>
        {!!days && <p className="mt-1.5 text-xs text-muted">{t("nextHint")}</p>}
      </div>
      )}
      <button
        disabled={!valid || pending}
        className="btn-primary"
        onClick={() =>
          run(async () => {
            const r = await checkoutVisit(props.id, { paidCents: cents, method, rebookDays: days ?? 0 });
            if (r.ok) {
              setEditing(false);
              router.refresh();
            }
          })
        }
      >
        {props.paid ? t("update") : t("charge", { amount: valid ? money(cents, props.currency, props.locale) : "" })}
      </button>
    </div>
  );
}
