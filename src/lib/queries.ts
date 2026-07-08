import type { DB } from "./db";

export interface SerieListe {
  id: number;
  nom: string;
  nb_episodes: number;
  actif: number;
  archive: number;
  poster_path: string | null;
}

export function listeSeries(db: DB): SerieListe[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.nom, s.actif, s.archive, s.poster_path,
              COUNT(ev.id) AS nb_episodes
         FROM series s
         LEFT JOIN episodes_vus ev ON ev.serie_id = s.id
        GROUP BY s.id
        ORDER BY nb_episodes DESC, s.nom ASC`
    )
    .all() as unknown as SerieListe[];
  // node:sqlite rows have a null prototype; spread into plain objects so
  // React Server Components can serialize them across to Client Components
  // (SeriesGrid).
  return rows.map((r) => ({ ...r }));
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

export interface Stats {
  totalMinutes: number;
  nbEpisodes: number;
  nbSeries: number;
  nbFilms: number;
  parAnnee: { annee: string; nb: number }[];
  topSeries: { nom: string; nb: number }[];
}

export function stats(db: DB): Stats {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as unknown as { n: number }).n ?? 0;
  const totalMinutes =
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM episodes_vus") +
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM films_vus");
  return {
    totalMinutes,
    nbEpisodes: one("SELECT COUNT(*) AS n FROM episodes_vus"),
    nbSeries: one("SELECT COUNT(*) AS n FROM series"),
    nbFilms: one("SELECT COUNT(*) AS n FROM films_vus"),
    parAnnee: db
      .prepare(
        `SELECT substr(vu_le,1,4) AS annee, COUNT(*) AS nb
           FROM episodes_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
          GROUP BY annee ORDER BY annee ASC`
      )
      .all() as unknown as { annee: string; nb: number }[],
    topSeries: db
      .prepare(
        `SELECT s.nom AS nom, COUNT(ev.id) AS nb
           FROM series s JOIN episodes_vus ev ON ev.serie_id = s.id
          GROUP BY s.id ORDER BY nb DESC LIMIT 10`
      )
      .all() as unknown as { nom: string; nb: number }[],
  };
}
