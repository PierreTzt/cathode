import { join } from "node:path";
import { sauvegarder } from "./backup";

const dbPath = join(process.cwd(), "data", "cathode.db");
const backupDir = join(process.cwd(), "data", "backups");

const res = sauvegarder(dbPath, backupDir);
if (!res) {
  console.log("Aucune base à sauvegarder pour le moment.");
} else {
  console.log(`Sauvegarde créée : ${res.chemin}`);
  if (res.supprimes.length) {
    console.log(`Anciennes sauvegardes supprimées : ${res.supprimes.length}`);
  }
}
