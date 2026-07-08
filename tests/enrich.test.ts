import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { enrichSeries } from "../src/import/enrich";

function seed() {
  const db = getDb(":memory:");
  db.exec(
    "INSERT INTO series (source_id, nom) VALUES ('72108','NCIS'),('79168','Friends'),(NULL,'SansId')"
  );
  return db;
}

describe("enrichSeries", () => {
  it("écrit tmdb_id/poster/backdrop pour les séries avec source_id", async () => {
    const db = seed();
    const finder = async (tvdb: string) =>
      tvdb === "72108"
        ? { tmdbId: 1, posterPath: "/n.jpg", backdropPath: "/nb.jpg" }
        : { tmdbId: 2, posterPath: "/f.jpg", backdropPath: null };
    const res = await enrichSeries(db, finder);
    expect(res.enrichies).toBe(2); // les 2 avec source_id ; la série sans source_id est ignorée
    const ncis = db.prepare("SELECT * FROM series WHERE source_id='72108'").get() as any;
    expect(ncis.tmdb_id).toBe(1);
    expect(ncis.poster_path).toBe("/n.jpg");
  });

  it("est idempotent : ne réinterroge pas une série déjà enrichie", async () => {
    const db = seed();
    let calls = 0;
    const finder = async () => {
      calls++;
      return { tmdbId: 9, posterPath: "/x.jpg", backdropPath: null };
    };
    await enrichSeries(db, finder);
    const callsAfterFirst = calls;
    await enrichSeries(db, finder); // 2e passe : rien à faire
    expect(calls).toBe(callsAfterFirst); // aucun nouvel appel
  });

  it("compte les échecs quand le finder renvoie null", async () => {
    const db = seed();
    const finder = async () => null;
    const res = await enrichSeries(db, finder);
    expect(res.enrichies).toBe(0);
    expect(res.echouees).toBe(2);
  });
});
