import type { DB } from "../lib/db";
import { findByTvdbId, type TmdbSerie } from "../lib/tmdb";

export async function enrichSeries(
  db: DB,
  finder: (tvdbId: string) => Promise<TmdbSerie | null> = (id) => findByTvdbId(id)
): Promise<{ enrichies: number; echouees: number }> {
  const rows = db
    .prepare("SELECT id, source_id FROM series WHERE source_id IS NOT NULL AND tmdb_id IS NULL")
    .all() as unknown as { id: number; source_id: string }[];
  const update = db.prepare(
    "UPDATE series SET tmdb_id = ?, poster_path = ?, backdrop_path = ? WHERE id = ?"
  );
  let enrichies = 0;
  let echouees = 0;
  for (const r of rows) {
    const hit = await finder(r.source_id);
    if (!hit) {
      echouees++;
      continue;
    }
    update.run(hit.tmdbId, hit.posterPath, hit.backdropPath, r.id);
    enrichies++;
  }
  return { enrichies, echouees };
}
