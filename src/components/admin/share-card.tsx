"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Share something with clients from the owner's phone: the ready message (with its link) to send
 * by WhatsApp (to a person, a group or Status), copy for Instagram, or the phone's own share sheet.
 */
export function ShareCard({
  text: ready,
  link,
  title,
  hint,
}: {
  text: string;
  link: string;
  title: string;
  hint: string;
}) {
  const t = useTranslations("admin.share");
  const text = ready;
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const copy = async (what: "text" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "text" ? text : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };
  // Known only in the browser (after the first render, so server and browser HTML match).
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare("share" in navigator), []);
  return (
    <section id="share" className="card grid min-w-0 scroll-mt-20 gap-3 p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <p className="rounded-xl bg-canvas p-3 text-sm whitespace-pre-line">{text}</p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost border-emerald-200 bg-emerald-50 text-emerald-800"
        >
          WhatsApp
        </a>
        <button type="button" className="btn-ghost" onClick={() => copy("text")}>
          {copied === "text" ? `✓ ${t("copied")}` : t("copyText")}
        </button>
        <button type="button" className="btn-ghost" onClick={() => copy("link")}>
          {copied === "link" ? `✓ ${t("copied")}` : t("copyLink")}
        </button>
        {canShare && (
          <button type="button" className="btn-ghost" onClick={() => navigator.share({ text }).catch(() => {})}>
            {t("more")}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{t("instagram")}</p>
    </section>
  );
}
