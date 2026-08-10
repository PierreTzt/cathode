import { existsSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../lib/db";
import { importSeries } from "./importSeries";
import { importEpisodes } from "./importEpisodes";
import { importMovies } from "./importMovies";

const gdprDir = join(process.cwd(), "gdpr-data");

// L'import TV Time est facultatif : sans export, l'appli démarre sur une base
// vide et les séries s'ajoutent depuis l'écran Recherche.
if (!existsSync(gdprDir)) {
  console.log(`Aucun export TV Time trouvé dans ${gdprDir}.`);
  console.log("Rien à importer — l'appli démarre sur une base vide.");
  console.log("Ajoutez vos séries depuis l'écran Recherche.");
  process.exit(0);
}

const db = getDb();

console.log("Import en cours depuis", gdprDir, "...");
importSeries(db, gdprDir);
const nbEpisodes = importEpisodes(db, gdprDir);
const nbFilms = importMovies(db, gdprDir);
// Total réel après tous les imports : importEpisodes peut ajouter des séries
// (via upsertSerie) absentes des fichiers de suivi, donc on recompte ici.
const nbSeries = (db.prepare("SELECT COUNT(*) AS n FROM series").get() as { n: number }).n;

console.log("---------------------------------------");
console.log(`Séries importées   : ${nbSeries}`);
console.log(`Épisodes vus       : ${nbEpisodes}`);
console.log(`Films vus          : ${nbFilms}`);
console.log("Base écrite dans   : data/cathode.db");
console.log("---------------------------------------");
db.close();
