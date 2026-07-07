import { join } from "node:path";
import { transaction, type DB } from "../lib/db";
import { readCsv } from "./csv";
import { upsertSerie } from "./importSeries";

export function importEpisodes(db: DB, gdprDir: string): number {
  const rows = readCsv(join(gdprDir, "tracking-prod-records-v2.csv"));
  const insert = db.prepare(
    `INSERT INTO episodes_vus
       (serie_id, saison, episode, episode_source_id, vu_le, duree_min, rewatch_count)
     VALUES (@serie_id, @saison, @episode, @episode_source_id, @vu_le, @duree_min, @rewatch_count)
     ON CONFLICT (serie_id, saison, episode, episode_source_id) DO UPDATE SET
       rewatch_count = MAX(rewatch_count, excluded.rewatch_count),
       vu_le = MIN(COALESCE(vu_le, excluded.vu_le), COALESCE(excluded.vu_le, vu_le))`
  );
  transaction(db, () => {
    for (const r of rows) {
      const key = r.key ?? "";
      if (!key.startsWith("watch-episode-") && !key.startsWith("rewatch-episode-")) continue;
      if (!r.s_id) continue;
      const serie_id = upsertSerie(db, { source_id: r.s_id, nom: r.series_name ?? "" });
      insert.run({
        serie_id,
        saison: r.season_number ? Number(r.season_number) : null,
        episode: r.episode_number ? Number(r.episode_number) : null,
        episode_source_id: r.episode_id || null,
        vu_le: r.created_at || null,
        duree_min: Math.floor(Number(r.runtime || 0) / 60),
        rewatch_count: Number(r.rewatch_count || 0),
      });
    }
  });
  return (db.prepare("SELECT COUNT(*) AS n FROM episodes_vus").get() as { n: number }).n;
}
