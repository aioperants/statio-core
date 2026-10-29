"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, SubmitButton } from "@/components/admin/ui";
import { deleteEquipment, saveEquipment } from "../../_actions/equipment";
import { Camera, Chair, Scissors } from "@/components/icons";

interface Item {
  id: string;
  name: string;
  kind: string;
  location: string | null;
  note: string | null;
  photo: string | null;
  rented: boolean;
  monthlyCost: number | null;
}

export function EquipmentForm(props: { locale: string; isManager: boolean; people: { id: string; name: string }[]; item: Item | null; defaultOwner: string | null; salon: string }) {
  const t = useTranslations("admin.equipment");
  const tc = useTranslations("common");
  const i = props.item;
  const [owner, setOwner] = useState(props.defaultOwner ?? "");
  const [kind, setKind] = useState(i?.kind ?? "tool");
  const [rented, setRented] = useState(i?.rented ?? false);
  const [photo, setPhoto] = useState(i?.photo ?? "");

  // A small square JPEG, kept with the item.
  async function pick(file: File) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(480, side);
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
  }
  const chip = (on: boolean) => `cursor-pointer rounded-full border px-3.5 py-2 text-sm font-medium ${on ? "border-brand bg-brand text-white" : "border-line bg-white"}`;

  return (
    <>
      <form action={saveEquipment.bind(null, props.locale)} className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <input type="hidden" name="id" value={i?.id ?? ""} />
        <input type="hidden" name="photo" value={photo} />
        <div className="card grid gap-4 p-4">
          <div className="flex gap-2">
            {(["tool", "equipment"] as const).map((k) => (
              <label key={k} className={chip(kind === k)}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {t(`kinds.${k}`)}
              </label>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted">{t("kindHint")}</p>
          <Field label={t("name")}>
            <input name="name" required maxLength={100} className="field" placeholder={t(kind === "equipment" ? "namePlaceholderEquipment" : "namePlaceholderTool")} defaultValue={i?.name} />
          </Field>
          {props.isManager && (
            <Field label={t("owner")}>
              <select name="owner" className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">{t("salon", { salon: props.salon })}</option>
                {props.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t("location")}>
            <input name="location" maxLength={100} className="field" placeholder={t("locationPlaceholder")} defaultValue={i?.location ?? ""} />
          </Field>
          <Field label={t("note")}>
            <textarea name="note" rows={2} maxLength={500} className="field" defaultValue={i?.note ?? ""} />
          </Field>
          <div className="flex items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-20 rounded-2xl object-cover" />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-2xl bg-canvas text-2xl">{kind === "equipment" ? <Chair className="size-8" /> : <Scissors className="size-8" />}</span>
            )}
            <div className="grid gap-1.5">
              <label className="btn-ghost min-h-10 cursor-pointer text-sm">
                <Camera className="inline size-4 align-[-3px]" /> {photo ? t("changePhoto") : t("addPhoto")}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
              </label>
              {photo && (
                <button type="button" onClick={() => setPhoto("")} className="text-sm text-muted">
                  {t("removePhoto")}
                </button>
              )}
            </div>
          </div>
        </div>
        {props.isManager && owner === "" && (
          <div className="card grid gap-3 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="rented" checked={rented} onChange={(e) => setRented(e.target.checked)} className="mt-0.5 size-5 accent-brand" />
              <span>
                <span className="block font-medium">{t("rented")}</span>
                <span className="block text-sm text-muted">{t("rentedHint")}</span>
              </span>
            </label>
            {rented && (
              <Field label={t("monthlyCost")}>
                <input name="monthlyCost" inputMode="decimal" className="field" defaultValue={i?.monthlyCost ?? ""} />
              </Field>
            )}
          </div>
        )}
        <SubmitButton>{tc("save")}</SubmitButton>
      </form>
      {i && (
        <form action={deleteEquipment.bind(null, props.locale, i.id)} className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-8">
          <SubmitButton className="btn-ghost w-full text-red-700">{t("delete")}</SubmitButton>
        </form>
      )}
    </>
  );
}
