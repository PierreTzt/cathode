import type { DB } from "../lib/db";
import { majProviders } from "../lib/queries";
import { fetchProviders, type Provider } from "../lib/tmdb";

// Rafraîchit les plateformes de streaming (où regarder) des séries ayant un tmdb_id.
// `serieId` : une seule série (ajout manuel). Sinon toutes.
export async function majProvidersToutes(
  db: DB,
  fetcher: (tmdbId: number) => Promise<Provider[] | null> = (id) => fetchProviders(id),
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
    const p = await fetcher(s.tmdb_id);
    if (p == null) {
      echecs++;
      continue;
    }
    majProviders(db, s.id, p);
    traitees++;
  }
  return { traitees, echecs };
}
