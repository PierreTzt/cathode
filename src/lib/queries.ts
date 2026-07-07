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
