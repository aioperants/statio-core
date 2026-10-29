"use client";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/admin/ui";
import { confirmRecoveryEmail, finishRecovery, requestRecovery, type AskState } from "./actions";

/** "Lost access to your email?": the owner types their second email. */
export function AskForm({ locale }: { locale: string }) {
  const t = useTranslations("recovery");
  const [state, action] = useActionState<AskState, FormData>(requestRecovery.bind(null, locale), {});
  if (state.sent)
    return (
      <div role="status" className="card p-5">
        <p className="font-semibold">{t("sentTitle")}</p>
        <p className="mt-1 text-muted">{t("sentHint")}</p>
      </div>
    );
  return (
    <form action={action} className="card grid gap-4 p-5">
      <label>
        <span className="label">{t("email")}</span>
        <input name="email" type="email" required className="field" autoComplete="email" inputMode="email" />
        <span className="mt-1 block text-sm text-muted">{t("emailHint")}</span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {t("errorEmail")}
        </p>
      )}
      <SubmitButton>{t("send")}</SubmitButton>
    </form>
  );
}

/**
 * One tap on a page rather than on the link itself: mail apps open links to check them, and that
 * alone must never confirm or move anything.
 */
export function TicketButton({ locale, token, kind }: { locale: string; token: string; kind: "confirm" | "move" }) {
  const t = useTranslations("recovery");
  const [pending, start] = useTransition();
  const [state, setState] = useState<"done" | "gone" | null>(null);
  if (state === "done") return <p className="card p-5 text-center font-medium text-emerald-800">✓ {t("confirmed")}</p>;
  if (state === "gone") return <p className="card p-5 text-center text-muted">{t("expired")}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-primary w-full"
      onClick={() =>
        start(async () => {
          // Moving signs them in and opens the app.
          const r = kind === "confirm" ? await confirmRecoveryEmail(locale, token) : await finishRecovery(locale, token);
          const go = (r as { go?: string }).go;
          if (go) window.location.assign(go);
          else setState(r.ok ? "done" : "gone");
        })
      }
    >
      {pending ? "…" : t(kind === "confirm" ? "confirmButton" : "moveButton")}
    </button>
  );
}
