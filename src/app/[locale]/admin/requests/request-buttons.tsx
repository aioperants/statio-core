"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { changeVisit } from "../_actions/visits";
import { approveAll, markWelcome } from "../_actions/welcome";

export function RequestButtons({ id }: { id: string }) {
  const t = useTranslations("admin.visit");
  const router = useRouter();
  const [pending, run] = useTransition();
  const act = (a: "approve" | "decline") => run(async () => { await changeVisit(id, a); router.refresh(); });
  return (
    <div className="grid grid-cols-2 gap-2">
      <button disabled={pending} onClick={() => act("approve")} className="btn-primary">
        ✓ {t("approve")}
      </button>
      <button disabled={pending} onClick={() => act("decline")} className="btn-danger">
        {t("decline")}
      </button>
    </div>
  );
}

export function ApproveAllButton({ count }: { count: number }) {
  const t = useTranslations("admin.requests");
  const router = useRouter();
  const [pending, run] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm(t("approveAllConfirm", { count })) && run(async () => { await approveAll(); router.refresh(); })}
      className="btn-primary w-full"
    >
      ✓ {t("approveAll", { count })}
    </button>
  );
}

/** One tap opens WhatsApp or Messages with the welcome written; the owner presses send there. */
export function WelcomeButtons({ id, wa, sms }: { id: string; wa: string | null; sms: string | null }) {
  const t = useTranslations("admin.requests");
  const router = useRouter();
  const [pending, run] = useTransition();
  const mark = (how: "whatsapp" | "sms" | "skipped") => run(async () => { await markWelcome(id, how); router.refresh(); });
  return (
    <div className="grid grid-cols-3 gap-2">
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" onClick={() => mark("whatsapp")} className="btn-ghost border-emerald-200 bg-emerald-50 text-emerald-800">
          WhatsApp
        </a>
      )}
      {sms && (
        <a href={sms} onClick={() => mark("sms")} className="btn-ghost">
          SMS
        </a>
      )}
      <button disabled={pending} onClick={() => mark("skipped")} className="btn-ghost text-muted">
        {t("skip")}
      </button>
    </div>
  );
}
