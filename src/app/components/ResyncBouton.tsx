"use client";
import { useState, useTransition } from "react";
import { actionResync } from "@/app/actions";
import type { ResumeResync } from "@/import/resync";

function ilYA(iso: string | null): string {
  if (!iso) return "jamais";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "jamais";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "il y a 1 jour" : `il y a ${j} jours`;
}

export function ResyncBouton({ derniereResync }: { derniereResync: string | null }) {
  const [pending, start] = useTransition();
  const [resume, setResume] = useState<ResumeResync | null>(null);
  const [quand, setQuand] = useState(derniereResync);

  const lancer = () =>
    start(async () => {
      const r = await actionResync();
      setResume(r);
      setQuand(new Date().toISOString());
    });

  return (
    <div className="resync">
      <button className="resync-btn" onClick={lancer} disabled={pending}>
        {pending ? "Mise à jour…" : "Mettre à jour maintenant"}
      </button>
      <span className="muted resync-quand">Dernière mise à jour : {ilYA(quand)}</span>
      {resume && (
        <p className="muted resync-resume">
          {resume.seriesTraitees} série(s) · {resume.episodesCatalogue} épisode(s) catalogue ·{" "}
          {resume.providers} plateforme(s) · {resume.suggestions} suggestion(s)
          {resume.echecs > 0 ? ` · ${resume.echecs} échec(s)` : ""}
        </p>
      )}
    </div>
  );
}
