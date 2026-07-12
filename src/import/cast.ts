import type { DB } from "../lib/db";
import { majCast } from "../lib/queries";
import { fetchCast, type CastMembre } from "../lib/tmdb";

// Rafraîchit le casting (top 10) des séries ayant un tmdb_id.
export async function majCastToutes(
  db: DB,
  fetcher: (tmdbId: number) => Promise<CastMembre[] | null> = (id) => fetchCast(id),
  options: { serieId?: number } = {}
): Promise<{ traitees: number; echecs: number }> {
  const stmt = db.prepare(
    options.serieId != null
      ? "SELECT id, tmdb_id FROM series WHERE id = ? AND tmdb_id IS NOT NULL"
      : "SELECT id, tmdb_id FROM series WHERE tmdb_id IS NOT NULL"
  );
  const series = (
    options.serieId != null ? stmt.all(options.serieId) : stmt.all()
  ) as unknown as { id: number; tmdb_id: number }[];

  let traitees = 0;
  let echecs = 0;
  for (const s of series) {
    const c = await fetcher(s.tmdb_id);
    if (c == null) {
      echecs++;
      continue;
    }
    majCast(db, s.id, c);
    traitees++;
  }
  return { traitees, echecs };
}
