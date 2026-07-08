import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { listeSeries, detailSerie, episodesDeSerie, stats } from "../src/lib/queries";

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
