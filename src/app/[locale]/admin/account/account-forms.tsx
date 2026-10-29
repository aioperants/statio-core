"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/admin/ui";
import { removeRecoveryEmail, setRecoveryEmail, signOutOtherDevices, type RecoveryState } from "../_actions/account";

export function SignOutOthers() {
  const t = useTranslations("admin.account");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <p className="text-sm text-emerald-800">✓ {t("devicesDone")}</p>;
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-ghost"
      onClick={() => confirm(t("devicesConfirm")) && start(async () => (await signOutOtherDevices(), setDone(true)))}
    >
      {pending ? "…" : t("devicesButton")}
    </button>
  );
}

/** The owner's second email: shown (partly hidden) once confirmed, or a box to add one. */
export function RecoveryEmail({ locale, current }: { locale: string; current: string | null }) {
  const t = useTranslations("admin.account");
  const router = useRouter();
  const [state, action] = useActionState<RecoveryState, FormData>(setRecoveryEmail.bind(null, locale), {});
  const [changing, setChanging] = useState(false);
  const [pending, start] = useTransition();
  if (state.sent) return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {t("recoverySent", { email: state.sent })}</p>;
  if (current && !changing)
    return (
      <div className="grid gap-2">
        <p className="font-medium">✓ {current}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setChanging(true)}>
            {t("recoveryChange")}
          </button>
          <button
            type="button"
            disabled={pending}
            className="btn-ghost text-red-700"
            onClick={() => confirm(t("recoveryRemoveConfirm")) && start(async () => (await removeRecoveryEmail(locale), router.refresh()))}
          >
            {t("recoveryRemove")}
          </button>
        </div>
      </div>
    );
  return (
    <form action={action} className="grid gap-3">
      {!current && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("recoveryNone")}</p>}
      <label>
        <span className="label">{t("recoveryEmail")}</span>
        <input name="email" type="email" required className="field" autoComplete="email" inputMode="email" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {t(`recoveryErrors.${state.error}`)}
        </p>
      )}
      <SubmitButton>{t("recoverySend")}</SubmitButton>
    </form>
  );
}
