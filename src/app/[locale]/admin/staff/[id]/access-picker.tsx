"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { type Access, AREAS, type Area, type Level, LEVELS, PRESETS } from "@/lib/permissions";

/**
 * What a person can do: a ready-made access level, each explained in one line, and, if needed,
 * exceptions per area. Posts `access`, `customise` and `perm.<area>`.
 */
export function AccessPicker(props: {
  access: Access;
  permissions: Record<string, string>;
  /** Levels the signed-in person may hand out (only the owner gives manager access). */
  choices: Access[];
  /** The highest level the signed-in person may grant per area (their own). */
  cap: Record<Area, Level>;
}) {
  const t = useTranslations("admin.staff.access");
  const [access, setAccess] = useState<Access>(props.access);
  const [custom, setCustom] = useState(Object.keys(props.permissions).length > 0);
  const [levels, setLevels] = useState<Record<Area, Level>>(() => ({ ...PRESETS[props.access], ...(props.permissions as Record<Area, Level>) }));

  if (props.access === "owner") {
    return (
      <div className="rounded-xl bg-canvas p-3 text-sm">
        <span className="font-medium">{t("levels.owner")}</span> · {t("hints.owner")}
      </div>
    );
  }
  const pick = (a: Access) => {
    setAccess(a);
    setLevels({ ...PRESETS[a] });
  };
  return (
    <div className="grid gap-2">
      <input type="hidden" name="access" value={access} />
      {props.choices.map((a) => (
        <label key={a} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
          <input type="radio" name="accessChoice" checked={access === a} onChange={() => pick(a)} className="mt-1 size-4 accent-brand" />
          <span>
            <span className="block font-medium">{t(`levels.${a}`)}</span>
            <span className="block text-sm text-muted">{t(`hints.${a}`)}</span>
          </span>
        </label>
      ))}
      <label className="mt-1 flex cursor-pointer items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="customise" checked={custom} onChange={(e) => (setCustom(e.target.checked), !e.target.checked && setLevels({ ...PRESETS[access] }))} className="size-4 accent-brand" />
        {t("customise")}
      </label>
      {custom && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {AREAS.map((area) => (
                <tr key={area}>
                  <td className="p-2.5">
                    <span className="block font-medium">{t(`areas.${area}`)}</span>
                    <span className="block text-xs text-muted">{t(`areaHints.${area}`)}</span>
                  </td>
                  <td className="p-2.5 text-right">
                    <select
                      name={`perm.${area}`}
                      value={levels[area]}
                      onChange={(e) => setLevels((l) => ({ ...l, [area]: e.target.value as Level }))}
                      className={`field min-h-9 w-auto py-1 ${levels[area] !== PRESETS[access][area] ? "border-brand" : ""}`}
                    >
                      {LEVELS.filter((l) => LEVELS.indexOf(l) <= LEVELS.indexOf(props.cap[area])).map((l) => (
                        <option key={l} value={l}>
                          {t(`levelNames.${l}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
