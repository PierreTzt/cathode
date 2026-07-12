"use client";
import { useEffect } from "react";

// Enregistre le service worker sous le bon scope (basePath inclus).
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {
      /* silencieux : la PWA reste utilisable sans SW */
    });
  }, []);
  return null;
}
