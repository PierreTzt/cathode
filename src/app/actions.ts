"use server";
import { getDb } from "@/lib/db";
import { marquerEpisodeVu, marquerJusquA, demarquerEpisode } from "@/lib/queries";
import { revalidatePath } from "next/cache";

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
