"use client";
import { useState, useTransition } from "react";
import type { LigneASuivre } from "@/lib/queries";
import { actionMarquerVu, actionMarquerJusquA } from "@/app/actions";
import { imageUrl } from "@/lib/tmdb";

export function ProchainEpisode({ ligne }: { ligne: LigneASuivre }) {
  const [pending, start] = useTransition();
  const [masque, setMasque] = useState(false);
  const poster = imageUrl(ligne.poster_path, "w185");
  if (masque) return null;

  const vu = () =>
    start(async () => {
      await actionMarquerVu(ligne.serie_id, ligne.saison, ligne.episode);
    });
  const jusqua = () => {
    setMasque(true);
    start(async () => {
      await actionMarquerJusquA(ligne.serie_id, ligne.saison, ligne.episode);
    });
  };
  const code = `S${ligne.saison}E${ligne.episode}`;

  return (
    <div className="suivi-card">
      {poster && <img className="suivi-poster" src={poster} alt={ligne.nom} />}
      <div className="suivi-info">
        <a className="suivi-nom" href={`/series/${ligne.serie_id}`}>
          {ligne.nom}
        </a>
        <div className="suivi-ep">
          Prochain : <strong>{code}</strong>
          {ligne.titre ? ` — ${ligne.titre}` : ""}
        </div>
        <div className="muted suivi-meta">
          {ligne.date_diffusion?.slice(0, 10)}
          {ligne.nb_en_retard > 1 ? ` · ${ligne.nb_en_retard} en retard` : ""}
        </div>
      </div>
      <div className="suivi-actions">
        <button onClick={vu} disabled={pending}>
          Vu
        </button>
        {ligne.nb_en_retard > 1 && (
          <button className="secondaire" onClick={jusqua} disabled={pending}>
            Marquer jusqu&apos;ici
          </button>
        )}
      </div>
    </div>
  );
}
