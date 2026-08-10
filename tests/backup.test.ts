import { describe, it, expect, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sauvegarder } from "../src/import/backup";

const temps: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "cathode-bkp-"));
  temps.push(d);
  return d;
}
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

function creerDb(dir: string): string {
  const p = join(dir, "cathode.db");
  const db = new DatabaseSync(p);
  db.exec("CREATE TABLE t (v TEXT); INSERT INTO t (v) VALUES ('coucou')");
  db.close();
  return p;
}

describe("sauvegarder", () => {
  it("crée une sauvegarde cohérente contenant les données", () => {
    const dir = tmp();
    const dbPath = creerDb(dir);
    const res = sauvegarder(dbPath, join(dir, "backups"), 10, new Date(2026, 6, 9, 12, 0, 0));
    expect(res).not.toBeNull();
    expect(existsSync(res!.chemin)).toBe(true);
    const b = new DatabaseSync(res!.chemin);
    const row = b.prepare("SELECT v FROM t").get() as any;
    b.close();
    expect(row.v).toBe("coucou");
  });

  it("respecte la rotation (garde les N plus récentes)", () => {
    const dir = tmp();
    const dbPath = creerDb(dir);
    const backupDir = join(dir, "backups");
    for (let i = 0; i < 5; i++) {
      sauvegarder(dbPath, backupDir, 3, new Date(2026, 6, 9, 12, i, 0));
    }
    const restants = readdirSync(backupDir)
      .filter((f) => /^cathode-.*\.db$/.test(f))
      .sort();
    expect(restants.length).toBe(3);
    expect(restants[0]).toContain("120200"); // minute 02
    expect(restants[2]).toContain("120400"); // minute 04
  });

  it("retourne null si la base n'existe pas", () => {
    const dir = tmp();
    expect(sauvegarder(join(dir, "absent.db"), join(dir, "b"), 10, new Date())).toBeNull();
  });
});
