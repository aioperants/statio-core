"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createInvite, emailInvite, pauseAccess, resetAccess, resumeAccess } from "../../_actions/invites";
import { LinkIcon } from "@/components/icons";

/**
 * Their access: signed in, invited (until when), or not invited yet; a personal invite link to
 * copy or send by WhatsApp or email; "Reset sign-in" to sign them out everywhere; and "Pause access"
 * to switch their access off (and on again) while they stay on the team.
 */
export function InvitePanel(props: {
  locale: string;
  id: string;
  name: string;
  phone: string | null;
  hasEmail: boolean;
  status: "active" | "invited" | "none" | "paused";
  validUntil: string | null;
  open: boolean;
}) {
  const t = useTranslations("admin.staff.invite");
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const act = (fn: typeof createInvite, done: string) =>
    run(async () => {
      const r = await fn(props.locale, props.id);
      if (r.ok) {
        setLink(r.link);
        setNote(done);
      } else setNote(t("needEmail"));
      router.refresh();
    });
  const toggle = (fn: typeof pauseAccess, done: string) =>
    run(async () => {
      await fn(props.locale, props.id);
      setLink(null);
      setNote(done);
      router.refresh();
    });
  const message = link && t("message", { name: props.name, link });
  const chip = { active: "bg-emerald-100 text-emerald-800", invited: "bg-amber-100 text-amber-900", none: "bg-canvas text-muted", paused: "bg-red-50 text-red-800" }[props.status];

  return (
    <div className="card grid min-w-0 gap-3 overflow-hidden p-4" id="access">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{t("title")}</h2>
        <span className={`chip ${chip}`}>{t(`status.${props.status}`)}</span>
      </div>
      <p className="text-sm text-muted">
        {props.status === "paused" ? t("pausedHint") : props.status === "active" ? t("activeHint") : props.status === "invited" && props.validUntil ? t("invitedHint", { day: props.validUntil }) : t("noneHint")}
      </p>
      {!props.hasEmail && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("needEmail")}</p>}
      {props.hasEmail && props.status !== "active" && props.status !== "paused" && !link && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={() => act(createInvite, t("created"))} className={props.open ? "btn-primary" : "btn-ghost"}>
            <LinkIcon className="inline size-4 align-[-3px]" /> {t("create")}
          </button>
          <button disabled={pending} onClick={() => act(emailInvite, t("emailed"))} className="btn-ghost">
            ✉︎ {t("email")}
          </button>
        </div>
      )}
      {link && (
        <div className="grid min-w-0 gap-2">
          {note && <p className="text-sm text-emerald-800">✓ {note}</p>}
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-canvas p-2 pl-3">
            <span className="min-w-0 flex-1 truncate text-sm select-all">{link}</span>
            <button type="button" className="btn-ghost min-h-9 shrink-0 px-3 text-sm" onClick={() => navigator.clipboard.writeText(link).catch(() => {})}>
              {t("copy")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {props.phone && (
              <a
                href={`https://wa.me/${props.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message!)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost border-emerald-200 bg-emerald-50 text-emerald-800"
              >
                WhatsApp
              </a>
            )}
            <button disabled={pending} onClick={() => act(emailInvite, t("emailed"))} className="btn-ghost">
              ✉︎ {t("email")}
            </button>
          </div>
          <p className="text-xs text-muted">{t("linkRules")}</p>
        </div>
      )}
      {props.status === "active" && !link && (
        <button
          disabled={pending}
          onClick={() => confirm(t("resetConfirm", { name: props.name })) && act(resetAccess, t("resetDone"))}
          className="btn-ghost text-red-700"
        >
          {t("reset")}
        </button>
      )}
      {note && !link && props.status === "paused" && <p className="text-sm text-emerald-800">✓ {note}</p>}
      {props.status === "paused" ? (
        <button disabled={pending} onClick={() => toggle(resumeAccess, t("resumed"))} className="btn-primary">
          {t("resume")}
        </button>
      ) : (
        (props.status === "active" || props.status === "invited") &&
        !link && (
          <button
            disabled={pending}
            onClick={() => confirm(t("pauseConfirm", { name: props.name })) && toggle(pauseAccess, t("paused"))}
            className="btn-ghost"
          >
            {t("pause")}
          </button>
        )
      )}
    </div>
  );
}
