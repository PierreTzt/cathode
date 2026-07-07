import { join } from "node:path";
import { transaction, type DB } from "../lib/db";
import { readCsv } from "./csv";

export function importMovies(db: DB, gdprDir: string): number {
  const rows = readCsv(join(gdprDir, "tracking-prod-records.csv"));
  const insert = db.prepare(
    "INSERT OR IGNORE INTO films_vus (nom, vu_le, duree_min) VALUES (?, ?, ?)"
  );
  transaction(db, () => {
    for (const r of rows) {
      if (r.entity_type !== "movie") continue;
      if (!(r.movie_name ?? "").trim()) continue;
      insert.run(
        r.movie_name,
        r.watch_date || r.created_at || null,
        Math.floor(Number(r.runtime || 0) / 60)
      );
    }
  });
  return (db.prepare("SELECT COUNT(*) AS n FROM films_vus").get() as { n: number }).n;
}
