import { join } from "node:path";
import { getDb } from "../lib/db";
import { importSeries } from "./importSeries";
import { importEpisodes } from "./importEpisodes";
import { importMovies } from "./importMovies";

const gdprDir = join(process.cwd(), "gdpr-data");
const db = getDb();

console.log("Import en cours depuis", gdprDir, "...");
const nbSeries = importSeries(db, gdprDir);
const nbEpisodes = importEpisodes(db, gdprDir);
const nbFilms = importMovies(db, gdprDir);

console.log("---------------------------------------");
console.log(`Séries importées   : ${nbSeries}`);
console.log(`Épisodes vus       : ${nbEpisodes}`);
console.log(`Films vus          : ${nbFilms}`);
console.log("Base écrite dans   : data/monsuivi.db");
console.log("---------------------------------------");
db.close();
