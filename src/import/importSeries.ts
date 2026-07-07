import { join } from "node:path";
import type { DB } from "../lib/db";
import { readCsv } from "./csv";

export function upsertSerie(
  db: DB,
  s: { source_id: string; nom: string; suivi_le?: string; actif?: number; archive?: number }
): number {
  const existing = db
    .prepare("SELECT id FROM series WHERE source_id = ?")
    .get(s.source_id) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      "UPDATE series SET nom = COALESCE(NULLIF(?, ''), nom), " +
        "suivi_le = COALESCE(suivi_le, ?), " +
        "actif = COALESCE(?, actif), archive = COALESCE(?, archive) WHERE id = ?"
    ).run(s.nom, s.suivi_le ?? null, s.actif ?? null, s.archive ?? null, existing.id);
    return existing.id;
  }
  const info = db
    .prepare(
      "INSERT INTO series (source_id, nom, suivi_le, actif, archive) VALUES (?, ?, ?, ?, ?)"
    )
    .run(s.source_id, s.nom, s.suivi_le ?? null, s.actif ?? 0, s.archive ?? 0);
  return Number(info.lastInsertRowid);
}

export function importSeries(db: DB, gdprDir: string): number {
  const v2 = readCsv(join(gdprDir, "tracking-prod-records-v2.csv"));
  for (const r of v2) {
    if (!(r.key ?? "").startsWith("user-series-")) continue;
    if (!r.s_id) continue;
    upsertSerie(db, {
      source_id: r.s_id,
      nom: r.series_name ?? "",
      suivi_le: r.followed_at || r.created_at || undefined,
      actif: r.is_followed === "true" ? 1 : 0,
      archive: r.is_archived === "true" ? 1 : 0,
    });
  }
  const followed = readCsv(join(gdprDir, "followed_tv_show.csv"));
  for (const r of followed) {
    if (!r.tv_show_id) continue;
    upsertSerie(db, {
      source_id: r.tv_show_id,
      nom: r.tv_show_name ?? "",
      suivi_le: r.created_at || undefined,
      actif: r.active === "1" ? 1 : 0,
      archive: r.archived === "1" ? 1 : 0,
    });
  }
  return (db.prepare("SELECT COUNT(*) AS n FROM series").get() as { n: number }).n;
}
