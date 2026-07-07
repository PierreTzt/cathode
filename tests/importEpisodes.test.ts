import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { importEpisodes } from "../src/import/importEpisodes";

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gdpr-"));
  writeFileSync(
    join(dir, "tracking-prod-records-v2.csv"),
    "key,s_id,episode_id,series_name,episode_number,season_number,created_at,runtime,rewatch_count\n" +
      "watch-episode-1,72108,111,NCIS,4,12,2020-01-01 10:00:00,2700,\n" +
      "watch-episode-2,357888,222,\"Love, Death & Robots\",4,1,2025-05-18 03:30:21,780,\n" +
      "rewatch-episode-3,72108,111,NCIS,4,12,2021-01-01 10:00:00,2700,1\n" +
      "user-series-x,72108,,NCIS,,,2015-01-01 10:00:00,,\n"
  );
  return dir;
}

function makeDirNullFirst(): string {
  const dir = mkdtempSync(join(tmpdir(), "gdpr-"));
  writeFileSync(
    join(dir, "tracking-prod-records-v2.csv"),
    "key,s_id,episode_id,series_name,episode_number,season_number,created_at,runtime,rewatch_count\n" +
      "watch-episode-1,72108,111,NCIS,4,12,,2700,\n" +
      "rewatch-episode-2,72108,111,NCIS,4,12,2021-05-01 10:00:00,2700,1\n"
  );
  return dir;
}

function makeDirNullSecond(): string {
  const dir = mkdtempSync(join(tmpdir(), "gdpr-"));
  writeFileSync(
    join(dir, "tracking-prod-records-v2.csv"),
    "key,s_id,episode_id,series_name,episode_number,season_number,created_at,runtime,rewatch_count\n" +
      "watch-episode-1,72108,111,NCIS,4,12,2021-05-01 10:00:00,2700,\n" +
      "rewatch-episode-2,72108,111,NCIS,4,12,,2700,1\n"
  );
  return dir;
}

describe("importEpisodes", () => {
  it("insère les épisodes distincts et convertit les durées en minutes", () => {
    const db = getDb(":memory:");
    const dir = makeDir();
    const count = importEpisodes(db, dir);
    expect(count).toBe(2); // NCIS S12E4 (dédoublonné) + Love,Death&Robots S1E4
    const ncis = db
      .prepare(
        "SELECT ev.* FROM episodes_vus ev JOIN series s ON s.id = ev.serie_id WHERE s.source_id='72108'"
      )
      .get() as any;
    expect(ncis.duree_min).toBe(45);
    expect(ncis.rewatch_count).toBe(1); // max(0,1)
    expect(ncis.vu_le).toBe("2020-01-01 10:00:00"); // date la plus ancienne
  });

  it("préserve une date réelle quand la ligne dupliquée a une date vide (null en premier)", () => {
    const db = getDb(":memory:");
    const dir = makeDirNullFirst();
    const count = importEpisodes(db, dir);
    expect(count).toBe(1);
    const ncis = db
      .prepare(
        "SELECT ev.* FROM episodes_vus ev JOIN series s ON s.id = ev.serie_id WHERE s.source_id='72108'"
      )
      .get() as any;
    expect(ncis.vu_le).toBe("2021-05-01 10:00:00");
    expect(ncis.rewatch_count).toBe(1);
  });

  it("préserve une date réelle quand la ligne dupliquée a une date vide (null en second)", () => {
    const db = getDb(":memory:");
    const dir = makeDirNullSecond();
    const count = importEpisodes(db, dir);
    expect(count).toBe(1);
    const ncis = db
      .prepare(
        "SELECT ev.* FROM episodes_vus ev JOIN series s ON s.id = ev.serie_id WHERE s.source_id='72108'"
      )
      .get() as any;
    expect(ncis.vu_le).toBe("2021-05-01 10:00:00");
    expect(ncis.rewatch_count).toBe(1);
  });
});
