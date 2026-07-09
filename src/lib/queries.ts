import { transaction, type DB } from "./db";

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

export function detailSerie(
  db: DB,
  id: number
): { nom: string; poster_path: string | null; backdrop_path: string | null } | undefined {
  return db
    .prepare("SELECT nom, poster_path, backdrop_path FROM series WHERE id = ?")
    .get(id) as unknown as
    | { nom: string; poster_path: string | null; backdrop_path: string | null }
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

export interface LigneASuivre {
  serie_id: number;
  nom: string;
  poster_path: string | null;
  saison: number;
  episode: number;
  titre: string | null;
  date_diffusion: string | null;
  nb_en_retard: number;
}

// Sélection commune : épisodes diffusés (date passée), hors spéciaux, non vus.
const RETARD_WHERE = `
  c.saison >= 1
  AND c.date_diffusion IS NOT NULL
  AND c.date_diffusion <= date('now')
  AND NOT EXISTS (
    SELECT 1 FROM episodes_vus v
     WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
  )`;

export function tableauASuivre(db: DB): LigneASuivre[] {
  const rows = db
    .prepare(
      `WITH retard AS (
         SELECT c.serie_id, c.saison, c.episode, c.titre, c.date_diffusion,
                ROW_NUMBER() OVER (PARTITION BY c.serie_id ORDER BY c.saison, c.episode) AS rn,
                COUNT(*)    OVER (PARTITION BY c.serie_id) AS nb_en_retard
           FROM episodes_catalogue c
          WHERE ${RETARD_WHERE}
       )
       SELECT r.serie_id, s.nom, s.poster_path,
              r.saison, r.episode, r.titre, r.date_diffusion, r.nb_en_retard
         FROM retard r JOIN series s ON s.id = r.serie_id
        WHERE r.rn = 1
        ORDER BY r.date_diffusion DESC, s.nom ASC`
    )
    .all() as unknown as LigneASuivre[];
  // node:sqlite : aplatir pour la sérialisation RSC → composant client.
  return rows.map((r) => ({ ...r }));
}

// Insère un épisode comme vu, sauf s'il l'est déjà (idempotent — la clé UNIQUE
// avec episode_source_id NULL ne déclenche pas ON CONFLICT en SQLite).
export function marquerEpisodeVu(db: DB, serieId: number, saison: number, episode: number): void {
  const existe = db
    .prepare("SELECT 1 FROM episodes_vus WHERE serie_id=? AND saison=? AND episode=?")
    .get(serieId, saison, episode);
  if (existe) return;
  db.prepare(
    `INSERT INTO episodes_vus (serie_id, saison, episode, episode_source_id, vu_le, duree_min, rewatch_count)
     VALUES (?, ?, ?, NULL, date('now'),
             COALESCE((SELECT duree_min FROM episodes_catalogue
                        WHERE serie_id=? AND saison=? AND episode=?), 0),
             0)`
  ).run(serieId, saison, episode, serieId, saison, episode);
}

// Coche l'épisode cible + tous les précédents diffusés non vus (jamais les futurs).
export function marquerJusquA(db: DB, serieId: number, saison: number, episode: number): void {
  const cibles = db
    .prepare(
      `SELECT c.saison, c.episode
         FROM episodes_catalogue c
        WHERE c.serie_id = ?
          AND ${RETARD_WHERE}
          AND (c.saison < ? OR (c.saison = ? AND c.episode <= ?))
        ORDER BY c.saison, c.episode`
    )
    .all(serieId, saison, saison, episode) as unknown as { saison: number; episode: number }[];
  transaction(db, () => {
    for (const e of cibles) marquerEpisodeVu(db, serieId, e.saison, e.episode);
  });
}
