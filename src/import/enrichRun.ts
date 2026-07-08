import { getDb } from "../lib/db";
import { enrichSeries } from "./enrich";

async function main() {
  if (!process.env.TMDB_READ_TOKEN) {
    console.log("---------------------------------------");
    console.log("Récupération des affiches ignorée : aucune clé TMDB configurée.");
    console.log("Les séries s'afficheront avec une vignette par défaut.");
    console.log("Pour activer les affiches, ajoutez TMDB_READ_TOKEN dans le fichier .env.local.");
    console.log("---------------------------------------");
    return;
  }

  const db = getDb();
  console.log("Enrichissement TMDB des séries (affiches)...");
  const { enrichies, echouees } = await enrichSeries(db);
  console.log("---------------------------------------");
  console.log(`Séries enrichies : ${enrichies}`);
  console.log(`Non trouvées     : ${echouees}`);
  console.log("---------------------------------------");
  db.close();
}

main().catch((e) => {
  console.error("Erreur lors de la récupération des affiches :", e);
  process.exitCode = 1;
});
