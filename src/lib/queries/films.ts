// Requêtes sur les films vus et la liste « à voir ».
import { transaction, type DB } from "../db";
import type { Provider } from "../tmdb";
import { parseJsonArray } from "./partage";

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

export interface FilmGroupe {
  nom: string;
  dernier_vu: string | null;
  nb_vus: number;
  tmdb_id: number | null;
  poster_path: string | null;
  annee: string | null;
  note: number | null;
  genres: string | null;
  providers: Provider[];
}

// Films distincts (regroupés par nom) avec métadonnées TMDB enrichies.
export function filmsGroupes(db: DB): FilmGroupe[] {
  const rows = db
    .prepare(
      `SELECT nom, MAX(vu_le) AS dernier_vu, COUNT(*) AS nb_vus,
              MAX(tmdb_id) AS tmdb_id, MAX(poster_path) AS poster_path, MAX(annee) AS annee,
              MAX(note) AS note, MAX(genres) AS genres, MAX(providers) AS providers
         FROM films_vus GROUP BY nom ORDER BY dernier_vu DESC, nom ASC`
    )
    .all() as unknown as (Omit<FilmGroupe, "providers"> & { providers: string | null })[];
  return rows.map((r) => {
    const { providers, ...reste } = r;
    return { ...reste, providers: parseJsonArray<Provider>(providers) };
  });
}

export function noterFilm(db: DB, nom: string, note: number | null): void {
  db.prepare("UPDATE films_vus SET note = ? WHERE nom = ?").run(note, nom);
}

export interface AVoir {
  id: number;
  titre: string;
  ajoute_le: string | null;
  tmdb_id: number | null;
  poster_path: string | null;
  annee: string | null;
}

export function listeAVoir(db: DB): AVoir[] {
  const rows = db
    .prepare(
      "SELECT id, titre, ajoute_le, tmdb_id, poster_path, annee FROM a_voir ORDER BY ajoute_le DESC, titre ASC"
    )
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

// Watchlist → vu : crée une entrée films_vus (date du jour, métadonnées reportées) et retire de a_voir.
export function marquerFilmVu(db: DB, aVoirId: number): void {
  const w = db
    .prepare("SELECT titre, tmdb_id, poster_path, annee FROM a_voir WHERE id = ?")
    .get(aVoirId) as unknown as
    | { titre: string; tmdb_id: number | null; poster_path: string | null; annee: string | null }
    | undefined;
  if (!w) return;
  transaction(db, () => {
    db.prepare(
      `INSERT OR IGNORE INTO films_vus (nom, vu_le, duree_min, tmdb_id, poster_path, annee)
       VALUES (?, date('now'), 0, ?, ?, ?)`
    ).run(w.titre, w.tmdb_id, w.poster_path, w.annee);
    db.prepare("DELETE FROM a_voir WHERE id = ?").run(aVoirId);
  });
}
