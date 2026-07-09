import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

function horodatage(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

export function sauvegarder(
  dbPath: string,
  backupDir: string,
  maxBackups = 10,
  now: Date = new Date()
): { chemin: string; supprimes: string[] } | null {
  if (!existsSync(dbPath)) return null;
  mkdirSync(backupDir, { recursive: true });
  const chemin = join(backupDir, `monsuivi-${horodatage(now)}.db`);

  // VACUUM INTO produit un snapshot cohérent même en mode WAL (≠ copie de fichier).
  const db = new DatabaseSync(dbPath);
  try {
    const cheminSql = chemin.replace(/\\/g, "/").replace(/'/g, "''");
    db.exec(`VACUUM INTO '${cheminSql}'`);
  } finally {
    db.close();
  }

  // Rotation : ne garder que les maxBackups plus récentes (le format AAAA-MM-JJ-HHMMSS
  // trie chronologiquement par ordre alphabétique).
  const fichiers = readdirSync(backupDir)
    .filter((f) => /^monsuivi-.*\.db$/.test(f))
    .sort();
  const supprimes: string[] = [];
  while (fichiers.length > maxBackups) {
    const vieux = fichiers.shift()!;
    rmSync(join(backupDir, vieux));
    supprimes.push(vieux);
  }

  return { chemin, supprimes };
}
