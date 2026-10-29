"use client";
import { useEffect } from "react";

/**
 * In the owner's preview (inside the setup or "Your website" screen): a tap on a camera button
 * tells the screen around it which picture to change; that screen opens the camera or photos.
 */
export function EditBridge() {
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-statio-edit]");
      const what = el?.dataset.statioEdit;
      if (!what || window.parent === window) return;
      e.preventDefault();
      window.parent.postMessage({ type: "statio:edit", what, layout: el.dataset.statioLayout }, window.location.origin);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}
