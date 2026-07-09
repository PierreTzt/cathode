import { getDb } from "@/lib/db";
import { aVenir, type EpisodeAVenir } from "@/lib/queries";
import { imageUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

function dateLisible(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso + "T00:00:00"));
}

export default function AVenir() {
  const eps = aVenir(getDb());
  if (eps.length === 0) {
    return (
      <div>
        <h1>À venir</h1>
        <p className="muted">Rien de prévu dans les 90 prochains jours pour tes séries suivies.</p>
      </div>
    );
  }
  const groupes = new Map<string, EpisodeAVenir[]>();
  for (const e of eps) {
    if (!groupes.has(e.date_diffusion)) groupes.set(e.date_diffusion, []);
    groupes.get(e.date_diffusion)!.push(e);
  }
  return (
    <div>
      <h1>À venir</h1>
      {[...groupes.entries()].map(([date, liste]) => (
        <section key={date} className="avenir-jour">
          <h2 className="avenir-date">{dateLisible(date)}</h2>
          <ul className="avenir-liste">
            {liste.map((e) => {
              const poster = imageUrl(e.poster_path, "w185");
              return (
                <li key={`${e.serie_id}-${e.saison}-${e.episode}`} className="avenir-ep">
                  {poster && <img className="avenir-poster" src={poster} alt={e.nom} />}
                  <div>
                    <a className="avenir-nom" href={`/series/${e.serie_id}`}>
                      {e.nom}
                    </a>
                    <div className="muted">
                      S{e.saison}E{e.episode}
                      {e.titre ? ` — ${e.titre}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
