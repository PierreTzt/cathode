"use client";
import { useState, useTransition } from "react";
import { actionAvenirVue } from "@/app/actions";

export function AvenirVueReglage({ initial }: { initial: "calendrier" | "liste" }) {
  const [vue, setVue] = useState(initial);
  const [pending, start] = useTransition();
  const choisir = (v: "calendrier" | "liste") => {
    setVue(v);
    start(async () => {
      await actionAvenirVue(v);
    });
  };
  return (
    <div className="theme-sel" role="group" aria-label="Vue À venir par défaut">
      {(["calendrier", "liste"] as const).map((v) => (
        <button
          key={v}
          className={`theme-btn${vue === v ? " actif" : ""}`}
          onClick={() => choisir(v)}
          disabled={pending}
          aria-pressed={vue === v}
        >
          {v === "calendrier" ? "Calendrier" : "Liste"}
        </button>
      ))}
    </div>
  );
}
