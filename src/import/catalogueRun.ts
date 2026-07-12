import { getDb } from "../lib/db";
import { majCatalogue } from "./catalogue";

async function main() {
  if (!process.env.TMDB_READ_TOKEN) {
    console.log("---------------------------------------");
    console.log("Catalogue des épisodes ignoré : aucune clé TMDB configurée.");
    console.log("Le suivi « prochain épisode » nécessite TMDB_READ_TOKEN dans .env.local.");
    console.log("---------------------------------------");
    return;
  }
  const db = getDb();
  const forcer = process.argv.includes("--tout");
  console.log(
    forcer
      ? "Re-téléchargement COMPLET du catalogue (TMDB, fr-FR)..."
      : "Récupération du catalogue des épisodes (TMDB)..."
  );
  const r = await majCatalogue(db, undefined, { forcer });
  console.log("---------------------------------------");
  console.log(`Séries traitées    : ${r.seriesTraitees}`);
  console.log(`Épisodes catalogue : ${r.episodesCatalogue}`);
  console.log(`Durées comblées    : ${r.dureesComblees}`);
  console.log(`Échecs             : ${r.echecs}`);
  console.log("---------------------------------------");
  db.close();
}

main().catch((e) => {
  console.error("Erreur lors de la récupération du catalogue :", e);
  process.exitCode = 1;
});
