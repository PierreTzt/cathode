import Link from "next/link";
import { getDb } from "@/lib/db";
import { rechercheLocale } from "@/lib/queries";
import { rechercheSeries, tmdbConfigure } from "@/lib/tmdb";
import { RechercheBox } from "@/app/components/RechercheBox";
import { SuggestionsListe } from "@/app/components/SuggestionsListe";
import { imageUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const requete = (q ?? "").trim();
  const db = getDb();
  const locale = requete ? rechercheLocale(db, requete) : { series: [], episodes: [] };
  // Repli TMDB : proposer d'ajouter des séries absentes de la bibliothèque.
  const suivies = new Set(
    (
      db.prepare("SELECT tmdb_id FROM series WHERE tmdb_id IS NOT NULL").all() as unknown as {
        tmdb_id: number;
      }[]
    ).map((r) => r.tmdb_id)
  );
  const tmdb = requete
    ? (await rechercheSeries(requete)).filter((r) => !suivies.has(r.tmdbId)).slice(0, 8)
    : [];

  return (
    <div>
      <h1>Rechercher</h1>
      <RechercheBox initial={requete} />

      {!tmdbConfigure() && (
        <div className="alerte">
          <p>
            <strong>Aucune clé TMDB configurée.</strong> La recherche ne porte que sur les séries
            déjà présentes dans ta bibliothèque : aucune nouvelle série ne peut être trouvée.
          </p>
          <p className="muted">
            Ajoute <code>TMDB_READ_TOKEN</code> dans <code>.env.local</code>, puis relance
            l&apos;appli.
          </p>
        </div>
      )}

      {!requete && <p className="muted">Cherche parmi tes séries, tes épisodes, ou ajoute depuis TMDB.</p>}

      {requete && locale.series.length === 0 && locale.episodes.length === 0 && tmdb.length === 0 && (
        <p className="muted">Aucun résultat pour « {requete} ».</p>
      )}

      {locale.series.length > 0 && (
        <>
          <h2>Mes séries</h2>
          <div className="poster-grid">
            {locale.series.map((s) => {
              const src = imageUrl(s.poster_path, "w342");
              return (
                <Link key={s.id} className="poster-link" href={`/series/${s.id}`}>
                  <div className="poster-tile">
                    {src ? <img src={src} alt={s.nom} loading="lazy" /> : <div className="poster-fallback">{s.nom}</div>}
                  </div>
                  <div className="poster-name">{s.nom}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {locale.episodes.length > 0 && (
        <>
          <h2>Épisodes</h2>
          <ul className="recherche-eps">
            {locale.episodes.map((e, i) => (
              <li key={`${e.serie_id}-${e.saison}-${e.episode}-${i}`}>
                <Link href={`/series/${e.serie_id}`} className="recherche-ep">
                  <span className="recherche-ep-serie">{e.nom}</span>
                  <span className="muted">
                    S{deuxChiffres(e.saison)}E{deuxChiffres(e.episode)}
                    {e.titre ? ` · ${e.titre}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {tmdb.length > 0 && (
        <>
          <h2>Ajouter depuis TMDB</h2>
          <SuggestionsListe
            suggestions={tmdb.map((r) => ({
              tmdbId: r.tmdbId,
              nom: r.nom,
              poster_path: r.poster_path,
              backdrop_path: r.backdrop_path,
              raison: r.annee ?? "",
            }))}
          />
        </>
      )}
    </div>
  );
}
