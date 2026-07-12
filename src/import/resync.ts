import type { DB } from "../lib/db";
import { appMetaSet } from "../lib/queries";
import { majCatalogue } from "./catalogue";
import { majProvidersToutes } from "./providers";
import { construireSuggestions } from "./suggestions";

export interface ResumeResync {
  seriesTraitees: number;
  episodesCatalogue: number;
  providers: number;
  suggestions: number;
  echecs: number;
}

// Resynchronisation complète : catalogue (épisodes/dates/statut) + plateformes +
// suggestions, puis horodatage. Utilisée par le cron VPS (catalogueRun) ET le
// bouton « Mettre à jour » de l'app (actionResync).
export async function resync(db: DB, options: { forcer?: boolean } = {}): Promise<ResumeResync> {
  const cat = await majCatalogue(db, undefined, { forcer: options.forcer });
  const prov = await majProvidersToutes(db);
  const sugg = await construireSuggestions(db);
  appMetaSet(db, "suggestions", JSON.stringify(sugg));
  appMetaSet(db, "derniere_resync", new Date().toISOString());
  return {
    seriesTraitees: cat.seriesTraitees,
    episodesCatalogue: cat.episodesCatalogue,
    providers: prov.traitees,
    suggestions: sugg.length,
    echecs: cat.echecs + prov.echecs,
  };
}
