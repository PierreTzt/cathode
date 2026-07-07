import type { DB } from "./db";

export interface SerieListe {
  id: number;
  nom: string;
  nb_episodes: number;
  actif: number;
  archive: number;
}

export function listeSeries(db: DB): SerieListe[] {
  return db
    .prepare(
      `SELECT s.id, s.nom, s.actif, s.archive,
              COUNT(ev.id) AS nb_episodes
         FROM series s
         LEFT JOIN episodes_vus ev ON ev.serie_id = s.id
        GROUP BY s.id
        ORDER BY nb_episodes DESC, s.nom ASC`
    )
    .all() as unknown as SerieListe[];
}

export function detailSerie(db: DB, id: number): { nom: string } | undefined {
  return db.prepare("SELECT nom FROM series WHERE id = ?").get(id) as unknown as
    | { nom: string }
    | undefined;
}

export interface EpisodeVu {
  saison: number;
  episode: number;
  vu_le: string;
  rewatch_count: number;
}

export function episodesDeSerie(db: DB, id: number): EpisodeVu[] {
  return db
    .prepare(
      `SELECT saison, episode, vu_le, rewatch_count
         FROM episodes_vus WHERE serie_id = ?
        ORDER BY saison ASC, episode ASC`
    )
    .all(id) as unknown as EpisodeVu[];
}
