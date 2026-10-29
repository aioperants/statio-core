"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { useLogoAdjust } from "@/components/admin/logo-adjust";

/**
 * The logo: picked, its empty margin cut off and adjusted ("Adjust your logo"), then saved with the
 * salon's details. The trimmed upload is kept too, to adjust it again later.
 */
export function LogoUpload({ name, initial, original }: { name: string; initial: string | null; original?: string | null }) {
  const t = useTranslations("admin.salon");
  const ta = useTranslations("admin.logoAdjust");
  const [logo, setLogo] = useState(initial ?? "");
  const [source, setSource] = useState(original ?? initial ?? "");
  const la = useLogoAdjust({
    name,
    onSave: (adjusted, trimmed) => {
      setLogo(adjusted);
      setSource(trimmed);
    },
  });

  return (
    <div className="grid gap-3">
      <span className="label">{t("logo")}</span>
      <input type="hidden" name="logo" value={logo} />
      <input type="hidden" name="logoOriginal" value={logo ? source : ""} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-h-[120px] min-w-[120px] max-w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-canvas p-3">
          <Logo name={name} logo={logo || null} size={96} />
        </div>
        <div className="grid gap-2">
          <label className={`btn-ghost cursor-pointer ${la.busy ? "pointer-events-none opacity-50" : ""}`}>
            {t("upload")}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && la.pick(e.target.files[0])} />
          </label>
          {logo && (
            <button type="button" onClick={() => la.adjust(source || logo)} className="btn-ghost">
              {ta("adjust")}
            </button>
          )}
          {logo && (
            <button type="button" onClick={() => setLogo("")} className="text-sm text-muted underline">
              {t("removeLogo")}
            </button>
          )}
        </div>
      </div>
      {la.error && <p className="text-sm text-red-700">{la.error}</p>}
      <p className="text-xs text-muted">{t("logoHint")}</p>
      {la.sheet}
    </div>
  );
}
