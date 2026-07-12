import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { etatSuivi } from "../src/lib/etat";
import {
  listeSeries,
  noterEpisode,
  notesEpisodesDeSerie,
  meilleursEpisodes,
  journal,
  souvenirs,
  statsAnnee,
  anneesDisponibles,
  nouveautes,
  appMetaGet,
  appMetaSet,
} from "../src/lib/queries";
import { construireSuggestions } from "../src/import/suggestions";

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

describe("etatSuivi", () => {
  it("dérive les 4 états", () => {
    expect(etatSuivi({ nbVus: 0, enRetard: 0, statutTmdb: "en cours" })).toBe("pas_commencee");
    expect(etatSuivi({ nbVus: 5, enRetard: 3, statutTmdb: "en cours" })).toBe("en_retard");
    expect(etatSuivi({ nbVus: 5, enRetard: 0, statutTmdb: "en cours" })).toBe("a_jour");
    expect(etatSuivi({ nbVus: 5, enRetard: 0, statutTmdb: "terminée" })).toBe("terminee");
    // en retard prime sur terminée
    expect(etatSuivi({ nbVus: 5, enRetard: 2, statutTmdb: "terminée" })).toBe("en_retard");
  });
});

describe("listeSeries — en_retard et dernier_vu", () => {
  it("compte les épisodes diffusés non vus et le dernier visionnage", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,statut_tmdb) VALUES (1,'NCIS','en cours');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,date_diffusion,duree_min) VALUES " +
        "(1,1,1,'2003-01-01',45),(1,1,2,'2003-01-08',45),(1,1,3,'2999-01-01',45);" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,1,1,'x','2026-01-05',45);"
    );
    const s = listeSeries(db).find((r) => r.nom === "NCIS")!;
    expect(s.diffuses).toBe(2); // E1, E2 diffusés (E3 futur)
    expect(s.en_retard).toBe(1); // E2 diffusé non vu
    expect(s.dernier_vu).toBe("2026-01-05");
    expect(s.statut_tmdb).toBe("en cours");
  });
});

describe("notes par épisode", () => {
  it("upsert, effacement et moyenne", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom) VALUES (1,'NCIS');");
    noterEpisode(db, 1, 1, 1, 4);
    noterEpisode(db, 1, 1, 2, 5);
    noterEpisode(db, 1, 1, 1, 3); // upsert
    expect(notesEpisodesDeSerie(db, 1)).toEqual([
      { saison: 1, episode: 1, note: 3 },
      { saison: 1, episode: 2, note: 5 },
    ]);
    noterEpisode(db, 1, 1, 1, null); // efface
    expect(notesEpisodesDeSerie(db, 1)).toEqual([{ saison: 1, episode: 2, note: 5 }]);
  });

  it("meilleursEpisodes trie par note desc", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'NCIS');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion) VALUES " +
        "(1,1,1,'Pilot','2003-01-01'),(1,1,2,'Ep2','2003-01-08');"
    );
    noterEpisode(db, 1, 1, 1, 3);
    noterEpisode(db, 1, 1, 2, 5);
    const top = meilleursEpisodes(db, 5);
    expect(top[0]).toMatchObject({ nom: "NCIS", saison: 1, episode: 2, titre: "Ep2", note: 5 });
    expect(top[1].note).toBe(3);
  });
});

describe("journal", () => {
  it("fusionne épisodes et films, triés par date desc", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,poster_path) VALUES (1,'NCIS','/n.jpg');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion) VALUES (1,1,1,'Pilot','2003-01-01');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES (1,1,1,'x','2026-06-01',45);" +
        "INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('Barbie','2026-06-03',114);"
    );
    const j = journal(db);
    expect(j.map((e) => e.type)).toEqual(["film", "episode"]);
    expect(j[0]).toMatchObject({ type: "film", nom: "Barbie", vu_le: "2026-06-03" });
    expect(j[1]).toMatchObject({ type: "episode", nom: "NCIS", saison: 1, episode: 1, titre: "Pilot" });
  });

  it("souvenirs remonte le même jour des années précédentes", () => {
    const db = getDb(":memory:");
    const today = new Date();
    const mmdd = isoJour(today).slice(5); // MM-DD
    const anneePassee = `${today.getUTCFullYear() - 1}-${mmdd}`;
    const autreJour = `${today.getUTCFullYear() - 1}-01-01`;
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'NCIS');" +
        `INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES ` +
        `(1,1,1,'a','${anneePassee}',45),(1,1,2,'b','${autreJour}',45);`
    );
    const s = souvenirs(db);
    expect(s.length).toBe(1);
    expect(s[0].vu_le).toBe(anneePassee);
  });
});

describe("statsAnnee", () => {
  it("filtre les totaux sur l'année", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,genres) VALUES (1,'NCIS','Drame, Policier');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,1,1,'a','2023-03-01',45),(1,1,2,'b','2023-03-01',45),(1,1,3,'c','2024-01-01',45);" +
        "INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('Barbie','2023-07-01',114);"
    );
    const b = statsAnnee(db, "2023");
    expect(b.nbEpisodes).toBe(2);
    expect(b.nbFilms).toBe(1);
    expect(b.nbSeries).toBe(1);
    expect(b.totalMinutes).toBe(45 + 45 + 114);
    expect(b.genreDominant).toBe("Drame");
    expect(b.topBinge).toEqual({ jour: "2023-03-01", nb: 2 });
    expect(b.parMois[2]).toEqual({ mois: "03", nb: 2 }); // mars
    expect(anneesDisponibles(db)).toEqual(["2024", "2023"]);
  });
});

describe("nouveautes", () => {
  it("compte épisodes dispo, séries en retard et sorties de la semaine", () => {
    const db = getDb(":memory:");
    const bientot = isoJour(new Date(Date.now() + 3 * 86400000));
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'NCIS'),(2,'Lost');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,date_diffusion,duree_min) VALUES " +
        // NCIS : E1 vu, E2 en retard, E3 sort bientôt
        "(1,1,1,'2003-01-01',45),(1,1,2,'2003-01-08',45),(1,1,3,'" + bientot + "',45)," +
        // Lost : E1 en retard
        "(2,1,1,'2004-01-01',42);" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES (1,1,1,'x','2020-01-01',45);"
    );
    const n = nouveautes(db);
    expect(n.episodesDispo).toBe(2); // NCIS E2 + Lost E1
    expect(n.seriesEnRetard).toBe(2);
    expect(n.sortiesSemaine).toBe(1); // NCIS E3 (série suivie)
  });
});

describe("app_meta", () => {
  it("écrit et relit une clé", () => {
    const db = getDb(":memory:");
    expect(appMetaGet(db, "derniere_resync")).toBeNull();
    appMetaSet(db, "derniere_resync", "2026-07-12T10:00:00Z");
    appMetaSet(db, "derniere_resync", "2026-07-12T11:00:00Z");
    expect(appMetaGet(db, "derniere_resync")).toBe("2026-07-12T11:00:00Z");
  });
});

describe("construireSuggestions", () => {
  it("agrège les recommandations en excluant les séries déjà suivies", async () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,tmdb_id,note) VALUES (1,'NCIS',100,9),(2,'Lost',200,8);" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x',45);"
    );
    const fetcher = async (tmdbId: number) => {
      if (tmdbId === 100)
        return [
          { tmdbId: 200, nom: "Lost", annee: null, poster_path: null, backdrop_path: null }, // déjà suivie → exclue
          { tmdbId: 300, nom: "The Wire", annee: "2002", poster_path: "/w.jpg", backdrop_path: null },
        ];
      return [{ tmdbId: 300, nom: "The Wire", annee: null, poster_path: null, backdrop_path: null }]; // doublon → dédup
    };
    const s = await construireSuggestions(db, fetcher);
    expect(s.map((x) => x.tmdbId)).toEqual([300]);
    expect(s[0].raison).toBe("Parce que tu regardes NCIS");
  });
});
