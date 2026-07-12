import type { DB } from "../lib/db";
import { transaction } from "../lib/db";
import { upsertVuJellyfin } from "../lib/queries";
import {
  fetchJellyfinVus,
  fetchSerieProviderIds,
  type JellyfinConfig,
  type JellyfinEpisodeVu,
  type SerieProviderIds,
} from "../lib/jellyfin";

export interface ResumeJellyfin {
  appariees: number;
  nonAppariees: number;
  ajoutes: number;
  erreur?: string;
}

export interface JellyfinDeps {
  getVus?: (cfg: JellyfinConfig) => Promise<JellyfinEpisodeVu[] | null>;
  getProviderIds?: (cfg: JellyfinConfig, seriesId: string) => Promise<SerieProviderIds | null>;
}

// Importe l'état « vu » depuis Jellyfin. Appariement par tmdb_id puis source_id
// (=Tvdb), jamais par titre. Complément du marquage manuel (n'écrase pas un vu_le).
export async function syncJellyfin(
  db: DB,
  cfg: JellyfinConfig,
  deps: JellyfinDeps = {}
): Promise<ResumeJellyfin> {
  const getVus = deps.getVus ?? ((c) => fetchJellyfinVus(c));
  const getProv = deps.getProviderIds ?? ((c, id) => fetchSerieProviderIds(c, id));

  const vus = await getVus(cfg);
  if (vus == null) return { appariees: 0, nonAppariees: 0, ajoutes: 0, erreur: "récupération impossible" };

  const series = db
    .prepare("SELECT id, tmdb_id, source_id FROM series")
    .all() as unknown as { id: number; tmdb_id: number | null; source_id: string | null }[];
  const parTmdb = new Map<number, number>();
  const parTvdb = new Map<string, number>();
  for (const s of series) {
    if (s.tmdb_id != null) parTmdb.set(s.tmdb_id, s.id);
    if (s.source_id) parTvdb.set(String(s.source_id), s.id);
  }

  // Cache des ProviderIds par SeriesId Jellyfin (1 appel par série distincte).
  const cache = new Map<string, SerieProviderIds | null>();
  for (const v of vus) {
    if (!cache.has(v.seriesId)) cache.set(v.seriesId, await getProv(cfg, v.seriesId));
  }

  let appariees = 0;
  let nonAppariees = 0;
  let ajoutes = 0;
  transaction(db, () => {
    for (const v of vus) {
      const pid = cache.get(v.seriesId) ?? null;
      let serieId: number | undefined;
      if (pid?.tmdb != null) serieId = parTmdb.get(pid.tmdb);
      if (serieId == null && pid?.tvdb) serieId = parTvdb.get(pid.tvdb);
      if (serieId == null) {
        nonAppariees++;
        continue;
      }
      appariees++;
      const rewatch = Math.max(0, (v.playCount ?? 0) - 1);
      const vuLe = v.lastPlayed ? v.lastPlayed.slice(0, 10) : null;
      if (upsertVuJellyfin(db, serieId, v.saison, v.episode, vuLe, rewatch)) ajoutes++;
    }
  });

  return { appariees, nonAppariees, ajoutes };
}
