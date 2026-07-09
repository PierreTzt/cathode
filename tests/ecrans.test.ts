import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { aVenir, filmsVus, listeAVoir, ajouterAVoir, retirerAVoir } from "../src/lib/queries";

describe("aVenir", () => {
  it("liste les épisodes futurs des séries suivies, dans la fenêtre, triés par date", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,poster_path) VALUES (1,'Suivie','/a.jpg'),(2,'NonSuivie','/b.jpg');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion,duree_min) VALUES " +
        // série 1 (suivie) : un passé (exclu), deux futurs proches, un futur lointain (hors 90j)
        "(1,1,1,'passé','2000-01-01',40)," +
        "(1,1,2,'bientôt', date('now','+3 days'),40)," +
        "(1,1,3,'plusTard', date('now','+10 days'),40)," +
        "(1,1,4,'loin', date('now','+200 days'),40)," +
        // série 2 (non suivie, aucun vu) : futur → exclu
        "(2,1,1,'x', date('now','+5 days'),40);" +
        // série 1 est suivie car un épisode vu
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES (1,1,1,'v','2000-01-02',40);"
    );
    const rows = aVenir(db, 90);
    expect(rows.map((r) => r.titre)).toEqual(["bientôt", "plusTard"]);
    expect(rows.every((r) => r.nom === "Suivie")).toBe(true);
  });
});

describe("filmsVus", () => {
  it("retourne les films triés par date décroissante", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO films_vus (nom,vu_le,duree_min) VALUES ('Ancien','2020-01-01',100),('Récent','2024-01-01',120)"
    );
    expect(filmsVus(db).map((f) => f.nom)).toEqual(["Récent", "Ancien"]);
  });
});

describe("watchlist à voir", () => {
  it("ajoute (trim + anti-doublon), liste et retire", () => {
    const db = getDb(":memory:");
    ajouterAVoir(db, "  Dune  ");
    ajouterAVoir(db, "Dune"); // doublon ignoré
    ajouterAVoir(db, "Oppenheimer");
    let liste = listeAVoir(db);
    expect(liste.map((a) => a.titre).sort()).toEqual(["Dune", "Oppenheimer"]);
    const dune = liste.find((a) => a.titre === "Dune")!;
    retirerAVoir(db, dune.id);
    liste = listeAVoir(db);
    expect(liste.map((a) => a.titre)).toEqual(["Oppenheimer"]);
  });

  it("ignore un titre vide", () => {
    const db = getDb(":memory:");
    ajouterAVoir(db, "   ");
    expect(listeAVoir(db).length).toBe(0);
  });
});
