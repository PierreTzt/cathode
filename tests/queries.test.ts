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
  episodesCompletsDeSerie,
  progressionSerie,
  demarquerEpisode,
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

describe("tableauASuivre — tri", () => {
  it("bascule entre tri par prochain épisode et par dernier vu", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'A'),(2,'B');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion,duree_min) VALUES " +
        // A : E1 vu (2001), E2 en retard ; B : E1 vu (2020), E2 en retard
        "(1,1,1,'a1','2001-01-01',40),(1,1,2,'a2','2001-01-08',40)," +
        "(2,1,1,'b1','2020-01-01',40),(2,1,2,'b2','2020-01-08',40);" +
        // A vu le 2026-06-01 (plus récent) ; B vu le 2026-05-01
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,1,1,'x','2026-06-01',40),(2,1,1,'y','2026-05-01',40);"
    );
    // prochain épisode : B (2020-01-08) plus récent que A (2001-01-08) → B en tête
    expect(tableauASuivre(db, "prochain").map((r) => r.nom)).toEqual(["B", "A"]);
    // dernier vu : A (2026-06-01) plus récent que B (2026-05-01) → A en tête
    expect(tableauASuivre(db, "dernier_vu").map((r) => r.nom)).toEqual(["A", "B"]);
    // défaut = prochain
    expect(tableauASuivre(db).map((r) => r.nom)).toEqual(["B", "A"]);
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

describe("episodesCompletsDeSerie", () => {
  it("liste tous les épisodes (spéciaux inclus) avec drapeaux vu/diffuse", () => {
    const eps = episodesCompletsDeSerie(seedCatalogue(), 1);
    // NCIS : S0E1 (spécial), S1E1 vu, S1E2 diffusé non vu, S1E3 futur
    expect(eps.map((e) => `${e.saison}x${e.episode}`)).toEqual(["0x1", "1x1", "1x2", "1x3"]);
    const s1e1 = eps.find((e) => e.saison === 1 && e.episode === 1)!;
    expect(s1e1.vu).toBe(1);
    expect(s1e1.diffuse).toBe(1);
    const s1e2 = eps.find((e) => e.saison === 1 && e.episode === 2)!;
    expect(s1e2.vu).toBe(0);
    expect(s1e2.diffuse).toBe(1);
    const s1e3 = eps.find((e) => e.saison === 1 && e.episode === 3)!;
    expect(s1e3.diffuse).toBe(0); // futur
  });
});

describe("progressionSerie", () => {
  it("compte vus/diffusés/total et le temps de rattrapage", () => {
    const p = progressionSerie(seedCatalogue(), 1);
    // saison>=1 : total 3 (E1,E2,E3) ; diffusés 2 (E1,E2) ; vus 1 (E1)
    expect(p).toMatchObject({ vus: 1, diffuses: 2, total: 3 });
    // minutes restantes = durée du seul diffusé non vu (E2 = 45)
    expect(p.minutesRestantes).toBe(45);
  });
});

describe("demarquerEpisode", () => {
  it("supprime le marquage : l'épisode redevient non vu", () => {
    const db = seedCatalogue();
    marquerEpisodeVu(db, 1, 1, 2);
    expect(episodesCompletsDeSerie(db, 1).find((e) => e.episode === 2)!.vu).toBe(1);
    demarquerEpisode(db, 1, 1, 2);
    expect(episodesCompletsDeSerie(db, 1).find((e) => e.episode === 2)!.vu).toBe(0);
    const n = db
      .prepare("SELECT COUNT(*) AS n FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=2")
      .get() as any;
    expect(n.n).toBe(0);
  });
});

describe("listeSeries — progression", () => {
  it("renseigne le nombre d'épisodes diffusés du catalogue", () => {
    const db = seedCatalogue();
    const ncis = listeSeries(db).find((s) => s.nom === "NCIS")!;
    // catalogue NCIS saison>=1 diffusés = E1, E2 (E3 futur exclu)
    expect(ncis.diffuses).toBe(2);
  });
});
