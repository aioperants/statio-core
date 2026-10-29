"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Mail } from "@/components/icons";

export function SignInForm(props: {
  providers: { google: boolean; microsoft: boolean };
  callbackURL: string;
  showStaffHint: boolean;
  /** From a staff invite: the email the owner entered, already filled in. */
  email?: string;
  /** Salon staff: their own wording, and signing in with the password they chose. */
  staff?: boolean;
  /** Whether this person can also sign in with a password. */
  passwords?: boolean;
  /** Back from Google or Microsoft without being signed in. */
  socialFailed?: boolean;
}) {
  const t = useTranslations("signin");
  const tc = useTranslations("common");
  const [email, setEmail] = useState(props.email ?? "");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [wrong, setWrong] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Until React has loaded, a tap would submit the form as a plain page reload and lose the email.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const social = (provider: "google" | "microsoft") => {
    setBusy(true);
    authClient.signIn.social({ provider, callbackURL: props.callbackURL }).catch(() => setBusy(false));
  };

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setWrong(false);
    const { error } = await authClient.signIn.email({ email, password, callbackURL: props.callbackURL });
    setBusy(false);
    if (error) setWrong(true);
    else window.location.href = props.callbackURL;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: props.callbackURL });
    setBusy(false);
    if (error) setError(true);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-6 text-center">
        <Mail className="mx-auto mb-2 size-9" />
        <h2 className="text-lg font-semibold">{t("linkSent")}</h2>
        <p className="mt-1 text-sm text-muted">{t("linkSentBody", { email })}</p>
      </div>
    );
  }

  return (
    <div className="card grid gap-3 p-5">
      <div className="mb-1 text-center">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t(props.staff ? "staffSubtitle" : "subtitle")}</p>
      </div>
      {props.socialFailed && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("socialFailed")}</p>}
      {props.providers.google && (
        <button disabled={busy} onClick={() => social("google")} className="btn-ghost w-full">
          <GoogleIcon /> {t("google")}
        </button>
      )}
      {props.providers.microsoft && (
        <button disabled={busy} onClick={() => social("microsoft")} className="btn-ghost w-full">
          <MicrosoftIcon /> {t("microsoft")}
        </button>
      )}
      {(props.providers.google || props.providers.microsoft) && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" /> {t("or")} <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <form onSubmit={usePassword ? withPassword : sendLink} className="grid gap-3">
        <label>
          <span className="label">{t("email")}</span>
          <input className="field" type="email" required autoComplete={usePassword ? "username" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {usePassword && (
          <label>
            <span className="label">{t("password")}</span>
            <input className="field" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {wrong && <p className="text-sm text-red-700">{t("wrongPassword")}</p>}
        <button disabled={busy || !ready} className="btn-primary w-full">
          {usePassword ? t("signInButton") : t("sendLink")}
        </button>
      </form>
      {props.staff && props.passwords && (
        <button type="button" onClick={() => (setUsePassword(!usePassword), setWrong(false))} className="text-sm font-medium text-brand">
          {usePassword ? t("useLink") : t("usePassword")}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{tc("error")}</p>}
      {props.showStaffHint && <p className="text-center text-xs text-muted">{t("staffHint")}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
