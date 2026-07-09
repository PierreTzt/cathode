import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { majCatalogue } from "../src/import/catalogue";
import type { CatalogueSerie } from "../src/lib/tmdb";

function seed() {
  const db = getDb(":memory:");
  db.exec(
    "INSERT INTO series (id, source_id, nom, tmdb_id) VALUES (1,'a','NCIS',42),(2,'b','SansTmdb',NULL);" +
      // un épisode vu sans durée, présent au catalogue avec durée → doit être comblé
      "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x1',0);"
  );
  return db;
}

const catalogue: CatalogueSerie = {
  statut: "terminée",
  episodes: [
    { saison: 1, episode: 1, titre: "Pilot", date_diffusion: "2003-09-23", duree_min: 45 },
    { saison: 1, episode: 2, titre: "Ep2", date_diffusion: "2003-09-30", duree_min: 45 },
  ],
};

describe("majCatalogue", () => {
  it("insère le catalogue, comble les durées, ignore les séries sans tmdb_id", async () => {
    const db = seed();
    const res = await majCatalogue(db, async () => catalogue);
    expect(res.seriesTraitees).toBe(1); // seule NCIS a un tmdb_id
    expect(res.episodesCatalogue).toBe(2);
    expect(res.dureesComblees).toBe(1);
    const vu = db
      .prepare("SELECT duree_min FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=1")
      .get() as any;
    expect(vu.duree_min).toBe(45); // comblé
    const maj = db.prepare("SELECT catalogue_maj_le, statut_tmdb FROM series WHERE id=1").get() as any;
    expect(maj.catalogue_maj_le).not.toBeNull();
    expect(maj.statut_tmdb).toBe("terminée");
  });

  it("2e passage : série terminée déjà à jour est ignorée", async () => {
    const db = seed();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return catalogue;
    };
    await majCatalogue(db, fetcher);
    const apres1 = calls;
    await majCatalogue(db, fetcher);
    expect(calls).toBe(apres1); // aucune nouvelle requête
  });

  it("upsert idempotent : rejouer ne duplique pas les lignes", async () => {
    const db = seed();
    // force le re-traitement en marquant la série 'en cours'
    const enCours: CatalogueSerie = { ...catalogue, statut: "en cours" };
    await majCatalogue(db, async () => enCours);
    await majCatalogue(db, async () => enCours);
    const n = db.prepare("SELECT COUNT(*) AS n FROM episodes_catalogue WHERE serie_id=1").get() as any;
    expect(n.n).toBe(2);
  });
});
