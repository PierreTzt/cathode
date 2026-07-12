import type { DB } from "../lib/db";
import { fetchRecommandations, type RecommandationSerie } from "../lib/tmdb";

export interface Suggestion {
  tmdbId: number;
  nom: string;
  poster_path: string | null;
  backdrop_path: string | null;
  raison: string;
}

// Construit une liste « à commencer » : recommandations TMDB fondées sur les séries
// les mieux notées / les plus regardées, dédupliquées de ce qui est déjà suivi.
export async function construireSuggestions(
  db: DB,
  fetcher: (tmdbId: number) => Promise<RecommandationSerie[]> = (id) => fetchRecommandations(id),
  limite = 12
): Promise<Suggestion[]> {
  const suivies = new Set(
    (
      db
        .prepare("SELECT tmdb_id FROM series WHERE tmdb_id IS NOT NULL")
        .all() as unknown as { tmdb_id: number }[]
    ).map((r) => r.tmdb_id)
  );

  const sources = db
    .prepare(
      `SELECT s.tmdb_id AS tmdb_id, s.nom AS nom, COUNT(ev.id) AS nb
         FROM series s LEFT JOIN episodes_vus ev ON ev.serie_id = s.id
        WHERE s.tmdb_id IS NOT NULL
        GROUP BY s.id
        ORDER BY COALESCE(s.note, 0) DESC, nb DESC, s.nom ASC
        LIMIT 5`
    )
    .all() as unknown as { tmdb_id: number; nom: string }[];

  const vues = new Set<number>();
  const out: Suggestion[] = [];
  for (const src of sources) {
    if (out.length >= limite) break;
    const recs = await fetcher(src.tmdb_id);
    for (const r of recs) {
      if (out.length >= limite) break;
      if (suivies.has(r.tmdbId) || vues.has(r.tmdbId)) continue;
      vues.add(r.tmdbId);
      out.push({
        tmdbId: r.tmdbId,
        nom: r.nom,
        poster_path: r.poster_path,
        backdrop_path: r.backdrop_path,
        raison: `Parce que tu regardes ${src.nom}`,
      });
    }
  }
  return out;
}
