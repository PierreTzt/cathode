// Recherche locale dans les séries et les titres d'épisodes.
import type { DB } from "../db";

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
