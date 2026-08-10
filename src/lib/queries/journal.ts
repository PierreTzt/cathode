// Historique de visionnage, souvenirs et bilan annuel.
import type { DB } from "../db";

export interface EntreeJournal {
  type: "episode" | "film";
  vu_le: string;
  serie_id: number | null;
  nom: string;
  poster_path: string | null;
  saison: number | null;
  episode: number | null;
  titre: string | null;
}

const JOURNAL_SELECT = `
  SELECT 'episode' AS type, ev.vu_le AS vu_le, s.id AS serie_id, s.nom AS nom,
         s.poster_path AS poster_path, ev.saison AS saison, ev.episode AS episode, c.titre AS titre
    FROM episodes_vus ev
    JOIN series s ON s.id = ev.serie_id
    LEFT JOIN episodes_catalogue c
      ON c.serie_id = ev.serie_id AND c.saison = ev.saison AND c.episode = ev.episode
   WHERE ev.vu_le IS NOT NULL AND ev.vu_le <> ''
  UNION ALL
  SELECT 'film' AS type, f.vu_le AS vu_le, NULL AS serie_id, f.nom AS nom,
         NULL AS poster_path, NULL AS saison, NULL AS episode, NULL AS titre
    FROM films_vus f
   WHERE f.vu_le IS NOT NULL AND f.vu_le <> ''`;

// Flux chronologique (desc) épisodes vus + films.
export function journal(db: DB, limite = 400): EntreeJournal[] {
  const rows = db
    .prepare(`${JOURNAL_SELECT} ORDER BY vu_le DESC, nom ASC LIMIT ?`)
    .all(limite) as unknown as EntreeJournal[];
  return rows.map((r) => ({ ...r }));
}

// « Il y a un an » : entrées du même jour (mm-jj) lors des années précédentes.
export function souvenirs(db: DB): EntreeJournal[] {
  const rows = db
    .prepare(
      `SELECT * FROM (${JOURNAL_SELECT}) j
        WHERE strftime('%m-%d', j.vu_le) = strftime('%m-%d', 'now')
          AND strftime('%Y', j.vu_le) < strftime('%Y', 'now')
        ORDER BY j.vu_le DESC, j.nom ASC`
    )
    .all() as unknown as EntreeJournal[];
  return rows.map((r) => ({ ...r }));
}

// --- Bilan annuel (#9) -----------------------------------------------------

export interface BilanAnnee {
  annee: string;
  totalMinutes: number;
  nbEpisodes: number;
  nbFilms: number;
  nbSeries: number;
  topSeries: { nom: string; nb: number }[];
  genreDominant: string | null;
  topBinge: { jour: string; nb: number } | null;
  parMois: { mois: string; nb: number }[];
}

// Années ayant au moins une activité (épisode ou film), pour le sélecteur.
export function anneesDisponibles(db: DB): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT annee FROM (
         SELECT substr(vu_le,1,4) AS annee FROM episodes_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
         UNION
         SELECT substr(vu_le,1,4) AS annee FROM films_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
       ) ORDER BY annee DESC`
    )
    .all() as unknown as { annee: string }[];
  return rows.map((r) => r.annee).filter((a) => /^\d{4}$/.test(a));
}

export function statsAnnee(db: DB, annee: string): BilanAnnee {
  const a = /^\d{4}$/.test(annee) ? annee : "0000";
  const one = (sql: string, ...args: (string | number)[]): number =>
    (db.prepare(sql).get(...args) as unknown as { n: number }).n ?? 0;

  const totalMinutes =
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM episodes_vus WHERE substr(vu_le,1,4)=?", a) +
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM films_vus WHERE substr(vu_le,1,4)=?", a);

  const nbEpisodes = one(
    "SELECT COUNT(*) AS n FROM episodes_vus WHERE substr(vu_le,1,4)=?",
    a
  );
  const nbFilms = one("SELECT COUNT(*) AS n FROM films_vus WHERE substr(vu_le,1,4)=?", a);
  const nbSeries = one(
    "SELECT COUNT(DISTINCT serie_id) AS n FROM episodes_vus WHERE substr(vu_le,1,4)=?",
    a
  );

  const topSeries = db
    .prepare(
      `SELECT s.nom AS nom, COUNT(ev.id) AS nb
         FROM series s JOIN episodes_vus ev ON ev.serie_id = s.id
        WHERE substr(ev.vu_le,1,4) = ?
        GROUP BY s.id ORDER BY nb DESC, s.nom ASC LIMIT 10`
    )
    .all(a) as unknown as { nom: string; nb: number }[];

  // Genre dominant : parmi les séries vues cette année, genre le plus fréquent.
  const genresRows = db
    .prepare(
      `SELECT DISTINCT s.genres AS genres
         FROM series s JOIN episodes_vus ev ON ev.serie_id = s.id
        WHERE substr(ev.vu_le,1,4) = ? AND s.genres IS NOT NULL AND s.genres <> ''`
    )
    .all(a) as unknown as { genres: string }[];
  const compteur = new Map<string, number>();
  for (const r of genresRows) {
    for (const g of r.genres.split(",").map((x) => x.trim()).filter(Boolean)) {
      compteur.set(g, (compteur.get(g) ?? 0) + 1);
    }
  }
  const genreDominant =
    [...compteur.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]?.[0] ??
    null;

  const bingeRow = db
    .prepare(
      `SELECT substr(vu_le,1,10) AS jour, COUNT(*) AS nb
         FROM episodes_vus WHERE substr(vu_le,1,4) = ?
        GROUP BY jour ORDER BY nb DESC, jour DESC LIMIT 1`
    )
    .get(a) as unknown as { jour: string; nb: number } | undefined;

  const moisNb = new Map(
    (
      db
        .prepare(
          `SELECT substr(vu_le,6,2) AS mois, COUNT(*) AS nb
             FROM episodes_vus WHERE substr(vu_le,1,4) = ?
            GROUP BY mois`
        )
        .all(a) as unknown as { mois: string; nb: number }[]
    ).map((r) => [r.mois, r.nb] as const)
  );
  const parMois = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { mois: mm, nb: moisNb.get(mm) ?? 0 };
  });

  return {
    annee: a,
    totalMinutes,
    nbEpisodes,
    nbFilms,
    nbSeries,
    topSeries,
    genreDominant,
    topBinge: bingeRow ? { ...bingeRow } : null,
    parMois,
  };
}

// --- Bandeau nouveautés (#5) -----------------------------------------------
