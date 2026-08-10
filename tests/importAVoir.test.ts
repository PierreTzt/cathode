import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { importAVoir } from "../src/import/importAVoir";
import { listeAVoir } from "../src/lib/queries";

const temps: string[] = [];
function tmpDir() {
  const d = mkdtempSync(join(tmpdir(), "cathode-avoir-"));
  temps.push(d);
  return d;
}
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

const CSV = `entity_type,type,movie_name
movie,watch,DejaVu
movie,towatch,Dune
movie,follow,Oppenheimer
movie,towatch,
series,follow,PasUnFilm
`;

describe("importAVoir", () => {
  it("ne prend que les films towatch/follow, ignore vus et vides, idempotent", () => {
    const dir = tmpDir();
    writeFileSync(join(dir, "tracking-prod-records.csv"), CSV);
    const db = getDb(":memory:");
    importAVoir(db, dir);
    const titres = listeAVoir(db)
      .map((a) => a.titre)
      .sort();
    expect(titres).toEqual(["Dune", "Oppenheimer"]);
    // 2e passage : pas de doublon
    importAVoir(db, dir);
    expect(listeAVoir(db).length).toBe(2);
  });
});
