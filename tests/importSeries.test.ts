import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { importSeries } from "../src/import/importSeries";

function makeGdprDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gdpr-"));
  writeFileSync(
    join(dir, "tracking-prod-records-v2.csv"),
    "user_id,key,s_id,series_name,followed_at,created_at,is_archived,is_followed\n" +
      "849896,user-series-aaa,72108,NCIS,2015-01-01 10:00:00,2015-01-01 10:00:00,false,true\n" +
      "849896,user-series-bbb,73800,Desperate Housewives,,2015-12-24 20:15:55,true,true\n" +
      "849896,watch-episode-xxx,72108,NCIS,,2020-01-01 10:00:00,,\n" +
      "849896,user-series-ccc,60059,Breaking Bad,2015-01-01 10:00:00,2015-01-01 10:00:00,false,true\n"
  );
  writeFileSync(
    join(dir, "followed_tv_show.csv"),
    "tv_show_name,active,archived,created_at,tv_show_id\n" +
      "NCIS,1,0,2015-01-01 10:00:00,72108\n" +
      "The Simpsons,1,0,2015-12-24 20:12:28,71663\n" +
      "Breaking Bad,0,1,2015-01-01 10:00:00,60059\n"
  );
  return dir;
}

describe("importSeries", () => {
  it("importe les user-series et fusionne le statut de followed_tv_show", () => {
    const db = getDb(":memory:");
    const dir = makeGdprDir();
    const count = importSeries(db, dir);
    expect(count).toBe(4); // NCIS, Desperate Housewives, The Simpsons, Breaking Bad
    const ncis = db.prepare("SELECT * FROM series WHERE source_id='72108'").get() as any;
    expect(ncis.nom).toBe("NCIS");
    expect(ncis.actif).toBe(1);
    const simpsons = db.prepare("SELECT * FROM series WHERE source_id='71663'").get() as any;
    expect(simpsons.nom).toBe("The Simpsons");
    // followed_tv_show.csv is AUTHORITATIVE over tracking-prod-records-v2.csv:
    // Breaking Bad is actif=1/archive=0 per the v2 user-series row, but
    // followed_tv_show says active=0/archived=1 — the latter must win.
    const breakingBad = db.prepare("SELECT * FROM series WHERE source_id='60059'").get() as any;
    expect(breakingBad.nom).toBe("Breaking Bad");
    expect(breakingBad.actif).toBe(0);
    expect(breakingBad.archive).toBe(1);
  });
});
