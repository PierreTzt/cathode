import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { detailSerie, noterSerie, basculerFavori, stats } from "../src/lib/queries";
import { enrichGenres } from "../src/import/enrichGenres";

describe("note / favori", () => {
  it("note une série et l'efface", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom) VALUES (1,'NCIS')");
    noterSerie(db, 1, 8);
    expect(detailSerie(db, 1)!.note).toBe(8);
    noterSerie(db, 1, null);
    expect(detailSerie(db, 1)!.note).toBeNull();
  });

  it("bascule le favori", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom) VALUES (1,'NCIS')");
    expect(detailSerie(db, 1)!.favori).toBe(0);
    basculerFavori(db, 1);
    expect(detailSerie(db, 1)!.favori).toBe(1);
    basculerFavori(db, 1);
    expect(detailSerie(db, 1)!.favori).toBe(0);
  });
});

describe("enrichGenres", () => {
  it("ne traite que les séries sans genres, stocke joint, idempotent", async () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom,tmdb_id) VALUES (1,'A',10),(2,'B',20)");
    db.prepare("UPDATE series SET genres='Déjà' WHERE id=2").run();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return ["Drame", "Comédie"];
    };
    const res = await enrichGenres(db, fetcher);
    expect(res.enrichies).toBe(1); // seule A (B a déjà des genres)
    expect((db.prepare("SELECT genres FROM series WHERE id=1").get() as any).genres).toBe(
      "Drame, Comédie"
    );
    const apres = calls;
    await enrichGenres(db, fetcher); // 2e passe : rien
    expect(calls).toBe(apres);
  });
});

describe("stats enrichies", () => {
  it("calcule genres, jour de semaine, top binge et par mois", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,genres) VALUES (1,'A','Drame, Comédie'),(2,'B','Drame');" +
        // 2026-07-06 = lundi ; on met 2 épisodes ce jour (binge) + 1 un mercredi
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
        "(1,1,1,'a','2026-07-06',40),(1,1,2,'b','2026-07-06',40),(2,1,1,'c','2026-07-08',40);"
    );
    const s = stats(db);
    // genres : Drame x2, Comédie x1
    expect(s.parGenre).toEqual([
      { genre: "Drame", nb: 2 },
      { genre: "Comédie", nb: 1 },
    ]);
    // top binge : 2026-07-06 avec 2 épisodes
    expect(s.topBinge).toEqual({ jour: "2026-07-06", nb: 2 });
    // jour de semaine : lundi = 2 (le 6 juillet 2026 est un lundi)
    expect(s.parJourSemaine.find((d) => d.jour === "lundi")!.nb).toBe(2);
    expect(s.parJourSemaine.find((d) => d.jour === "mercredi")!.nb).toBe(1);
    // par mois : juillet 2026 = 3 épisodes
    expect(s.parMois).toEqual([{ mois: "2026-07", nb: 3 }]);
  });
});
