import type { DB } from "../lib/db";
import { fetchGenres } from "../lib/tmdb";

export async function enrichGenres(
  db: DB,
  fetcher: (tmdbId: number) => Promise<string[] | null> = (id) => fetchGenres(id)
): Promise<{ enrichies: number; echecs: number }> {
  const rows = db
    .prepare("SELECT id, tmdb_id FROM series WHERE tmdb_id IS NOT NULL AND genres IS NULL")
    .all() as unknown as { id: number; tmdb_id: number }[];
  const update = db.prepare("UPDATE series SET genres = ? WHERE id = ?");
  let enrichies = 0;
  let echecs = 0;
  for (const r of rows) {
    const genres = await fetcher(r.tmdb_id);
    if (genres === null) {
      echecs++;
      continue;
    }
    update.run(genres.join(", "), r.id);
    enrichies++;
  }
  return { enrichies, echecs };
}
