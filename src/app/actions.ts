"use server";
import { getDb } from "@/lib/db";
import { marquerEpisodeVu, marquerJusquA } from "@/lib/queries";
import { revalidatePath } from "next/cache";

export async function actionMarquerVu(serieId: number, saison: number, episode: number): Promise<void> {
  marquerEpisodeVu(getDb(), serieId, saison, episode);
  revalidatePath("/");
}

export async function actionMarquerJusquA(
  serieId: number,
  saison: number,
  episode: number
): Promise<void> {
  marquerJusquA(getDb(), serieId, saison, episode);
  revalidatePath("/");
}
