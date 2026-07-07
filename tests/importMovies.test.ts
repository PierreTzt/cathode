import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { importMovies } from "../src/import/importMovies";

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gdpr-"));
  writeFileSync(
    join(dir, "tracking-prod-records.csv"),
    "entity_type,type,movie_name,watch_date,created_at,runtime\n" +
      "movie,watch,Barbie,,2023-11-09 13:41:05,6840\n" +
      "movie,watch,Inception,,2019-09-12 12:36:38,\n" +
      "movie,follow,Titanic,,2019-09-12 12:35:03,\n" +
      "movie,towatch,Dune,,2021-10-01 12:00:00,\n" +
      "episode,,,,2020-01-01 10:00:00,2700\n"
  );
  return dir;
}

describe("importMovies", () => {
  it("importe uniquement les films vus (type=watch), avec durée en minutes et date de fallback", () => {
    const db = getDb(":memory:");
    const count = importMovies(db, makeDir());
    expect(count).toBe(2);
    const barbie = db.prepare("SELECT * FROM films_vus WHERE nom='Barbie'").get() as any;
    expect(barbie.duree_min).toBe(114);
    expect(barbie.vu_le).toBe("2023-11-09 13:41:05");
    const excluded = db
      .prepare("SELECT COUNT(*) AS n FROM films_vus WHERE nom IN ('Titanic','Dune')")
      .get() as { n: number };
    expect(excluded.n).toBe(0);
  });
});
