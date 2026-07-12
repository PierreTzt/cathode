"use client";
import { useEffect, useState } from "react";

type Pref = "light" | "dark" | "auto";

const OPTIONS: { cle: Pref; label: string }[] = [
  { cle: "light", label: "Clair" },
  { cle: "dark", label: "Sombre" },
  { cle: "auto", label: "Auto" },
];

function resoudre(p: Pref): "light" | "dark" {
  if (p === "auto") return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  return p;
}

export function ThemeSelecteur() {
  const [pref, setPref] = useState<Pref>("dark");

  useEffect(() => {
    const p = (localStorage.getItem("monsuivi-theme") as Pref) || "dark";
    setPref(p);
  }, []);

  // En mode auto, suivre les changements système.
  useEffect(() => {
    if (pref !== "auto") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const apply = () =>
      document.documentElement.setAttribute("data-theme", mq.matches ? "light" : "dark");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);

  const choisir = (p: Pref) => {
    setPref(p);
    localStorage.setItem("monsuivi-theme", p);
    document.documentElement.setAttribute("data-theme", resoudre(p));
  };

  return (
    <div className="theme-sel" role="group" aria-label="Thème">
      {OPTIONS.map((o) => (
        <button
          key={o.cle}
          className={`theme-btn${pref === o.cle ? " actif" : ""}`}
          onClick={() => choisir(o.cle)}
          aria-pressed={pref === o.cle}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
