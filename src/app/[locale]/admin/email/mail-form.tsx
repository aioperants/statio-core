"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Field, SubmitButton } from "@/components/admin/ui";
import { saveMail, testMail } from "../_actions/mail";

type Choice = "env" | "none" | "resend" | "smtp";
type Saved = { provider: "none" | "resend" | "smtp"; from: string; hasResendKey: boolean; smtpHost: string; smtpPort: number; smtpUser: string; hasSmtpPass: boolean };

/** Common mailboxes and providers, to fill in the server and port. */
const PRESETS = [
  { key: "google", host: "smtp.gmail.com", port: 587 },
  { key: "microsoft", host: "smtp.office365.com", port: 587 },
  { key: "brevo", host: "smtp-relay.brevo.com", port: 587 },
  { key: "other", host: "", port: 587 },
] as const;

export function MailForm({ locale, env, saved }: { locale: string; env: "resend" | "smtp" | null; saved: Saved | null }) {
  const t = useTranslations("admin.mail");
  const [choice, setChoice] = useState<Choice>(saved?.provider ?? (env ? "env" : "resend"));
  const [host, setHost] = useState(saved?.smtpHost ?? "");
  const [port, setPort] = useState(saved?.smtpPort ?? 587);
  const [preset, setPreset] = useState<string>(PRESETS.find((p) => p.host && p.host === saved?.smtpHost)?.key ?? "other");
  const [test, setTest] = useState<{ ok: boolean; to: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const kept = t("kept");

  // No "No email" choice: sign-in and online booking need email (kept only for a copy that saved it).
  const options: Choice[] = [...(env ? (["env"] as const) : []), "resend", "smtp", ...(saved?.provider === "none" ? (["none"] as const) : [])];
  return (
    <>
      <form action={saveMail.bind(null, locale)} className="grid gap-4">
        <div className="card grid gap-2 p-4">
          {options.map((o) => (
            <label key={o} className={`flex gap-3 rounded-xl border p-3 ${choice === o ? "border-brand bg-brand-soft" : "border-line bg-white"}`}>
              <input type="radio" name="provider" value={o} checked={choice === o} onChange={() => setChoice(o)} className="mt-1 size-4 accent-brand" />
              <span>
                <span className="block font-medium">{t(`providers.${o}`, { env: env ?? "" })}</span>
                <span className="block text-xs text-muted">{t(`providersHint.${o}`)}</span>
              </span>
            </label>
          ))}
        </div>

        {(choice === "resend" || choice === "smtp") && (
          <div className="card grid gap-4 p-4">
            {choice === "smtp" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPreset(p.key);
                        if (p.host) setHost(p.host);
                        setPort(p.port);
                      }}
                      className={`chip border py-2 ${preset === p.key ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                    >
                      {t(`presets.${p.key}`)}
                    </button>
                  ))}
                </div>
                <p className="-mt-1 text-xs text-muted">{t(`presetHint.${preset}`)}</p>
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <Field label={t("host")}>
                    <input name="smtpHost" required value={host} onChange={(e) => setHost(e.target.value)} className="field" placeholder="smtp.salon.com" autoCapitalize="off" />
                  </Field>
                  <Field label={t("port")}>
                    <input name="smtpPort" type="number" required value={port} onChange={(e) => setPort(Number(e.target.value))} className="field" />
                  </Field>
                </div>
                <Field label={t("user")}>
                  <input name="smtpUser" required defaultValue={saved?.smtpUser} className="field" placeholder="citas@salon.com" autoCapitalize="off" autoComplete="off" />
                </Field>
                <Field label={t("password")}>
                  <input name="smtpPass" type="password" required={!saved?.hasSmtpPass} className="field" placeholder={saved?.hasSmtpPass ? kept : ""} autoComplete="new-password" />
                </Field>
              </>
            )}
            {choice === "resend" && (
              <Field label={t("resendKey")} hint={t("resendKeyHint")}>
                <input name="resendKey" type="password" required={!saved?.hasResendKey} className="field" placeholder={saved?.hasResendKey ? kept : "re_…"} autoComplete="off" />
              </Field>
            )}
            <Field label={t("from")} hint={t("fromHint")}>
              <input name="from" type="email" defaultValue={saved?.from} required={choice === "resend"} className="field" placeholder="citas@salon.com" />
            </Field>
          </div>
        )}
        <SubmitButton>{t("save")}</SubmitButton>
      </form>

      <div className="card grid gap-2 p-4">
        <button
          type="button"
          disabled={pending}
          className="btn-ghost"
          onClick={() => start(async () => setTest(await testMail()))}
        >
          ✉︎ {t("test")}
        </button>
        <p className="text-xs text-muted">{t("testHint")}</p>
        {test &&
          (test.ok ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {t("testOk", { to: test.to })}</p>
          ) : (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{test.error === "off" ? t("testOff") : t("testFail", { error: test.error ?? "" })}</p>
          ))}
      </div>
    </>
  );
}
