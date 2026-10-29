"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Camera } from "@/components/icons";

/** Picks a photo, crops it square from the centre and shrinks it (320 px JPEG), so it's stored with the person. */
export function PhotoUpload({ name, initial, color }: { name: string; initial: string | null; color: string }) {
  const t = useTranslations("admin.staff");
  const [photo, setPhoto] = useState(initial ?? "");

  async function pick(file: File) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(320, side);
    canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo" value={photo} />
      <Avatar name={name || "?"} photo={photo || null} color={color} size={80} />
      <div className="grid gap-1.5">
        <label className="btn-ghost min-h-10 cursor-pointer text-sm">
          <Camera className="inline size-4 align-[-3px]" /> {photo ? t("changePhoto") : t("addPhoto")}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        </label>
        {photo && (
          <button type="button" onClick={() => setPhoto("")} className="text-left text-sm text-muted underline">
            {t("removePhoto")}
          </button>
        )}
      </div>
    </div>
  );
}
