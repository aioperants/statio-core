/** Pictures made small in the browser before upload, so they're kept with the salon and need no file storage. */

/** A photo at most `w`×`h`, JPEG, under ~850 KB. */
export async function shrinkPhoto(file: File, w: number, h: number) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, w / img.width, h / img.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.82;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 850_000 && quality > 0.4) url = canvas.toDataURL("image/jpeg", (quality -= 0.1));
  return { url, width: img.naturalWidth, height: img.naturalHeight };
}

/** A logo: SVG kept as it is (without scripts), anything else at most 512 px, PNG. Null = refused. */
export async function shrinkLogo(file: File): Promise<string | null> {
  if (file.type === "image/svg+xml") {
    if (file.size > 300_000) return null;
    const text = await file.text();
    // Scripts or event handlers in an SVG are refused.
    if (/<script|on\w+=|javascript:/i.test(text)) return null;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, 512 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
