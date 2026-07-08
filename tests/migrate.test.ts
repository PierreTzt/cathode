import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";

describe("migrate", () => {
  it("ajoute les colonnes d'affiche à series (idempotent)", () => {
    const db = getDb(":memory:"); // getDb applique schema + migrate
    const cols = (db.prepare("PRAGMA table_info(series)").all() as unknown as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toContain("tmdb_id");
    expect(cols).toContain("poster_path");
    expect(cols).toContain("backdrop_path");
    // insérer avec les nouvelles colonnes fonctionne
    db.prepare(
      "INSERT INTO series (source_id, nom, tmdb_id, poster_path) VALUES ('x','Test',42,'/p.jpg')"
    ).run();
    const row = db.prepare("SELECT tmdb_id, poster_path FROM series WHERE source_id='x'").get() as unknown as {
      tmdb_id: number;
      poster_path: string;
    };
    expect(row.tmdb_id).toBe(42);
    expect(row.poster_path).toBe("/p.jpg");
  });
});
