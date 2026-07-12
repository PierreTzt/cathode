import { transaction, type DB } from "./db";
import type { Provider, CastMembre, RecommandationSerie } from "./tmdb";

export { etatSuivi, type EtatSuivi } from "./etat";

function parseJsonArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export interface SerieListe {
  id: number;
  nom: string;
  nb_episodes: number;
  actif: number;
  archive: number;
  poster_path: string | null;
  diffuses: number;
  favori: number;
  statut_tmdb: string | null;
  suivi_statut: string;
  en_retard: number;
  dernier_vu: string | null;
}

export function listeSeries(db: DB): SerieListe[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.nom, s.actif, s.archive, s.poster_path, s.favori, s.statut_tmdb,
              COALESCE(s.suivi_statut,'actif') AS suivi_statut,
              COUNT(ev.id) AS nb_episodes,
              (SELECT COUNT(*) FROM episodes_catalogue c
                 WHERE c.serie_id = s.id AND c.saison >= 1
                   AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')) AS diffuses,
              (SELECT COUNT(*) FROM episodes_catalogue c
                 WHERE c.serie_id = s.id AND c.saison >= 1
                   AND c.date_diffusion IS NOT NULL AND c.date_diffusion <= date('now')
                   AND NOT EXISTS (SELECT 1 FROM episodes_vus v
                                    WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode)) AS en_retard,
              (SELECT MAX(v.vu_le) FROM episodes_vus v WHERE v.serie_id = s.id) AS dernier_vu
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
  statut_tmdb: string | null;
  suivi_statut: string;
  providers: Provider[];
  cast: CastMembre[];
  recommandations: RecommandationSerie[];
}

export function detailSerie(db: DB, id: number): DetailSerie | undefined {
  const row = db
    .prepare(
      `SELECT nom, poster_path, backdrop_path, note, favori, statut_tmdb, suivi_statut,
              providers, casting, recommandations FROM series WHERE id = ?`
    )
    .get(id) as unknown as
    | {
        nom: string;
        poster_path: string | null;
        backdrop_path: string | null;
        note: number | null;
        favori: number;
        statut_tmdb: string | null;
        suivi_statut: string | null;
        providers: string | null;
        casting: string | null;
        recommandations: string | null;
      }
    | undefined;
  if (!row) return undefined;
  return {
    nom: row.nom,
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    note: row.note,
    favori: row.favori,
    statut_tmdb: row.statut_tmdb,
    suivi_statut: row.suivi_statut ?? "actif",
    providers: parseJsonArray<Provider>(row.providers),
    cast: parseJsonArray<CastMembre>(row.casting),
    recommandations: parseJsonArray<RecommandationSerie>(row.recommandations),
  };
}

// Enregistre les plateformes de streaming d'une série (rafraîchies à la resync / ajout).
export function majProviders(db: DB, serieId: number, providers: Provider[]): void {
  db.prepare("UPDATE series SET providers = ? WHERE id = ?").run(
    JSON.stringify(providers),
    serieId
  );
}

export function majCast(db: DB, serieId: number, cast: CastMembre[]): void {
  db.prepare("UPDATE series SET casting = ? WHERE id = ?").run(JSON.stringify(cast), serieId);
}

export function majRecommandations(db: DB, serieId: number, recos: RecommandationSerie[]): void {
  db.prepare("UPDATE series SET recommandations = ? WHERE id = ?").run(
    JSON.stringify(recos),
    serieId
  );
}

export type SuiviStatut = "actif" | "pause" | "abandonne";

export function definirStatutSuivi(db: DB, serieId: number, statut: SuiviStatut): void {
  db.prepare("UPDATE series SET suivi_statut = ? WHERE id = ?").run(statut, serieId);
}

export interface SerieAvecActeur {
  id: number;
  nom: string;
  poster_path: string | null;
  personnage: string | null;
}

// Séries de la bibliothèque où figure un acteur (recherche dans le JSON cast).
export function seriesAvecActeur(
  db: DB,
  tmdbId: number
): { acteur: string | null; series: SerieAvecActeur[] } {
  const rows = db
    .prepare(
      "SELECT id, nom, poster_path, casting FROM series WHERE casting IS NOT NULL AND casting <> ''"
    )
    .all() as unknown as { id: number; nom: string; poster_path: string | null; casting: string }[];
  let acteur: string | null = null;
  const series: SerieAvecActeur[] = [];
  for (const r of rows) {
    const membres = parseJsonArray<CastMembre>(r.casting);
    const m = membres.find((x) => x.tmdbId === tmdbId);
    if (m) {
      acteur = acteur ?? m.nom;
      series.push({ id: r.id, nom: r.nom, poster_path: r.poster_path, personnage: m.personnage });
    }
  }
  series.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return { acteur, series };
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
  providers: Provider[];
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
       SELECT r.serie_id, s.nom, s.poster_path, s.backdrop_path, s.providers,
              r.saison, r.episode, r.titre, r.apercu, r.still_path, r.date_diffusion, r.nb_en_retard,
              (SELECT MAX(v.vu_le) FROM episodes_vus v WHERE v.serie_id = r.serie_id) AS dernier_vu
         FROM retard r JOIN series s ON s.id = r.serie_id
        WHERE r.rn = 1
          AND COALESCE(s.suivi_statut,'actif') = 'actif'
        ORDER BY ${ordre}`
    )
    .all() as unknown as (Omit<LigneASuivre, "providers"> & { providers: string | null })[];
  // node:sqlite : aplatir pour la sérialisation RSC → composant client.
  return rows.map((r) => {
    const { providers, ...reste } = r;
    return { ...reste, providers: parseJsonArray<Provider>(providers) };
  });
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
          AND COALESCE(s.suivi_statut,'actif') = 'actif'
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

// --- Notes par épisode (#7) ------------------------------------------------

export interface NoteEpisode {
  saison: number;
  episode: number;
  note: number;
}

export function noterEpisode(
  db: DB,
  serieId: number,
  saison: number,
  episode: number,
  note: number | null
): void {
  if (note == null) {
    db.prepare(
      "DELETE FROM notes_episodes WHERE serie_id = ? AND saison = ? AND episode = ?"
    ).run(serieId, saison, episode);
    return;
  }
  db.prepare(
    `INSERT INTO notes_episodes (serie_id, saison, episode, note) VALUES (?, ?, ?, ?)
     ON CONFLICT (serie_id, saison, episode) DO UPDATE SET note = excluded.note`
  ).run(serieId, saison, episode, note);
}

export function notesEpisodesDeSerie(db: DB, serieId: number): NoteEpisode[] {
  const rows = db
    .prepare(
      "SELECT saison, episode, note FROM notes_episodes WHERE serie_id = ? ORDER BY saison, episode"
    )
    .all(serieId) as unknown as NoteEpisode[];
  return rows.map((r) => ({ ...r }));
}

export interface MeilleurEpisode {
  nom: string;
  saison: number;
  episode: number;
  titre: string | null;
  note: number;
}

// Épisodes les mieux notés, toutes séries confondues (bloc « Meilleurs épisodes » des stats).
export function meilleursEpisodes(db: DB, limite = 10): MeilleurEpisode[] {
  const rows = db
    .prepare(
      `SELECT s.nom, ne.saison, ne.episode, c.titre, ne.note
         FROM notes_episodes ne
         JOIN series s ON s.id = ne.serie_id
         LEFT JOIN episodes_catalogue c
           ON c.serie_id = ne.serie_id AND c.saison = ne.saison AND c.episode = ne.episode
        ORDER BY ne.note DESC, s.nom ASC, ne.saison ASC, ne.episode ASC
        LIMIT ?`
    )
    .all(limite) as unknown as MeilleurEpisode[];
  return rows.map((r) => ({ ...r }));
}

// --- Journal (#8) ----------------------------------------------------------

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

export function appMetaGet(db: DB, cle: string): string | null {
  const r = db.prepare("SELECT valeur FROM app_meta WHERE cle = ?").get(cle) as unknown as
    | { valeur: string | null }
    | undefined;
  return r ? r.valeur : null;
}

export function appMetaSet(db: DB, cle: string, valeur: string): void {
  db.prepare(
    `INSERT INTO app_meta (cle, valeur) VALUES (?, ?)
     ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur`
  ).run(cle, valeur);
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

export interface ResultatLocalSerie {
  id: number;
  nom: string;
  poster_path: string | null;
}
export interface ResultatLocalEpisode {
  serie_id: number;
  nom: string;
  saison: number;
  episode: number;
  titre: string | null;
}

export function rechercheLocale(
  db: DB,
  q: string
): { series: ResultatLocalSerie[]; episodes: ResultatLocalEpisode[] } {
  const t = q.trim();
  if (!t) return { series: [], episodes: [] };
  const needle = `%${t}%`;
  const series = (
    db
      .prepare(
        `SELECT id, nom, poster_path FROM series
          WHERE nom LIKE ? COLLATE NOCASE ORDER BY nom ASC LIMIT 24`
      )
      .all(needle) as unknown as ResultatLocalSerie[]
  ).map((r) => ({ ...r }));
  const episodes = (
    db
      .prepare(
        `SELECT c.serie_id, s.nom, c.saison, c.episode, c.titre
           FROM episodes_catalogue c JOIN series s ON s.id = c.serie_id
          WHERE c.titre LIKE ? COLLATE NOCASE
          ORDER BY s.nom ASC, c.saison ASC, c.episode ASC LIMIT 30`
      )
      .all(needle) as unknown as ResultatLocalEpisode[]
  ).map((r) => ({ ...r }));
  return { series, episodes };
}

// --- Abonnements Web Push (#2) ---------------------------------------------

export interface PushSub {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function ajouterPushSub(
  db: DB,
  sub: { endpoint: string; p256dh: string; auth: string }
): void {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, cree_le)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(sub.endpoint, sub.p256dh, sub.auth);
}

export function listePushSubs(db: DB): PushSub[] {
  return (
    db
      .prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions")
      .all() as unknown as PushSub[]
  ).map((r) => ({ ...r }));
}

export function supprimerPushSub(db: DB, endpoint: string): void {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function compterPushSubs(db: DB): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get() as unknown as { n: number }
  ).n;
}

// --- Épisodes à notifier (#2) ----------------------------------------------

export interface EpisodeANotifier {
  serie_id: number;
  nom: string;
  saison: number;
  episode: number;
  titre: string | null;
}

// Épisodes récemment diffusés (fenêtre `joursRecents`), séries actives suivies
// (≥1 vu), non encore notifiés. Fenêtre = ne pas notifier tout l'arriéré.
export function episodesANotifier(db: DB, joursRecents = 8): EpisodeANotifier[] {
  const rows = db
    .prepare(
      `SELECT c.serie_id, s.nom, c.saison, c.episode, c.titre
         FROM episodes_catalogue c JOIN series s ON s.id = c.serie_id
        WHERE c.saison >= 1
          AND c.date_diffusion IS NOT NULL
          AND c.date_diffusion <= date('now')
          AND c.date_diffusion >= date('now', '-' || ? || ' days')
          AND COALESCE(s.suivi_statut,'actif') = 'actif'
          AND EXISTS (SELECT 1 FROM episodes_vus v WHERE v.serie_id = s.id)
          AND NOT EXISTS (
            SELECT 1 FROM notifications_envoyees n
             WHERE n.serie_id = c.serie_id AND n.saison = c.saison AND n.episode = c.episode)
        ORDER BY c.date_diffusion DESC, s.nom ASC`
    )
    .all(joursRecents) as unknown as EpisodeANotifier[];
  return rows.map((r) => ({ ...r }));
}

export function marquerNotifie(db: DB, serieId: number, saison: number, episode: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO notifications_envoyees (serie_id, saison, episode, envoye_le)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(serieId, saison, episode);
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
