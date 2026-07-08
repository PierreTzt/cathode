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
