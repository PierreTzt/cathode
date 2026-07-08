import { getDb } from "../lib/db";
import { enrichSeries } from "./enrich";

async function main() {
  const db = getDb();
  console.log("Enrichissement TMDB des séries (affiches)...");
  const { enrichies, echouees } = await enrichSeries(db);
  console.log("---------------------------------------");
  console.log(`Séries enrichies : ${enrichies}`);
  console.log(`Non trouvées     : ${echouees}`);
  console.log("---------------------------------------");
  db.close();
}

main();
