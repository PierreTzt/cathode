"use client";
import { useState, useTransition } from "react";
import { imageUrl } from "@/lib/tmdb";
import { Providers } from "./Providers";
import { actionNoterFilm } from "@/app/actions";
import type { FilmGroupe } from "@/lib/queries";

export function FilmsGrid({ films }: { films: FilmGroupe[] }) {
  if (films.length === 0) return <p className="muted">Aucun film vu.</p>;
  return (
    <div className="film-grid">
      {films.map((f) => (
        <FilmCarte key={f.nom} film={f} />
      ))}
    </div>
  );
}

function FilmCarte({ film }: { film: FilmGroupe }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<number | null>(film.note);
  const src = imageUrl(film.poster_path, "w342");

  const noter = (v: number) => {
    const nv = note === v ? null : v;
    setNote(nv);
    start(async () => {
      await actionNoterFilm(film.nom, nv);
    });
  };

  return (
    <div className="film-carte">
      <div className="film-poster">
        {src ? <img src={src} alt={film.nom} loading="lazy" /> : <div className="poster-fallback">{film.nom}</div>}
        {film.nb_vus > 1 && <span className="poster-badge">×{film.nb_vus}</span>}
      </div>
      <div className="film-nom">
        {film.nom}
        {film.annee ? <span className="muted"> ({film.annee})</span> : ""}
      </div>
      <div className="film-etoiles" role="group" aria-label="Noter le film sur 5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} className="ep-etoile" disabled={pending} onClick={() => noter(v)} aria-label={`Note ${v}/5`}>
            {v <= (note ?? 0) ? "★" : "☆"}
          </button>
        ))}
      </div>
      <Providers providers={film.providers} compact />
      {film.dernier_vu && <div className="muted film-date">Vu le {film.dernier_vu.slice(0, 10)}</div>}
    </div>
  );
}
