"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { joinWithPassword } from "./actions";

/** Choosing their own password from the invite (nobody else ever sees it). */
export function JoinForm({ token, email, next }: { token: string; email: string; next: string }) {
  const t = useTranslations("join");
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [pending, run] = useTransition();
  return (
    <form
      action={(form) =>
        run(async () => {
          const r = await joinWithPassword(token, form);
          if (r.ok) window.location.href = next;
          else setError(t(`errors.${r.error}`));
        })
      }
      className="card grid gap-3 p-5"
    >
      <div className="text-center">
        <h2 className="text-lg font-semibold">{t("passwordTitle")}</h2>
        <p className="text-sm text-muted">{t("passwordHint")}</p>
      </div>
      <input type="email" autoComplete="username" value={email} readOnly className="field bg-canvas" />
      <label>
        <span className="label">{t("password")}</span>
        <input name="password" type={show ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" className="field" />
      </label>
      <label>
        <span className="label">{t("repeat")}</span>
        <input name="repeat" type={show ? "text" : "password"} required minLength={10} maxLength={128} autoComplete="new-password" className="field" />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-brand" />
        {t("show")}
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {t("create")}
      </button>
    </form>
  );
}
