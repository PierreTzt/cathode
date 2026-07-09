import { join } from "node:path";
import { transaction, type DB } from "../lib/db";
import { readCsv } from "./csv";
import { ajouterAVoir } from "../lib/queries";

// Amorce la watchlist « à voir » depuis les films non vus de l'export TV Time
// (type ∈ {towatch, follow}). Idempotent (ajouterAVoir = INSERT OR IGNORE).
export function importAVoir(db: DB, gdprDir: string): number {
  const rows = readCsv(join(gdprDir, "tracking-prod-records.csv"));
  transaction(db, () => {
    for (const r of rows) {
      if (r.entity_type !== "movie") continue;
      if (r.type !== "towatch" && r.type !== "follow") continue;
      if (!(r.movie_name ?? "").trim()) continue;
      ajouterAVoir(db, r.movie_name);
    }
  });
  return (db.prepare("SELECT COUNT(*) AS n FROM a_voir").get() as { n: number }).n;
}
