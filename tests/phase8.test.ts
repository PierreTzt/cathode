import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import {
  filmsGroupes,
  noterFilm,
  marquerFilmVu,
  listeAVoir,
  recapHebdo,
  progressionGlobale,
  filmsVus,
} from "../src/lib/queries";
import { rechercheFilm, fetchFilmDetail } from "../src/lib/tmdb";
import { enrichFilms } from "../src/import/films";

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

describe("rechercheFilm / fetchFilmDetail", () => {
  it("parse le 1er résultat et le détail", async () => {
    process.env.TMDB_READ_TOKEN = "t";
    const search = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 27205, title: "Inception", release_date: "2010-07-16", poster_path: "/i.jpg" }] }),
    })) as any;
    expect(await rechercheFilm("inception", null, search)).toEqual({
      tmdbId: 27205,
      titre: "Inception",
      annee: "2010",
      poster_path: "/i.jpg",
    });
    const detail = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ runtime: 148, genres: [{ name: "Science-Fiction" }], poster_path: "/i.jpg", release_date: "2010-07-16" }),
    })) as any;
    const d = (await fetchFilmDetail(27205, detail))!;
    expect(d.duree_min).toBe(148);
    expect(d.genres).toEqual(["Science-Fiction"]);
  });
});

describe("enrichFilms", () => {
  it("apparie les films sans tmdb_id, comble la durée, idempotent", async () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('Inception','2023-01-01',0),('Inception','2024-02-02',0);" +
        "INSERT INTO a_voir (titre,ajoute_le) VALUES ('Dune','2024-01-01');"
    );
    const deps = {
      recherche: async (nom: string) => ({ tmdbId: nom === "Dune" ? 438631 : 27205, titre: nom, annee: "2010", poster_path: "/p.jpg" }),
      detail: async () => ({ duree_min: 148, genres: ["Science-Fiction"], poster_path: "/p.jpg", annee: "2010" }),
      providers: async () => [{ nom: "Netflix", logo_path: "/n.jpg" }],
    };
    const r = await enrichFilms(db, deps);
    expect(r.filmsEnrichis).toBe(1); // 1 nom distinct
    expect(r.watchlistEnrichis).toBe(1);
    // les 2 lignes du même film sont mises à jour
    expect(filmsVus(db).every((f) => f.duree_min === 148)).toBe(true);
    expect(listeAVoir(db)[0].tmdb_id).toBe(438631);
    // idempotent : plus rien à enrichir
    expect((await enrichFilms(db, deps)).filmsEnrichis).toBe(0);
  });
});

describe("films groupés, note, watchlist→vu", () => {
  it("regroupe par nom et note", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO films_vus (nom,vu_le,duree_min,tmdb_id,poster_path) VALUES " +
        "('Heat','2023-01-01',170,949,'/h.jpg'),('Heat','2024-01-01',170,949,'/h.jpg');"
    );
    noterFilm(db, "Heat", 5);
    const g = filmsGroupes(db);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ nom: "Heat", nb_vus: 2, note: 5, tmdb_id: 949 });
  });

  it("marquerFilmVu déplace de la watchlist vers les vus", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO a_voir (id,titre,ajoute_le,tmdb_id,poster_path) VALUES (7,'Tenet','2024-01-01',577922,'/t.jpg');");
    marquerFilmVu(db, 7);
    expect(listeAVoir(db)).toHaveLength(0);
    const g = filmsGroupes(db);
    expect(g[0]).toMatchObject({ nom: "Tenet", tmdb_id: 577922 });
  });
});

describe("recapHebdo", () => {
  it("agrège les 7 derniers jours", () => {
    const db = getDb(":memory:");
    const recent = isoJour(new Date(Date.now() - 2 * 86400000));
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'A');" +
        `INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES ` +
        `(1,1,1,'x','${recent}',45),(1,1,2,'y','${recent}',45),(1,1,3,'z','2000-01-01',45);` +
        `INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('F','${recent}',120);`
    );
    const r = recapHebdo(db);
    expect(r.nbEpisodes).toBe(2);
    expect(r.nbFilms).toBe(1);
    expect(r.minutes).toBe(45 + 45 + 120);
    expect(r.topSerie).toBe("A");
  });
});

describe("progressionGlobale", () => {
  it("calcule le % vu et les séries complètes, ignore abandonnées", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,suivi_statut) VALUES (1,'A','actif'),(2,'B','abandonne');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,date_diffusion) VALUES " +
        "(1,1,1,'2003-01-01'),(1,1,2,'2003-01-08'),(2,1,1,'2004-01-01');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x',45);"
    );
    const p = progressionGlobale(db);
    expect(p.total).toBe(2); // A a 2 diffusés ; B (abandonnée) ignorée
    expect(p.vus).toBe(1);
    expect(p.pct).toBe(50);
    expect(p.seriesCompletes).toBe(0);
  });
});
