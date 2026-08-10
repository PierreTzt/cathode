// Requêtes sur les séries : liste, fiche, métadonnées TMDB, note, favori, statut.
import { transaction, type DB } from "../db";
import type { Provider, CastMembre, RecommandationSerie } from "../tmdb";
import { parseJsonArray } from "./partage";

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
  statut_detail: string | null;
  suivi_statut: string;
  providers: Provider[];
  cast: CastMembre[];
  recommandations: RecommandationSerie[];
}

export function detailSerie(db: DB, id: number): DetailSerie | undefined {
  const row = db
    .prepare(
      `SELECT nom, poster_path, backdrop_path, note, favori, statut_tmdb, statut_detail, suivi_statut,
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
        statut_detail: string | null;
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
    statut_detail: row.statut_detail,
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

// Nombre de séries en bibliothèque, pour distinguer « rien à voir ce soir »
// d'une bibliothèque encore vide (premier lancement).
export function compterSeries(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM series").get() as unknown as { n: number }).n;
}
