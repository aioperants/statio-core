"use client";
import { useTranslations } from "next-intl";
import { downloadQr } from "@/components/admin/qr-download";
import Link from "next/link";
import { useState } from "react";
import { DeviceFrame } from "@/components/admin/device-frame";
import { SubmitButton } from "@/components/admin/ui";
import type { BookingLook } from "@/lib/booking-look";
import { CopyLink } from "../../salon/copy-link";

/**
 * The booking page: its look (the website's, or clean black and white) with a live preview at a
 * phone's size, its link to copy, and a QR code to print for the front desk.
 */
export function BookingPageSettings({ look, path, url, salon, save }: { look: BookingLook; path: string; url: string; salon: string; save: (form: FormData) => void }) {
  const t = useTranslations("admin.bookingPage");
  const [chosen, setChosen] = useState<BookingLook>(look);
  const download = (kind: "png" | "svg") => downloadQr(url, salon, kind);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid grid-cols-1 gap-4">
        <form action={save} className="card grid grid-cols-1 gap-4 p-4">
          <div>
            <h2 className="font-semibold">{t("lookTitle")}</h2>
            <p className="text-sm text-muted">{t("lookHint")}</p>
          </div>
          <div className="grid gap-2">
            {(["site", "clean"] as const).map((k) => (
              <label key={k} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name="bookingLook" value={k} checked={chosen === k} onChange={() => setChosen(k)} className="mt-1 size-5 accent-brand" />
                <span>
                  <span className="block font-medium">{t(`look.${k}`)}</span>
                  <span className="block text-sm text-muted">{t(`lookHints.${k}`)}</span>
                </span>
              </label>
            ))}
          </div>
          <SubmitButton>{t("save")}</SubmitButton>
        </form>
        <section className="card grid grid-cols-1 gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("linkTitle")}</h2>
            <p className="text-sm text-muted">{t("linkHint")}</p>
          </div>
          <CopyLink value={url} share={{ title: salon }} />
        </section>
        <section className="card grid grid-cols-1 gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("qrTitle")}</h2>
            <p className="text-sm text-muted">{t("qrHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => download("png")} className="btn-ghost">
              ↓ {t("qrPng")}
            </button>
            <button type="button" onClick={() => download("svg")} className="btn-ghost">
              ↓ {t("qrSvg")}
            </button>
          </div>
        </section>
      </div>
      <section className="card grid gap-2 p-3 lg:sticky lg:top-20">
        <p className="px-1 text-sm font-medium">{t("preview")}</p>
        <DeviceFrame key={chosen} src={`${path}?look=${chosen}`} device="phone" height={640} title={t("preview")} className="rounded-xl bg-canvas" />
      </section>
    </div>
  );
}
