"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** The booking link with one-tap Copy, and Share (the phone's share sheet; copies where there's none). */
export function CopyLink({ value, share }: { value: string; share?: { title: string } }) {
  const t = useTranslations("admin.salon");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-canvas p-2 pl-3">
      <span className="min-w-0 flex-1 truncate text-sm select-all">{value}</span>
      <button
        type="button"
        className="btn-ghost min-h-9 shrink-0 px-3 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? `✓ ${t("copied")}` : t("copy")}
      </button>
      {share && (
        <button
          type="button"
          className="btn-primary min-h-9 shrink-0 px-3 text-sm"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: share.title, url: value });
              } catch {}
              return;
            }
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          {t("share")}
        </button>
      )}
    </div>
  );
}
