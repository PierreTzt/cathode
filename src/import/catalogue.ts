import type { DB } from "../lib/db";
import { transaction } from "../lib/db";
import { fetchSeriesEpisodes, type CatalogueSerie } from "../lib/tmdb";

export async function majCatalogue(
  db: DB,
  fetcher: (tmdbId: number) => Promise<CatalogueSerie | null> = (id) => fetchSeriesEpisodes(id)
): Promise<{ seriesTraitees: number; episodesCatalogue: number; dureesComblees: number; echecs: number }> {
  const series = db
    .prepare(
      `SELECT id, tmdb_id FROM series
        WHERE tmdb_id IS NOT NULL
          AND (catalogue_maj_le IS NULL OR statut_tmdb = 'en cours')`
    )
    .all() as unknown as { id: number; tmdb_id: number }[];

  const upsert = db.prepare(
    `INSERT INTO episodes_catalogue (serie_id, saison, episode, titre, date_diffusion, duree_min)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (serie_id, saison, episode)
     DO UPDATE SET titre = excluded.titre,
                   date_diffusion = excluded.date_diffusion,
                   duree_min = excluded.duree_min`
  );
  const combler = db.prepare(
    `UPDATE episodes_vus
        SET duree_min = ?
      WHERE serie_id = ? AND saison = ? AND episode = ?
        AND (duree_min IS NULL OR duree_min = 0)`
  );
  const majSerie = db.prepare(
    "UPDATE series SET statut_tmdb = ?, catalogue_maj_le = date('now') WHERE id = ?"
  );

  let seriesTraitees = 0;
  let episodesCatalogue = 0;
  let dureesComblees = 0;
  let echecs = 0;

  for (const s of series) {
    const cat = await fetcher(s.tmdb_id);
    if (!cat) {
      echecs++;
      continue;
    }
    transaction(db, () => {
      for (const e of cat.episodes) {
        upsert.run(s.id, e.saison, e.episode, e.titre, e.date_diffusion, e.duree_min);
        episodesCatalogue++;
        if (e.duree_min > 0) {
          const info = combler.run(e.duree_min, s.id, e.saison, e.episode);
          dureesComblees += Number(info.changes);
        }
      }
      majSerie.run(cat.statut, s.id);
    });
    seriesTraitees++;
  }
  return { seriesTraitees, episodesCatalogue, dureesComblees, echecs };
}
