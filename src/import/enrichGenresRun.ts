import { getDb } from "../lib/db";
import { enrichGenres } from "./enrichGenres";

async function main() {
  if (!process.env.TMDB_READ_TOKEN) {
    console.log("Genres ignorés : aucune clé TMDB configurée (TMDB_READ_TOKEN).");
    return;
  }
  const db = getDb();
  console.log("Récupération des genres (TMDB)...");
  const { enrichies, echecs } = await enrichGenres(db);
  console.log(`Séries enrichies en genres : ${enrichies} · échecs : ${echecs}`);
  db.close();
}

main().catch((e) => {
  console.error("Erreur lors de la récupération des genres :", e);
  process.exitCode = 1;
});
