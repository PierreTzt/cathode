import { getDb } from "../lib/db";
import { resync } from "./resync";

async function main() {
  if (!process.env.TMDB_READ_TOKEN) {
    console.log("---------------------------------------");
    console.log("Catalogue des épisodes ignoré : aucune clé TMDB configurée.");
    console.log("Le suivi « prochain épisode » nécessite TMDB_READ_TOKEN.");
    console.log("---------------------------------------");
    return;
  }
  const db = getDb();
  const forcer = process.argv.includes("--tout");
  console.log(
    forcer
      ? "Re-téléchargement COMPLET du catalogue + plateformes + suggestions (TMDB, fr-FR)..."
      : "Resynchronisation catalogue + plateformes + suggestions (TMDB)..."
  );
  const r = await resync(db, { forcer });
  console.log("---------------------------------------");
  console.log(`Séries traitées    : ${r.seriesTraitees}`);
  console.log(`Épisodes catalogue : ${r.episodesCatalogue}`);
  console.log(`Plateformes MàJ    : ${r.providers}`);
  console.log(`Suggestions        : ${r.suggestions}`);
  console.log(`Échecs             : ${r.echecs}`);
  console.log("---------------------------------------");
  db.close();
}

main().catch((e) => {
  console.error("Erreur lors de la resynchronisation :", e);
  process.exitCode = 1;
});
