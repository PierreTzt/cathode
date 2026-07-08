import { imageUrl } from "@/lib/tmdb";

export interface PosterTileProps {
  id: number;
  nom: string;
  poster_path: string | null;
  nb_episodes: number;
}

export function PosterTile({ id, nom, poster_path, nb_episodes }: PosterTileProps) {
  const src = imageUrl(poster_path, "w342");
  return (
    <a className="poster-link" href={`/series/${id}`}>
      <div className="poster-tile">
        {src ? (
          <img src={src} alt={nom} loading="lazy" />
        ) : (
          <div className="poster-fallback">{nom}</div>
        )}
        <span className="poster-badge">{nb_episodes}</span>
      </div>
      <div className="poster-name">{nom}</div>
    </a>
  );
}
