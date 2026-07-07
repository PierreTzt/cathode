import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import { listeSeries } from "../src/lib/queries";

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
});
