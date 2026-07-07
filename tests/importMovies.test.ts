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
    "entity_type,movie_name,watch_date,created_at,runtime\n" +
      "movie,Barbie,,2023-11-09 13:41:05,6840\n" +
      "movie,Inception,,2019-09-12 12:36:38,\n" +
      "episode,,,2020-01-01 10:00:00,2700\n"
  );
  return dir;
}

describe("importMovies", () => {
  it("importe les films avec durée en minutes et date de fallback", () => {
    const db = getDb(":memory:");
    const count = importMovies(db, makeDir());
    expect(count).toBe(2);
    const barbie = db.prepare("SELECT * FROM films_vus WHERE nom='Barbie'").get() as any;
    expect(barbie.duree_min).toBe(114);
    expect(barbie.vu_le).toBe("2023-11-09 13:41:05");
  });
});
