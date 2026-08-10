"use server";
import { etatVersion, type EtatVersion } from "@/lib/version";
import { getDb } from "@/lib/db";
import {
  marquerEpisodeVu,
  marquerJusquA,
  demarquerEpisode,
  ajouterAVoir,
  retirerAVoir,
  marquerFilmVu,
  noterFilm,
  noterSerie,
  noterEpisode,
  basculerFavori,
  ajouterSerie,
  definirStatutSuivi,
  ajouterPushSub,
  supprimerPushSub,
  appMetaSet,
  reglages,
  type SuiviStatut,
} from "@/lib/queries";
import { rechercheSeries, type ResultatRechercheSerie } from "@/lib/tmdb";
import { testerConnexion, type JellyfinConfig } from "@/lib/jellyfin";
import { majCatalogue } from "@/import/catalogue";
import { majProvidersToutes } from "@/import/providers";
import { majCastToutes } from "@/import/cast";
import { majRecommandationsToutes } from "@/import/recommandationsSeries";
import { syncJellyfin, type ResumeJellyfin } from "@/import/jellyfin";
import { resync, type ResumeResync } from "@/import/resync";
import { revalidatePath } from "next/cache";

export type ResultatRecherche = ResultatRechercheSerie;

function revalider(serieId: number) {
  revalidatePath("/");
  revalidatePath(`/series/${serieId}`);
}

export async function actionMarquerVu(serieId: number, saison: number, episode: number): Promise<void> {
  marquerEpisodeVu(getDb(), serieId, saison, episode);
  revalider(serieId);
}

export async function actionMarquerJusquA(
  serieId: number,
  saison: number,
  episode: number
): Promise<void> {
  marquerJusquA(getDb(), serieId, saison, episode);
  revalider(serieId);
}

export async function actionDemarquer(
  serieId: number,
  saison: number,
  episode: number
): Promise<void> {
  demarquerEpisode(getDb(), serieId, saison, episode);
  revalider(serieId);
}

export async function actionAjouterAVoir(titre: string): Promise<void> {
  ajouterAVoir(getDb(), titre);
  revalidatePath("/films");
}

export async function actionRetirerAVoir(id: number): Promise<void> {
  retirerAVoir(getDb(), id);
  revalidatePath("/films");
}

export async function actionMarquerFilmVu(id: number): Promise<void> {
  marquerFilmVu(getDb(), id);
  revalidatePath("/films");
}

export async function actionNoterFilm(nom: string, note: number | null): Promise<void> {
  noterFilm(getDb(), nom, note);
  revalidatePath("/films");
}

export async function actionNoter(serieId: number, note: number | null): Promise<void> {
  noterSerie(getDb(), serieId, note);
  revalidatePath(`/series/${serieId}`);
}

export async function actionNoterEpisode(
  serieId: number,
  saison: number,
  episode: number,
  note: number | null
): Promise<void> {
  noterEpisode(getDb(), serieId, saison, episode, note);
  revalidatePath(`/series/${serieId}`);
  revalidatePath("/stats");
}

export async function actionStatutSuivi(serieId: number, statut: SuiviStatut): Promise<void> {
  definirStatutSuivi(getDb(), serieId, statut);
  revalidatePath(`/series/${serieId}`);
  revalidatePath("/");
  revalidatePath("/mes-series");
}

export async function actionAbonnerPush(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  ajouterPushSub(getDb(), sub);
}

export async function actionDesabonnerPush(endpoint: string): Promise<void> {
  supprimerPushSub(getDb(), endpoint);
}

// Clé VAPID publique lue au runtime (évite un rebuild pour changer les clés).
export async function actionClePush(): Promise<string | null> {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// --- Réglages ---

export async function actionAvenirVue(vue: "calendrier" | "liste"): Promise<void> {
  appMetaSet(getDb(), "avenir_vue_defaut", vue === "liste" ? "liste" : "calendrier");
  revalidatePath("/a-venir");
  revalidatePath("/reglages");
}

export async function actionSauverJellyfin(cfg: JellyfinConfig & { auto: boolean }): Promise<void> {
  const db = getDb();
  appMetaSet(db, "jellyfin_url", cfg.url.trim());
  appMetaSet(db, "jellyfin_token", cfg.token.trim());
  appMetaSet(db, "jellyfin_user_id", cfg.userId.trim());
  appMetaSet(db, "jellyfin_auto", cfg.auto ? "1" : "0");
  revalidatePath("/reglages");
}

export async function actionTesterJellyfin(
  cfg: JellyfinConfig
): Promise<{ ok: boolean; nom?: string; erreur?: string }> {
  return testerConnexion(cfg);
}

export async function actionSyncJellyfin(): Promise<ResumeJellyfin> {
  const db = getDb();
  const cfg = reglages(db).jellyfin;
  if (!cfg.url || !cfg.token || !cfg.userId) {
    return { appariees: 0, nonAppariees: 0, ajoutes: 0, erreur: "Jellyfin non configuré" };
  }
  const r = await syncJellyfin(db, cfg);
  revalidatePath("/");
  revalidatePath("/reglages");
  return r;
}

// Resync manuelle (bouton du hub « Plus ») : catalogue + plateformes + suggestions.
export async function actionResync(): Promise<ResumeResync> {
  const r = await resync(getDb());
  revalidatePath("/");
  revalidatePath("/a-venir");
  revalidatePath("/mes-series");
  revalidatePath("/plus");
  return r;
}

export async function actionFavori(serieId: number): Promise<void> {
  basculerFavori(getDb(), serieId);
  revalidatePath(`/series/${serieId}`);
  revalidatePath("/mes-series");
}

export async function actionRechercheSeries(query: string): Promise<ResultatRecherche[]> {
  return rechercheSeries(query);
}

// Ajoute une série trouvée sur TMDB puis télécharge son catalogue d'épisodes,
// pour qu'elle apparaisse aussitôt dans « À suivre ».
export async function actionAjouterSerie(s: ResultatRecherche): Promise<{ id: number; existait: boolean }> {
  const db = getDb();
  const { id, existait } = ajouterSerie(db, {
    tmdbId: s.tmdbId,
    nom: s.nom,
    poster_path: s.poster_path,
    backdrop_path: s.backdrop_path,
  });
  if (!existait) {
    await majCatalogue(db, undefined, { serieId: id });
    await majProvidersToutes(db, undefined, { serieId: id });
    await majCastToutes(db, undefined, { serieId: id });
    await majRecommandationsToutes(db, undefined, { serieId: id });
  }
  revalidatePath("/mes-series");
  revalidatePath("/");
  return { id, existait };
}

// Force une vérification de mise à jour (contourne le cache de 6 h).
export async function actionVerifierMaj(): Promise<EtatVersion> {
  return etatVersion(getDb(), { forcer: true });
}
