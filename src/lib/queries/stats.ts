// Agrégats : statistiques globales, nouveautés, récap hebdo, progression, activité.
import type { DB } from "../db";
import { RETARD_WHERE } from "./partage";

export interface Stats {
  totalMinutes: number;
  nbEpisodes: number;
  nbSeries: number;
  nbFilms: number;
  parAnnee: { annee: string; nb: number }[];
  topSeries: { nom: string; nb: number }[];
  parGenre: { genre: string; nb: number }[];
  parJourSemaine: { jour: string; nb: number }[];
  topBinge: { jour: string; nb: number } | null;
  parMois: { mois: string; nb: number }[];
}

const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function stats(db: DB): Stats {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as unknown as { n: number }).n ?? 0;
  const totalMinutes =
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM episodes_vus") +
    one("SELECT COALESCE(SUM(duree_min),0) AS n FROM films_vus");

  // Genres : split des chaînes "Drame, Comédie" en JS puis comptage par série.
  const genresRows = db
    .prepare("SELECT genres FROM series WHERE genres IS NOT NULL AND genres <> ''")
    .all() as unknown as { genres: string }[];
  const compteur = new Map<string, number>();
  for (const r of genresRows) {
    for (const g of r.genres.split(",").map((x) => x.trim()).filter(Boolean)) {
      compteur.set(g, (compteur.get(g) ?? 0) + 1);
    }
  }
  const parGenre = [...compteur.entries()]
    .map(([genre, nb]) => ({ genre, nb }))
    .sort((a, b) => b.nb - a.nb || a.genre.localeCompare(b.genre))
    .slice(0, 10);

  // Jour de la semaine (%w : 0=dimanche … 6=samedi), réordonné lundi→dimanche.
  const jsRows = db
    .prepare(
      `SELECT CAST(strftime('%w', vu_le) AS INTEGER) AS j, COUNT(*) AS nb
         FROM episodes_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
        GROUP BY j`
    )
    .all() as unknown as { j: number; nb: number }[];
  const parJourNb = new Map(jsRows.map((r) => [r.j, r.nb]));
  const parJourSemaine = [1, 2, 3, 4, 5, 6, 0].map((j) => ({
    jour: JOURS_FR[j],
    nb: parJourNb.get(j) ?? 0,
  }));

  const bingeRow = db
    .prepare(
      `SELECT substr(vu_le,1,10) AS jour, COUNT(*) AS nb
         FROM episodes_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
        GROUP BY jour ORDER BY nb DESC, jour DESC LIMIT 1`
    )
    .get() as unknown as { jour: string; nb: number } | undefined;

  const parMois = (
    db
      .prepare(
        `SELECT substr(vu_le,1,7) AS mois, COUNT(*) AS nb
           FROM episodes_vus WHERE vu_le IS NOT NULL AND vu_le <> ''
          GROUP BY mois ORDER BY mois DESC LIMIT 12`
      )
      .all() as unknown as { mois: string; nb: number }[]
  ).reverse();

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
    parGenre,
    parJourSemaine,
    topBinge: bingeRow ? { ...bingeRow } : null,
    parMois,
  };
}

export interface Nouveautes {
  episodesDispo: number;
  seriesEnRetard: number;
  sortiesSemaine: number;
}

export function nouveautes(db: DB): Nouveautes {
  const retard = db
    .prepare(
      `SELECT COUNT(*) AS eps, COUNT(DISTINCT c.serie_id) AS series
         FROM episodes_catalogue c
         JOIN series s ON s.id = c.serie_id
        WHERE ${RETARD_WHERE}
          AND COALESCE(s.suivi_statut,'actif') = 'actif'`
    )
    .get() as unknown as { eps: number; series: number };
  const sortiesSemaine = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM episodes_catalogue c
           JOIN series s ON s.id = c.serie_id
          WHERE c.saison >= 1
            AND c.date_diffusion IS NOT NULL
            AND c.date_diffusion > date('now')
            AND c.date_diffusion <= date('now', '+7 days')
            AND COALESCE(s.suivi_statut,'actif') = 'actif'
            AND EXISTS (SELECT 1 FROM episodes_vus v WHERE v.serie_id = s.id)`
      )
      .get() as unknown as { n: number }
  ).n;
  return {
    episodesDispo: retard.eps ?? 0,
    seriesEnRetard: retard.series ?? 0,
    sortiesSemaine: sortiesSemaine ?? 0,
  };
}

// --- Méta applicative (#1) -------------------------------------------------

export interface RecapHebdo {
  nbEpisodes: number;
  minutes: number;
  nbFilms: number;
  topSerie: string | null;
}

export function recapHebdo(db: DB): RecapHebdo {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as unknown as { n: number }).n ?? 0;
  const fenetre = "vu_le >= date('now','-7 days')";
  const topRow = db
    .prepare(
      `SELECT s.nom AS nom, COUNT(*) AS n FROM episodes_vus ev JOIN series s ON s.id = ev.serie_id
        WHERE ev.${fenetre} GROUP BY s.id ORDER BY n DESC, s.nom ASC LIMIT 1`
    )
    .get() as unknown as { nom: string; n: number } | undefined;
  return {
    nbEpisodes: one(`SELECT COUNT(*) AS n FROM episodes_vus WHERE ${fenetre}`),
    minutes:
      one(`SELECT COALESCE(SUM(duree_min),0) AS n FROM episodes_vus WHERE ${fenetre}`) +
      one(`SELECT COALESCE(SUM(duree_min),0) AS n FROM films_vus WHERE ${fenetre}`),
    nbFilms: one(`SELECT COUNT(*) AS n FROM films_vus WHERE ${fenetre}`),
    topSerie: topRow ? topRow.nom : null,
  };
}

// --- Progression globale de la bibliothèque (#10) --------------------------

export interface ProgressionGlobale {
  total: number;
  vus: number;
  pct: number;
  seriesCompletes: number;
}

const DIFFUSE_NON_ABANDON = `
  c.saison >= 1 AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')
  AND COALESCE(s.suivi_statut,'actif') <> 'abandonne'`;

export function progressionGlobale(db: DB): ProgressionGlobale {
  const r = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM episodes_catalogue c JOIN series s ON s.id = c.serie_id
           WHERE ${DIFFUSE_NON_ABANDON}) AS total,
         (SELECT COUNT(*) FROM episodes_catalogue c JOIN series s ON s.id = c.serie_id
           JOIN episodes_vus v ON v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
           WHERE ${DIFFUSE_NON_ABANDON}) AS vus`
    )
    .get() as unknown as { total: number; vus: number };
  const seriesCompletes = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM series s
          WHERE COALESCE(s.suivi_statut,'actif') <> 'abandonne'
            AND (SELECT COUNT(*) FROM episodes_catalogue c
                  WHERE c.serie_id = s.id AND c.saison >= 1
                    AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')) > 0
            AND (SELECT COUNT(*) FROM episodes_catalogue c
                  WHERE c.serie_id = s.id AND c.saison >= 1
                    AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')
                    AND NOT EXISTS (SELECT 1 FROM episodes_vus v
                                     WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode)) = 0`
      )
      .get() as unknown as { n: number }
  ).n;
  const pct = r.total > 0 ? Math.round((r.vus / r.total) * 100) : 0;
  return { total: r.total, vus: r.vus, pct, seriesCompletes };
}

// --- Activité par jour (heatmap #9) ---------------------------------------

export interface JourActivite {
  jour: string;
  nb: number;
}

export function activiteParJour(db: DB, jours = 371): JourActivite[] {
  const rows = db
    .prepare(
      `SELECT substr(vu_le,1,10) AS jour, COUNT(*) AS nb
         FROM episodes_vus
        WHERE vu_le IS NOT NULL AND vu_le <> ''
          AND substr(vu_le,1,10) >= date('now', '-' || ? || ' days')
        GROUP BY jour`
    )
    .all(jours) as unknown as JourActivite[];
  return rows.map((r) => ({ ...r }));
}

// --- Recherche globale (#8) ------------------------------------------------
