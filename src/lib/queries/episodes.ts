// Requêtes sur les épisodes : à suivre, marquage, catalogue, progression, notes.
import { transaction, type DB } from "../db";
import type { Provider } from "../tmdb";
import { parseJsonArray, RETARD_WHERE } from "./partage";

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

// Upsert d'un épisode vu venant de Jellyfin (complément du marquage manuel) :
// n'écrase pas un vu_le existant, ne fait que remonter le rewatch. Renvoie true si ajout.
export function upsertVuJellyfin(
  db: DB,
  serieId: number,
  saison: number,
  episode: number,
  vuLe: string | null,
  rewatch: number
): boolean {
  const existe = db
    .prepare("SELECT id FROM episodes_vus WHERE serie_id=? AND saison=? AND episode=?")
    .get(serieId, saison, episode);
  if (existe) {
    db.prepare(
      "UPDATE episodes_vus SET rewatch_count = MAX(rewatch_count, ?) WHERE serie_id=? AND saison=? AND episode=?"
    ).run(rewatch, serieId, saison, episode);
    return false;
  }
  db.prepare(
    `INSERT INTO episodes_vus (serie_id, saison, episode, episode_source_id, vu_le, duree_min, rewatch_count)
     VALUES (?, ?, ?, NULL, ?,
             COALESCE((SELECT duree_min FROM episodes_catalogue WHERE serie_id=? AND saison=? AND episode=?), 0),
             ?)`
  ).run(serieId, saison, episode, vuLe, serieId, saison, episode, rewatch);
  return true;
}

// --- Récap hebdo (#8) ------------------------------------------------------

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
