import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";
import { StatutBadge } from "./StatutBadge";
import type { EtatSuivi } from "@/lib/etat";

export interface PosterTileProps {
  id: number;
  nom: string;
  poster_path: string | null;
  nb_episodes: number;
  diffuses: number;
  favori: number;
  etat?: EtatSuivi;
  enRetard?: number;
}

export function PosterTile({
  id,
  nom,
  poster_path,
  nb_episodes,
  diffuses,
  favori,
  etat,
  enRetard = 0,
}: PosterTileProps) {
  const src = imageUrl(poster_path, "w342");
  const pct = diffuses > 0 ? Math.min(100, Math.round((nb_episodes / diffuses) * 100)) : null;
  return (
    <Link className="poster-link" href={`/series/${id}`}>
      <div className="poster-tile">
        {src ? <img src={src} alt={nom} loading="lazy" /> : <div className="poster-fallback">{nom}</div>}
        {favori === 1 && <span className="poster-fav" aria-label="Favori">♥</span>}
        <span className="poster-badge">{nb_episodes}</span>
        {pct !== null && (
          <div className="poster-prog" title={`${nb_episodes}/${diffuses} vus`}>
            <div className="poster-prog-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="poster-name">{nom}</div>
      {etat && (
        <div className="poster-statut">
          <StatutBadge etat={etat} enRetard={enRetard} />
        </div>
      )}
    </Link>
  );
}
