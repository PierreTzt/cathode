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

  it("crée episodes_catalogue et les colonnes de suivi (idempotent)", () => {
    const db = getDb(":memory:");
    const cols = (db.prepare("PRAGMA table_info(series)").all() as unknown as { name: string }[]).map(
      (c) => c.name
    );
    expect(cols).toContain("catalogue_maj_le");
    expect(cols).toContain("statut_tmdb");
    // la table catalogue existe et accepte une ligne
    db.prepare("INSERT INTO series (id, source_id, nom) VALUES (1,'a','NCIS')").run();
    db.prepare(
      "INSERT INTO episodes_catalogue (serie_id, saison, episode, titre, date_diffusion, duree_min) VALUES (1,1,1,'Pilot','2003-09-23',45)"
    ).run();
    const row = db
      .prepare("SELECT titre, duree_min FROM episodes_catalogue WHERE serie_id=1 AND saison=1 AND episode=1")
      .get() as unknown as { titre: string; duree_min: number };
    expect(row.titre).toBe("Pilot");
    expect(row.duree_min).toBe(45);
  });
});
