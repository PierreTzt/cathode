"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";
import { actionAjouterSerie } from "@/app/actions";
import type { Suggestion } from "@/import/suggestions";

export function SuggestionsListe({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="muted">
        Aucune suggestion pour l&apos;instant — elles se génèrent à la prochaine mise à jour.
      </p>
    );
  }
  return (
    <div className="sugg-grille">
      {suggestions.map((s) => (
        <SuggestionCarte key={s.tmdbId} s={s} />
      ))}
    </div>
  );
}

function SuggestionCarte({ s }: { s: Suggestion }) {
  const [pending, start] = useTransition();
  const [ajout, setAjout] = useState<{ id: number; existait: boolean } | null>(null);
  const poster = imageUrl(s.poster_path, "w185");

  const ajouter = () =>
    start(async () => {
      const r = await actionAjouterSerie({
        tmdbId: s.tmdbId,
        nom: s.nom,
        annee: null,
        poster_path: s.poster_path,
        backdrop_path: s.backdrop_path,
      });
      setAjout(r);
    });

  return (
    <div className="sugg-carte">
      {poster ? (
        <img className="sugg-poster" src={poster} alt={s.nom} loading="lazy" />
      ) : (
        <div className="sugg-poster sugg-noimg">{s.nom}</div>
      )}
      <div className="sugg-info">
        <div className="sugg-nom">{s.nom}</div>
        <div className="sugg-raison muted">{s.raison}</div>
        {ajout ? (
          <Link className="sugg-ok" href={`/series/${ajout.id}`}>
            {ajout.existait ? "Déjà suivie ›" : "Ajoutée ✓ ›"}
          </Link>
        ) : (
          <button className="sugg-btn" onClick={ajouter} disabled={pending}>
            {pending ? "Ajout…" : "Ajouter"}
          </button>
        )}
      </div>
    </div>
  );
}
