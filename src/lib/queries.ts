import { transaction, type DB } from "./db";

export interface SerieListe {
  id: number;
  nom: string;
  nb_episodes: number;
  actif: number;
  archive: number;
  poster_path: string | null;
  diffuses: number;
  favori: number;
}

export function listeSeries(db: DB): SerieListe[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.nom, s.actif, s.archive, s.poster_path, s.favori,
              COUNT(ev.id) AS nb_episodes,
              (SELECT COUNT(*) FROM episodes_catalogue c
                 WHERE c.serie_id = s.id AND c.saison >= 1
                   AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')) AS diffuses
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

export interface DetailSerie {
  nom: string;
  poster_path: string | null;
  backdrop_path: string | null;
  note: number | null;
  favori: number;
}

export function detailSerie(db: DB, id: number): DetailSerie | undefined {
  const row = db
    .prepare("SELECT nom, poster_path, backdrop_path, note, favori FROM series WHERE id = ?")
    .get(id) as unknown as DetailSerie | undefined;
  return row ? { ...row } : undefined;
}

export function noterSerie(db: DB, id: number, note: number | null): void {
  db.prepare("UPDATE series SET note = ? WHERE id = ?").run(note, id);
}

export function basculerFavori(db: DB, id: number): void {
  db.prepare(
    "UPDATE series SET favori = CASE WHEN favori = 1 THEN 0 ELSE 1 END WHERE id = ?"
  ).run(id);
}

// Ajout manuel d'une série (via recherche TMDB). Idempotent sur tmdb_id : si la
// série existe déjà, renvoie son id sans rien réinsérer.
export function ajouterSerie(
  db: DB,
  s: { tmdbId: number; nom: string; poster_path: string | null; backdrop_path: string | null }
): { id: number; existait: boolean } {
  const existante = db
    .prepare("SELECT id FROM series WHERE tmdb_id = ?")
    .get(s.tmdbId) as unknown as { id: number } | undefined;
  if (existante) return { id: existante.id, existait: true };
  const info = db
    .prepare(
      `INSERT INTO series (nom, tmdb_id, poster_path, backdrop_path, suivi_le, actif, archive)
       VALUES (?, ?, ?, ?, date('now'), 1, 0)`
    )
    .run(s.nom, s.tmdbId, s.poster_path, s.backdrop_path);
  return { id: Number(info.lastInsertRowid), existait: false };
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

export interface LigneASuivre {
  serie_id: number;
  nom: string;
  poster_path: string | null;
  backdrop_path: string | null;
  saison: number;
  episode: number;
  titre: string | null;
  apercu: string | null;
  still_path: string | null;
  date_diffusion: string | null;
  nb_en_retard: number;
  dernier_vu: string | null;
}

export type TriASuivre = "prochain" | "dernier_vu";

// Sélection commune : épisodes diffusés (date passée), hors spéciaux, non vus.
const RETARD_WHERE = `
  c.saison >= 1
  AND c.date_diffusion IS NOT NULL
  AND c.date_diffusion <= date('now')
  AND NOT EXISTS (
    SELECT 1 FROM episodes_vus v
     WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
  )`;

export function tableauASuivre(db: DB, tri: TriASuivre = "prochain"): LigneASuivre[] {
  // `tri` est un enum contrôlé (jamais du texte utilisateur) → interpolation sûre.
  const ordre =
    tri === "dernier_vu" ? "dernier_vu DESC, s.nom ASC" : "r.date_diffusion DESC, s.nom ASC";
  const rows = db
    .prepare(
      `WITH retard AS (
         SELECT c.serie_id, c.saison, c.episode, c.titre, c.apercu, c.still_path, c.date_diffusion,
                ROW_NUMBER() OVER (PARTITION BY c.serie_id ORDER BY c.saison, c.episode) AS rn,
                COUNT(*)    OVER (PARTITION BY c.serie_id) AS nb_en_retard
           FROM episodes_catalogue c
          WHERE ${RETARD_WHERE}
       )
       SELECT r.serie_id, s.nom, s.poster_path, s.backdrop_path,
              r.saison, r.episode, r.titre, r.apercu, r.still_path, r.date_diffusion, r.nb_en_retard,
              (SELECT MAX(v.vu_le) FROM episodes_vus v WHERE v.serie_id = r.serie_id) AS dernier_vu
         FROM retard r JOIN series s ON s.id = r.serie_id
        WHERE r.rn = 1
        ORDER BY ${ordre}`
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

// Supprime le marquage « vu » d'un épisode (annuler / corriger).
export function demarquerEpisode(db: DB, serieId: number, saison: number, episode: number): void {
  db.prepare("DELETE FROM episodes_vus WHERE serie_id = ? AND saison = ? AND episode = ?").run(
    serieId,
    saison,
    episode
  );
}

export interface EpisodeComplet {
  saison: number;
  episode: number;
  titre: string | null;
  date_diffusion: string | null;
  duree_min: number;
  vu: number; // 0/1
  vu_le: string | null;
  diffuse: number; // 0/1 : diffusé (date_diffusion <= aujourd'hui)
}

// Tous les épisodes du catalogue d'une série (saison 0 incluse) avec leur statut vu/diffusé.
export function episodesCompletsDeSerie(db: DB, serieId: number): EpisodeComplet[] {
  const rows = db
    .prepare(
      `SELECT c.saison, c.episode, c.titre, c.date_diffusion, c.duree_min,
              CASE WHEN v.serie_id IS NOT NULL THEN 1 ELSE 0 END AS vu,
              v.vu_le AS vu_le,
              CASE WHEN c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')
                   THEN 1 ELSE 0 END AS diffuse
         FROM episodes_catalogue c
         LEFT JOIN episodes_vus v
           ON v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
        WHERE c.serie_id = ?
        ORDER BY c.saison, c.episode`
    )
    .all(serieId) as unknown as EpisodeComplet[];
  // node:sqlite : aplatir pour la sérialisation RSC → composant client.
  return rows.map((r) => ({ ...r }));
}

export interface EpisodeAVenir {
  serie_id: number;
  nom: string;
  poster_path: string | null;
  saison: number;
  episode: number;
  titre: string | null;
  date_diffusion: string;
}

// Prochains épisodes à sortir (fenêtre de joursMax jours) pour les séries suivies (≥1 vu).
export function aVenir(db: DB, joursMax = 90): EpisodeAVenir[] {
  const rows = db
    .prepare(
      `SELECT s.id AS serie_id, s.nom, s.poster_path,
              c.saison, c.episode, c.titre, c.date_diffusion
         FROM episodes_catalogue c
         JOIN series s ON s.id = c.serie_id
        WHERE c.saison >= 1
          AND c.date_diffusion IS NOT NULL
          AND c.date_diffusion > date('now')
          AND c.date_diffusion <= date('now', '+' || ? || ' days')
          AND EXISTS (SELECT 1 FROM episodes_vus v WHERE v.serie_id = s.id)
        ORDER BY c.date_diffusion ASC, s.nom ASC`
    )
    .all(joursMax) as unknown as EpisodeAVenir[];
  return rows.map((r) => ({ ...r }));
}

export interface FilmVu {
  nom: string;
  vu_le: string | null;
  duree_min: number;
}

export function filmsVus(db: DB): FilmVu[] {
  const rows = db
    .prepare("SELECT nom, vu_le, duree_min FROM films_vus ORDER BY vu_le DESC, nom ASC")
    .all() as unknown as FilmVu[];
  return rows.map((r) => ({ ...r }));
}

export interface AVoir {
  id: number;
  titre: string;
  ajoute_le: string | null;
}

export function listeAVoir(db: DB): AVoir[] {
  const rows = db
    .prepare("SELECT id, titre, ajoute_le FROM a_voir ORDER BY ajoute_le DESC, titre ASC")
    .all() as unknown as AVoir[];
  return rows.map((r) => ({ ...r }));
}

export function ajouterAVoir(db: DB, titre: string): void {
  const t = titre.trim();
  if (!t) return;
  db.prepare("INSERT OR IGNORE INTO a_voir (titre, ajoute_le) VALUES (?, date('now'))").run(t);
}

export function retirerAVoir(db: DB, id: number): void {
  db.prepare("DELETE FROM a_voir WHERE id = ?").run(id);
}

export interface Progression {
  vus: number;
  diffuses: number;
  total: number;
  minutesRestantes: number;
}

// Avancement d'une série (hors spéciaux) + temps de rattrapage des épisodes diffusés non vus.
export function progressionSerie(db: DB, serieId: number): Progression {
  const r = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM episodes_catalogue c
            WHERE c.serie_id = ? AND c.saison >= 1) AS total,
         (SELECT COUNT(*) FROM episodes_catalogue c
            WHERE c.serie_id = ? AND c.saison >= 1
              AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')) AS diffuses,
         (SELECT COUNT(*) FROM episodes_catalogue c
            JOIN episodes_vus v
              ON v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
           WHERE c.serie_id = ? AND c.saison >= 1
             AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')) AS vus,
         (SELECT COALESCE(SUM(c.duree_min), 0) FROM episodes_catalogue c
           WHERE c.serie_id = ? AND c.saison >= 1
             AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')
             AND NOT EXISTS (SELECT 1 FROM episodes_vus v
                              WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode)
         ) AS minutesRestantes`
    )
    .get(serieId, serieId, serieId, serieId) as unknown as Progression;
  return { ...r };
}
