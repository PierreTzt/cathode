import type { DB } from "../lib/db";
import {
  appMetaSet,
  compterPushSubs,
  episodesANotifier,
  marquerNotifie,
  reglages,
} from "../lib/queries";
import { envoyerATous } from "../lib/push";
import { majCatalogue } from "./catalogue";
import { majProvidersToutes } from "./providers";
import { majCastToutes } from "./cast";
import { majRecommandationsToutes } from "./recommandationsSeries";
import { construireSuggestions } from "./suggestions";
import { syncJellyfin } from "./jellyfin";
import { enrichFilms } from "./films";

export interface ResumeResync {
  seriesTraitees: number;
  episodesCatalogue: number;
  providers: number;
  cast: number;
  recommandations: number;
  suggestions: number;
  films: number;
  pushEnvoyes: number;
  jellyfinAjoutes: number;
  echecs: number;
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

// Resynchronisation complète : catalogue + plateformes + casting + similaires +
// suggestions, notifications des nouveaux épisodes, puis horodatage.
export async function resync(db: DB, options: { forcer?: boolean } = {}): Promise<ResumeResync> {
  const cat = await majCatalogue(db, undefined, { forcer: options.forcer });
  const prov = await majProvidersToutes(db);
  const cast = await majCastToutes(db);
  const recos = await majRecommandationsToutes(db);
  const sugg = await construireSuggestions(db);
  appMetaSet(db, "suggestions", JSON.stringify(sugg));
  const films = await enrichFilms(db);

  // Sync Jellyfin optionnelle (si activée et configurée).
  let jellyfinAjoutes = 0;
  const reg = reglages(db);
  if (reg.jellyfin.auto && reg.jellyfin.url && reg.jellyfin.token && reg.jellyfin.userId) {
    try {
      const r = await syncJellyfin(db, reg.jellyfin);
      jellyfinAjoutes = r.ajoutes;
    } catch {
      /* la sync Jellyfin ne doit pas casser la resync */
    }
  }

  // Notifications : nouveaux épisodes diffusés récemment, non encore notifiés.
  const aNotifier = episodesANotifier(db);
  let pushEnvoyes = 0;
  if (aNotifier.length > 0 && compterPushSubs(db) > 0) {
    const premier = aNotifier[0];
    const payload =
      aNotifier.length === 1
        ? {
            titre: `Nouvel épisode — ${premier.nom}`,
            corps: `S${deuxChiffres(premier.saison)}E${deuxChiffres(premier.episode)}${
              premier.titre ? ` · ${premier.titre}` : ""
            }`,
            url: "/",
          }
        : {
            titre: "Nouveaux épisodes",
            corps: `${aNotifier.length} épisodes prêts à regarder`,
            url: "/",
          };
    const r = await envoyerATous(db, payload);
    pushEnvoyes = r.envoyes;
  }
  // Marquer comme notifiés (même sans abonnement : évite de spammer l'arriéré ensuite).
  for (const e of aNotifier) marquerNotifie(db, e.serie_id, e.saison, e.episode);

  appMetaSet(db, "derniere_resync", new Date().toISOString());
  return {
    seriesTraitees: cat.seriesTraitees,
    episodesCatalogue: cat.episodesCatalogue,
    providers: prov.traitees,
    cast: cast.traitees,
    recommandations: recos.traitees,
    suggestions: sugg.length,
    films: films.filmsEnrichis + films.watchlistEnrichis,
    pushEnvoyes,
    jellyfinAjoutes,
    echecs: cat.echecs + prov.echecs + cast.echecs,
  };
}
