import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";
import type { CastMembre } from "@/lib/tmdb";

// Bloc casting sur la fiche série. Chaque acteur lie sa page « où l'ai-je vu ».
export function CastRow({ cast }: { cast: CastMembre[] }) {
  if (!cast || cast.length === 0) return null;
  return (
    <section>
      <h2>Casting</h2>
      <div className="cast-row">
        {cast.map((c) => {
          const photo = imageUrl(c.profile_path, "w185");
          return (
            <Link key={c.tmdbId} href={`/acteur/${c.tmdbId}`} className="cast-carte">
              {photo ? (
                <img className="cast-photo" src={photo} alt={c.nom} loading="lazy" />
              ) : (
                <div className="cast-photo cast-noimg" aria-hidden>
                  {c.nom.slice(0, 1)}
                </div>
              )}
              <div className="cast-nom">{c.nom}</div>
              {c.personnage && <div className="cast-role muted">{c.personnage}</div>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
