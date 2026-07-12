import type { DB } from "../lib/db";
import {
  rechercheFilm,
  fetchFilmDetail,
  fetchFilmProviders,
  type ResultatFilm,
  type FilmDetail,
  type Provider,
} from "../lib/tmdb";

export interface ResumeFilms {
  filmsEnrichis: number;
  watchlistEnrichis: number;
  echecs: number;
}

export interface FilmFetchers {
  recherche?: (nom: string, annee: string | null) => Promise<ResultatFilm | null>;
  detail?: (id: number) => Promise<FilmDetail | null>;
  providers?: (id: number) => Promise<Provider[] | null>;
}

// Apparie les films vus et la watchlist à TMDB (par nom) : affiche, durée, genres,
// plateformes. Idempotent : ne traite que les entrées sans tmdb_id.
export async function enrichFilms(db: DB, deps: FilmFetchers = {}): Promise<ResumeFilms> {
  const rech = deps.recherche ?? ((n, a) => rechercheFilm(n, a));
  const det = deps.detail ?? ((id) => fetchFilmDetail(id));
  const prov = deps.providers ?? ((id) => fetchFilmProviders(id));

  let filmsEnrichis = 0;
  let watchlistEnrichis = 0;
  let echecs = 0;

  const noms = db
    .prepare("SELECT DISTINCT nom FROM films_vus WHERE tmdb_id IS NULL")
    .all() as unknown as { nom: string }[];
  for (const { nom } of noms) {
    const r = await rech(nom, null);
    if (!r) {
      echecs++;
      continue;
    }
    const d = await det(r.tmdbId);
    const p = await prov(r.tmdbId);
    db.prepare(
      `UPDATE films_vus
          SET tmdb_id = ?, poster_path = ?, annee = ?, genres = ?, providers = ?,
              duree_min = CASE WHEN duree_min IS NULL OR duree_min = 0 THEN ? ELSE duree_min END
        WHERE nom = ?`
    ).run(
      r.tmdbId,
      d?.poster_path ?? r.poster_path,
      d?.annee ?? r.annee,
      (d?.genres ?? []).join(", "),
      JSON.stringify(p ?? []),
      d?.duree_min ?? 0,
      nom
    );
    filmsEnrichis++;
  }

  const wl = db
    .prepare("SELECT id, titre FROM a_voir WHERE tmdb_id IS NULL")
    .all() as unknown as { id: number; titre: string }[];
  for (const w of wl) {
    const r = await rech(w.titre, null);
    if (!r) {
      echecs++;
      continue;
    }
    db.prepare("UPDATE a_voir SET tmdb_id = ?, poster_path = ?, annee = ? WHERE id = ?").run(
      r.tmdbId,
      r.poster_path,
      r.annee,
      w.id
    );
    watchlistEnrichis++;
  }

  return { filmsEnrichis, watchlistEnrichis, echecs };
}
