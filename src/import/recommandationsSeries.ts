import type { DB } from "../lib/db";
import { majRecommandations } from "../lib/queries";
import { fetchRecommandations, type RecommandationSerie } from "../lib/tmdb";

// Rafraîchit les séries similaires (≤10) de chaque série, dédupliquées de la
// bibliothèque suivie (pour le bloc « À regarder après » de la fiche).
export async function majRecommandationsToutes(
  db: DB,
  fetcher: (tmdbId: number) => Promise<RecommandationSerie[]> = (id) => fetchRecommandations(id),
  options: { serieId?: number } = {}
): Promise<{ traitees: number }> {
  const suivies = new Set(
    (
      db
        .prepare("SELECT tmdb_id FROM series WHERE tmdb_id IS NOT NULL")
        .all() as unknown as { tmdb_id: number }[]
    ).map((r) => r.tmdb_id)
  );
  const stmt = db.prepare(
    options.serieId != null
      ? "SELECT id, tmdb_id FROM series WHERE id = ? AND tmdb_id IS NOT NULL"
      : "SELECT id, tmdb_id FROM series WHERE tmdb_id IS NOT NULL"
  );
  const series = (
    options.serieId != null ? stmt.all(options.serieId) : stmt.all()
  ) as unknown as { id: number; tmdb_id: number }[];

  let traitees = 0;
  for (const s of series) {
    const recs = await fetcher(s.tmdb_id);
    const filtrees = recs.filter((r) => !suivies.has(r.tmdbId)).slice(0, 10);
    majRecommandations(db, s.id, filtrees);
    traitees++;
  }
  return { traitees };
}
