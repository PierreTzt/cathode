"use client";
import { useState, useTransition } from "react";
import { actionStatutSuivi } from "@/app/actions";
import type { SuiviStatut } from "@/lib/queries";

const OPTIONS: { cle: SuiviStatut; label: string }[] = [
  { cle: "actif", label: "Je suis" },
  { cle: "pause", label: "En pause" },
  { cle: "abandonne", label: "Abandonnée" },
];

export function StatutSuivi({ serieId, statut }: { serieId: number; statut: string }) {
  const [pending, start] = useTransition();
  const [val, setVal] = useState<SuiviStatut>(
    statut === "pause" || statut === "abandonne" ? statut : "actif"
  );
  const choisir = (c: SuiviStatut) => {
    setVal(c);
    start(async () => {
      await actionStatutSuivi(serieId, c);
    });
  };
  return (
    <div className="statut-suivi" role="group" aria-label="Statut de suivi">
      {OPTIONS.map((o) => (
        <button
          key={o.cle}
          className={`statut-suivi-btn${val === o.cle ? " actif" : ""}`}
          onClick={() => choisir(o.cle)}
          disabled={pending}
          aria-pressed={val === o.cle}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
