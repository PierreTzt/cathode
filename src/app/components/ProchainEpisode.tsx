"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { LigneASuivre } from "@/lib/queries";
import { actionMarquerVu, actionMarquerJusquA } from "@/app/actions";
import { imageUrl } from "@/lib/tmdb";
import { Providers } from "./Providers";

// Date de diffusion → « aujourd'hui / hier / il y a 5 jours … ». La requête ne
// remonte que des épisodes déjà diffusés, donc toujours dans le passé.
function ilYA(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const jours = Math.round((aujourdhui.getTime() - d.getTime()) / 86400000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 14) return "il y a 1 semaine";
  if (jours < 31) return `il y a ${Math.floor(jours / 7)} semaines`;
  if (jours < 60) return "il y a 1 mois";
  if (jours < 365) return `il y a ${Math.floor(jours / 30)} mois`;
  const ans = Math.floor(jours / 365);
  return ans === 1 ? "il y a 1 an" : `il y a ${ans} ans`;
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

export function ProchainEpisode({ ligne }: { ligne: LigneASuivre }) {
  const [pending, start] = useTransition();
  const [masque, setMasque] = useState(false);
  // Vignette paysage à la TV Time : l'image de l'épisode (still) d'abord, sinon
  // le backdrop de la série, sinon l'affiche recadrée.
  const vignette =
    imageUrl(ligne.still_path, "w300") ??
    imageUrl(ligne.backdrop_path, "w342") ??
    imageUrl(ligne.poster_path, "w185");
  const paysage = ligne.still_path != null || ligne.backdrop_path != null;
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

  const reste = ligne.nb_en_retard - 1; // épisodes de retard après celui-ci
  const quand = ilYA(ligne.date_diffusion);
  const lien = `/series/${ligne.serie_id}`;

  return (
    <div className="suivi-card">
      <Link
        className={`suivi-vignette${paysage ? "" : " portrait"}`}
        href={lien}
        aria-label={ligne.nom}
      >
        {vignette ? (
          <img src={vignette} alt="" loading="lazy" />
        ) : (
          <span className="suivi-vignette-repli">{ligne.nom}</span>
        )}
      </Link>

      <div className="suivi-info">
        <Link className="suivi-pastille" href={lien}>
          <span className="suivi-pastille-nom">{ligne.nom}</span>
          <span className="suivi-pastille-chev" aria-hidden>
            ›
          </span>
        </Link>
        <div className="suivi-ep">
          <span className="suivi-code">
            S{deuxChiffres(ligne.saison)} <span className="sep">|</span> E
            {deuxChiffres(ligne.episode)}
          </span>
          {reste > 0 && <span className="suivi-plus">+{reste}</span>}
        </div>
        {ligne.titre && <div className="suivi-titre">{ligne.titre}</div>}
        {ligne.apercu && <p className="suivi-apercu">{ligne.apercu}</p>}
        <div className="suivi-bas">
          {quand && <span className="suivi-quand">Diffusé {quand}</span>}
          <Providers providers={ligne.providers} compact />
        </div>
      </div>

      <div className="suivi-actions">
        <button
          className="suivi-check"
          onClick={vu}
          disabled={pending}
          title="Marquer cet épisode comme vu"
          aria-label="Marquer vu"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {reste > 0 && (
          <button className="suivi-jusqua" onClick={jusqua} disabled={pending}>
            jusqu&apos;ici
          </button>
        )}
      </div>
    </div>
  );
}
