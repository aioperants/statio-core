"use client";
import { RentWhen } from "@/components/admin/rent-when";
import { PhoneInput } from "@/components/phone-input";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, SubmitButton, Toggle } from "@/components/admin/ui";
import { PhotoUpload } from "@/components/admin/photo-upload";
import { WeekHours } from "@/components/admin/week-hours";
import type { Access, Area, Level } from "@/lib/permissions";
import { removeStaff, saveStaff } from "../../_actions/team";
import { AccessPicker } from "./access-picker";

type PayModel = "owner" | "salary" | "commission" | "salary_commission" | "chair_rent";
interface Person {
  id: string;
  name: string;
  email: string;
  color: string;
  photo: string | null;
  title: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  access: Access;
  permissions: Record<string, string>;
  bookable: boolean;
  payModel: PayModel;
  ownsClients: boolean;
  salary: number | null;
  commissionPct: number | null;
  chairRent: number | null;
  chairRentPeriod: string;
  chairRentDay: number;
  defaultChairId: string | null;
  serviceIds: string[];
  /** Their own duration per service, where it differs from the standard. */
  durations: Record<string, number>;
  hours: { weekday: number; start: number; end: number }[];
}

const COLORS = ["#F6D9E6", "#DCE8FB", "#DDF3E4", "#FDEBD3", "#E9E0FA", "#FCE1DC", "#D9F1F3"];

export function StaffForm(props: {
  locale: string;
  /** Access levels the signed-in person may give, and the most they may grant per area. */
  accessChoices: Access[];
  accessCap: Record<Area, Level>;
  weekdays: string[];
  services: { id: string; name: string; durationMin: number }[];
  /** The salon's country, for the phone number's country code. */
  country: string | null;
  chairs: { id: string; name: string }[];
  person: Person | null;
  opening: { weekday: number; start: number; end: number }[];
}) {
  const t = useTranslations("admin.staff");
  const tc = useTranslations("common");
  const p = props.person;
  const [pay, setPay] = useState<PayModel>(p?.payModel ?? "commission");
  // Chair renters usually keep their own clients; the owner can change it either way.
  const [owns, setOwns] = useState(p?.ownsClients ?? false);
  const [color, setColor] = useState(p?.color ?? COLORS[1]);
  // A new person starts with the salon's opening hours (or Mon–Fri 9–18 if none are set).
  const startHours = p ? p.hours : props.opening.length ? props.opening : [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start: 540, end: 1080 }));

  return (
    <form action={saveStaff.bind(null, props.locale)} className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <div className="card grid gap-4 p-4">
        <PhotoUpload name={p?.name ?? ""} initial={p?.photo ?? null} color={color} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("firstName")}>
            <input name="name" required maxLength={60} autoComplete="off" className="field" defaultValue={p?.name} />
          </Field>
          <Field label={t("lastName")}>
            <input name="lastName" maxLength={60} autoComplete="off" className="field" defaultValue={p?.lastName} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("jobTitle")}>
            <input name="jobTitle" maxLength={60} className="field" placeholder={t("jobTitlePlaceholder")} defaultValue={p?.jobTitle} />
          </Field>
          <Field label={t("speciality")} hint={t("titleHint")}>
            <input name="title" maxLength={60} className="field" placeholder={t("titlePlaceholder")} defaultValue={p?.title} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* The owner's email is their sign-in: changed in Sign-in & security, with a link to the new address. */}
          <Field label={t("email")} hint={p?.access === "owner" ? t("ownerEmailHint") : p ? t("emailChangeHint") : t("emailHint")}>
            <input name="email" type="email" required={p?.access !== "owner"} readOnly={p?.access === "owner"} className="field read-only:bg-canvas read-only:text-muted" defaultValue={p?.email} />
          </Field>
          <Field label={t("mobile")} hint={t("mobileHint")}>
            <PhoneInput name="phone" defaultValue={p?.phone} country={props.country} locale={props.locale} />
          </Field>
        </div>
        <div>
          <span className="label">{t("color")}</span>
          <input type="hidden" name="color" value={color} />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} style={{ background: c }} className={`size-9 rounded-full border-2 ${c === color ? "border-ink" : "border-transparent"}`} aria-label={c} />
            ))}
          </div>
        </div>
        <Toggle name="bookable" label={t("bookable")} defaultChecked={p?.bookable ?? true} />
      </div>

      <div className="card grid gap-3 p-4">
        <div>
          <h2 className="font-semibold">{t("accessTitle")}</h2>
          <p className="text-sm text-muted">{t("accessHint")}</p>
        </div>
        <AccessPicker access={p?.access ?? "stylist"} permissions={p?.permissions ?? {}} choices={props.accessChoices} cap={props.accessCap} />
      </div>

      {props.services.length > 0 && (
        <div className="card grid gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("services")}</h2>
            <p className="text-sm text-muted">{t("theirTimeHint")}</p>
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {props.services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-2.5 pl-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" name="services" value={s.id} defaultChecked={p ? p.serviceIds.includes(s.id) : true} className="size-4 accent-brand" />
                  <span className="truncate">{s.name}</span>
                </label>
                {/* Their own time for it; empty = the service's standard duration. */}
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <input
                    name={`dur.${s.id}`}
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    placeholder={String(s.durationMin)}
                    defaultValue={p?.durations[s.id] ?? ""}
                    aria-label={t("theirTime", { service: s.name })}
                    className="field min-h-9 w-20 py-1 text-right"
                  />
                  min
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card grid gap-1 p-4">
        <h2 className="mb-2 font-semibold">{t("hours")}</h2>
        <WeekHours weekdays={props.weekdays} hours={startHours} labels={{ split: t("split"), off: t("off") }} />
      </div>

      <div className="card grid gap-4 p-4">
        <h2 className="font-semibold">{t("pay")}</h2>
        <div className="flex flex-wrap gap-2">
          {(["salary", "commission", "salary_commission", "chair_rent", ...(p?.access === "owner" ? (["owner"] as const) : [])] as PayModel[]).map((m) => (
            <label key={m} className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm font-medium ${pay === m ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
              <input type="radio" name="payModel" value={m} checked={pay === m} onChange={() => { setPay(m); setOwns(m === "chair_rent"); }} className="sr-only" />
              {t(`payModels.${m}`)}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(pay === "salary" || pay === "salary_commission") && (
            <Field label={t("salary")}>
              <input name="salary" inputMode="decimal" className="field" defaultValue={p?.salary ?? ""} />
            </Field>
          )}
          {(pay === "commission" || pay === "salary_commission") && (
            <Field label={t("commission")}>
              <input name="commissionPct" type="number" min={0} max={100} className="field" defaultValue={p?.commissionPct ?? 40} />
            </Field>
          )}
          {pay === "chair_rent" && (
            <div className="col-span-2 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Field label={t("chairRentAmount")}>
                <input name="chairRent" inputMode="decimal" className="field" defaultValue={p?.chairRent ?? ""} />
              </Field>
              <RentWhen every={p?.chairRentPeriod === "week" ? "week" : "month"} day={p?.chairRentDay ?? 1} locale={props.locale} />
            </div>
          )}
          {props.chairs.length > 0 && (
            <Field label={t("chair")}>
              <select name="defaultChairId" className="field" defaultValue={p?.defaultChairId ?? ""}>
                <option value="">—</option>
                {props.chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {p?.access !== "owner" && (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="ownsClients" checked={owns} onChange={(e) => setOwns(e.target.checked)} className="mt-0.5 size-5 accent-brand" />
            <span className="flex-1">
              <span className="block font-medium">{t("ownsClients")}</span>
              <span className="mt-0.5 block text-sm text-muted">{t("ownsClientsHint")}</span>
            </span>
          </label>
        )}
      </div>

      <SubmitButton>{tc("save")}</SubmitButton>
      {p && p.access !== "owner" && (
        <button
          type="button"
          className="btn-danger"
          onClick={() => confirm(t("removeConfirm", { name: p.name })) && removeStaff(props.locale, p.id)}
        >
          {t("remove")}
        </button>
      )}
    </form>
  );
}
