import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import {
  listeSeries,
  detailSerie,
  episodesDeSerie,
  stats,
  tableauASuivre,
  marquerEpisodeVu,
  marquerJusquA,
} from "../src/lib/queries";

function seed() {
  const db = getDb(":memory:");
  db.exec(
    "INSERT INTO series (id, source_id, nom, actif, archive) VALUES (1,'a','NCIS',1,0),(2,'b','Lost',0,1);" +
      "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES " +
      "(1,1,1,'x1',45),(1,1,2,'x2',45),(2,1,1,'y1',42);"
  );
  return db;
}

describe("listeSeries", () => {
  it("retourne les séries triées par nombre d'épisodes vus", () => {
    const rows = listeSeries(seed());
    expect(rows[0].nom).toBe("NCIS");
    expect(rows[0].nb_episodes).toBe(2);
    expect(rows[1].nom).toBe("Lost");
  });

  it("inclut poster_path", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id, source_id, nom, actif, archive, poster_path) VALUES (1,'a','NCIS',1,0,'/p.jpg');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x1',45);"
    );
    const rows = listeSeries(db);
    expect(rows[0].poster_path).toBe("/p.jpg");
  });
});

describe("détail série", () => {
  it("retourne le nom et les épisodes triés", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,source_id,nom,actif,archive) VALUES (1,'a','NCIS',1,0);" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,2,1,'e21','2020-02-01',45),(1,1,1,'e11','2020-01-01',45);"
    );
    expect(detailSerie(db, 1)!.nom).toBe("NCIS");
    const eps = episodesDeSerie(db, 1);
    expect(eps[0].saison).toBe(1);
    expect(eps[1].saison).toBe(2);
  });

  it("detailSerie renvoie les chemins d'images", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,source_id,nom,poster_path,backdrop_path) VALUES (1,'a','NCIS','/p.jpg','/b.jpg')"
    );
    expect(detailSerie(db, 1)).toEqual({ nom: "NCIS", poster_path: "/p.jpg", backdrop_path: "/b.jpg" });
  });
});

describe("stats", () => {
  it("calcule les totaux et la répartition par année", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,source_id,nom) VALUES (1,'a','NCIS');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,1,1,'e1','2020-01-01',45),(1,1,2,'e2','2021-01-01',45);" +
        "INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('Barbie','2023-01-01',114);"
    );
    const s = stats(db);
    expect(s.totalMinutes).toBe(204);
    expect(s.nbEpisodes).toBe(2);
    expect(s.nbFilms).toBe(1);
    expect(s.parAnnee).toEqual([
      { annee: "2020", nb: 1 },
      { annee: "2021", nb: 1 },
    ]);
    expect(s.topSeries[0]).toEqual({ nom: "NCIS", nb: 2 });
  });
});

function seedCatalogue() {
  const db = getDb(":memory:");
  db.exec(
    "INSERT INTO series (id,source_id,nom,poster_path) VALUES (1,'a','NCIS','/n.jpg'),(2,'b','Lost','/l.jpg');" +
      // NCIS : S1E1 diffusé+vu, S1E2 diffusé non vu, S1E3 futur non vu
      "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion,duree_min) VALUES " +
      "(1,0,1,'Special','2003-01-01',20)," + // spécial → ignoré
      "(1,1,1,'Pilot','2003-09-23',45),(1,1,2,'Ep2','2003-09-30',45),(1,1,3,'Futur','2999-01-01',45)," +
      // Lost : S1E1 et S1E2 diffusés non vus
      "(2,1,1,'LostPilot','2004-09-22',42),(2,1,2,'LostEp2','2004-09-29',42);" +
      "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x1',45);"
  );
  return db;
}

describe("tableauASuivre", () => {
  it("liste le prochain épisode diffusé non vu, exclut spéciaux et futurs, trie par date desc", () => {
    const rows = tableauASuivre(seedCatalogue());
    // Lost (2004) avant NCIS (prochain E2 = 2003) → tri par date_diffusion du prochain, desc
    expect(rows.map((r) => r.nom)).toEqual(["Lost", "NCIS"]);
    const ncis = rows.find((r) => r.nom === "NCIS")!;
    expect(ncis).toMatchObject({ saison: 1, episode: 2, titre: "Ep2", nb_en_retard: 1 });
    const lost = rows.find((r) => r.nom === "Lost")!;
    expect(lost).toMatchObject({ saison: 1, episode: 1, nb_en_retard: 2 });
  });
});

describe("marquerEpisodeVu", () => {
  it("insère l'épisode avec durée du catalogue et disparaît du tableau", () => {
    const db = seedCatalogue();
    marquerEpisodeVu(db, 1, 1, 2);
    const vu = db
      .prepare("SELECT duree_min, vu_le FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=2")
      .get() as any;
    expect(vu.duree_min).toBe(45);
    expect(vu.vu_le).not.toBeNull();
    expect(tableauASuivre(db).some((r) => r.nom === "NCIS")).toBe(false);
  });

  it("idempotent : rejouer ne crée pas de doublon", () => {
    const db = seedCatalogue();
    marquerEpisodeVu(db, 1, 1, 2);
    marquerEpisodeVu(db, 1, 1, 2);
    const n = db
      .prepare("SELECT COUNT(*) AS n FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=2")
      .get() as any;
    expect(n.n).toBe(1);
  });
});

describe("marquerJusquA", () => {
  it("coche l'épisode cible et tous les précédents diffusés non vus, jamais les futurs", () => {
    const db = seedCatalogue();
    marquerJusquA(db, 2, 1, 2); // Lost jusqu'à S1E2
    const n = db.prepare("SELECT COUNT(*) AS n FROM episodes_vus WHERE serie_id=2").get() as any;
    expect(n.n).toBe(2);
    // NCIS futur (S1E3) jamais coché même si on demande jusqu'à E3
    marquerJusquA(db, 1, 1, 3);
    const futur = db
      .prepare("SELECT COUNT(*) AS n FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=3")
      .get() as any;
    expect(futur.n).toBe(0);
  });
});
