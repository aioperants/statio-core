"use client";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { NEUTRAL, type AppColours, type Colours } from "@/lib/app-colours";

/** One choice for the app's own colours (admin, booking page, app icon): black and white, or the website's. */
export function AppColoursPicker({ initial, website, name, logo }: { initial: string; website: Colours; name: string; logo: string | null }) {
  const t = useTranslations("admin.salon.appColours");
  const options: { key: AppColours; colours: Colours }[] = [
    { key: "neutral", colours: NEUTRAL },
    { key: "website", colours: website },
  ];
  return (
    <fieldset className="grid gap-2">
      <legend className="label">{t("title")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ key, colours }) => (
          <label key={key} className="grid cursor-pointer gap-3 rounded-xl border border-line p-3 has-checked:border-ink has-checked:ring-1 has-checked:ring-ink">
            <span className="flex items-start gap-3">
              <input type="radio" name="appColours" value={key} defaultChecked={initial === key} className="mt-1 size-5 accent-ink" />
              <span>
                <span className="block font-medium">{t(key)}</span>
                <span className="block text-sm text-muted">{t(`${key}Hint`)}</span>
              </span>
            </span>
            <Preview colours={colours} name={name} logo={logo} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{t("websiteKeeps")}</p>
    </fieldset>
  );
}

function Preview({ colours, name, logo }: { colours: Colours; name: string; logo: string | null }) {
  const t = useTranslations("admin.salon");
  const soft = `color-mix(in srgb, ${colours.brand} 9%, white)`;
  return (
    <span
      aria-hidden
      style={{ background: colours.canvas, ["--brand" as string]: colours.brand, ["--color-brand" as string]: colours.brand }}
      className="grid gap-2 rounded-xl border border-line p-3"
    >
      <span className="flex items-center gap-2">
        <Logo name={name} logo={logo} size={28} />
        <span className="truncate text-sm font-semibold">{name}</span>
      </span>
      <span className="rounded-lg border border-line bg-white p-2 text-xs">
        <span className="mr-1.5 rounded-full px-2 py-0.5 font-semibold" style={{ background: soft, color: colours.brand }}>
          {t("previewChip")}
        </span>
        {t("previewService")}
      </span>
      <span style={{ background: colours.brand }} className="rounded-lg py-2 text-center text-xs font-semibold text-white">
        {t("previewButton")}
      </span>
    </span>
  );
}
