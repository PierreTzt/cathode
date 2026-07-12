import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { majCatalogue } from "../src/import/catalogue";
import { ajouterSerie } from "../src/lib/queries";
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
  statutDetail: "Ended",
  episodes: [
    { saison: 1, episode: 1, titre: "Pilote", apercu: "Le tout premier épisode.", still_path: "/still1.jpg", date_diffusion: "2003-09-23", duree_min: 45 },
    { saison: 1, episode: 2, titre: "Ep2", apercu: null, still_path: null, date_diffusion: "2003-09-30", duree_min: 45 },
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
    const ep1 = db
      .prepare("SELECT titre, apercu, still_path FROM episodes_catalogue WHERE serie_id=1 AND saison=1 AND episode=1")
      .get() as any;
    expect(ep1.titre).toBe("Pilote");
    expect(ep1.apercu).toBe("Le tout premier épisode."); // description stockée
    expect(ep1.still_path).toBe("/still1.jpg"); // vignette d'épisode stockée
  });

  it("forcer : retraite une série terminée déjà à jour", async () => {
    const db = seed();
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return catalogue;
    };
    await majCatalogue(db, fetcher);
    await majCatalogue(db, fetcher, { forcer: true });
    expect(calls).toBe(2); // le 2e passage re-télécharge malgré le statut « terminée »
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

  it("serieId : ne catalogue que la série ciblée", async () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id, source_id, nom, tmdb_id) VALUES (1,'a','A',10),(2,'b','B',20);");
    const vus: number[] = [];
    const fetcher = async (tmdbId: number) => {
      vus.push(tmdbId);
      return catalogue;
    };
    const r = await majCatalogue(db, fetcher, { serieId: 2 });
    expect(r.seriesTraitees).toBe(1);
    expect(vus).toEqual([20]); // seule la série 2 (tmdb 20) est interrogée
  });

  it("ajouterSerie : insère puis idempotent sur tmdb_id", () => {
    const db = getDb(":memory:");
    const a = ajouterSerie(db, { tmdbId: 99, nom: "Nouvelle", poster_path: "/p.jpg", backdrop_path: null });
    expect(a.existait).toBe(false);
    const b = ajouterSerie(db, { tmdbId: 99, nom: "Nouvelle (bis)", poster_path: null, backdrop_path: null });
    expect(b.existait).toBe(true);
    expect(b.id).toBe(a.id); // même série, pas de doublon
    const n = db.prepare("SELECT COUNT(*) AS n FROM series WHERE tmdb_id=99").get() as any;
    expect(n.n).toBe(1);
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
