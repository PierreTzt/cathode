"use server";
import { getDb } from "@/lib/db";
import {
  marquerEpisodeVu,
  marquerJusquA,
  demarquerEpisode,
  ajouterAVoir,
  retirerAVoir,
  noterSerie,
  noterEpisode,
  basculerFavori,
  ajouterSerie,
} from "@/lib/queries";
import { rechercheSeries, type ResultatRechercheSerie } from "@/lib/tmdb";
import { majCatalogue } from "@/import/catalogue";
import { majProvidersToutes } from "@/import/providers";
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
  }
  revalidatePath("/mes-series");
  revalidatePath("/");
  return { id, existait };
}
