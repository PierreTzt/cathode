import { imageUrl } from "@/lib/tmdb";

export interface PosterTileProps {
  id: number;
  nom: string;
  poster_path: string | null;
  nb_episodes: number;
  diffuses: number;
}

export function PosterTile({ id, nom, poster_path, nb_episodes, diffuses }: PosterTileProps) {
  const src = imageUrl(poster_path, "w342");
  const pct = diffuses > 0 ? Math.min(100, Math.round((nb_episodes / diffuses) * 100)) : null;
  return (
    <a className="poster-link" href={`/series/${id}`}>
      <div className="poster-tile">
        {src ? <img src={src} alt={nom} loading="lazy" /> : <div className="poster-fallback">{nom}</div>}
        <span className="poster-badge">{nb_episodes}</span>
        {pct !== null && (
          <div className="poster-prog" title={`${nb_episodes}/${diffuses} vus`}>
            <div className="poster-prog-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="poster-name">{nom}</div>
    </a>
  );
}
