import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export type DB = DatabaseSync;

const DEFAULT_PATH = join(process.cwd(), "data", "monsuivi.db");

export function migrate(db: DB): void {
  const cols = (db.prepare("PRAGMA table_info(series)").all() as unknown as { name: string }[]).map(
    (c) => c.name
  );
  const add = (name: string, type: string) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE series ADD COLUMN ${name} ${type}`);
  };
  add("tmdb_id", "INTEGER");
  add("poster_path", "TEXT");
  add("backdrop_path", "TEXT");
  add("catalogue_maj_le", "TEXT");
  add("statut_tmdb", "TEXT");
  add("note", "INTEGER");
  add("favori", "INTEGER DEFAULT 0");
  add("genres", "TEXT");
  // Plateformes de streaming (JSON [{nom, logo_path}]) rafraîchies à la resync.
  add("providers", "TEXT");
  // Statut de suivi manuel : actif (défaut) | pause | abandonne.
  add("suivi_statut", "TEXT DEFAULT 'actif'");
  // Casting (JSON top ~10) et séries similaires (JSON), rafraîchis à la resync.
  // « casting » et non « cast » : CAST est un mot réservé SQLite.
  add("casting", "TEXT");
  add("recommandations", "TEXT");

  // Colonnes ajoutées après coup sur episodes_catalogue.
  const colsCat = (
    db.prepare("PRAGMA table_info(episodes_catalogue)").all() as unknown as { name: string }[]
  ).map((c) => c.name);
  if (!colsCat.includes("apercu")) {
    db.exec("ALTER TABLE episodes_catalogue ADD COLUMN apercu TEXT");
  }
  if (!colsCat.includes("still_path")) {
    db.exec("ALTER TABLE episodes_catalogue ADD COLUMN still_path TEXT");
  }
}

export function getDb(path: string = DEFAULT_PATH): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  const schema = readFileSync(join(process.cwd(), "src", "lib", "schema.sql"), "utf8");
  db.exec(schema);
  migrate(db);
  return db;
}

export function transaction<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
