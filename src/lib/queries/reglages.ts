// Réglages applicatifs (table app_meta) et configuration Jellyfin.
import type { DB } from "../db";

export function appMetaGet(db: DB, cle: string): string | null {
  const r = db.prepare("SELECT valeur FROM app_meta WHERE cle = ?").get(cle) as unknown as
    | { valeur: string | null }
    | undefined;
  return r ? r.valeur : null;
}

export function appMetaSet(db: DB, cle: string, valeur: string): void {
  db.prepare(
    `INSERT INTO app_meta (cle, valeur) VALUES (?, ?)
     ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur`
  ).run(cle, valeur);
}

// --- Réglages (app_meta) ---------------------------------------------------

export interface ReglagesJellyfin {
  url: string;
  token: string;
  userId: string;
  auto: boolean;
}

export interface Reglages {
  avenirVue: "calendrier" | "liste";
  jellyfin: ReglagesJellyfin;
}

export function reglages(db: DB): Reglages {
  const g = (c: string) => appMetaGet(db, c) ?? "";
  return {
    avenirVue: g("avenir_vue_defaut") === "liste" ? "liste" : "calendrier",
    jellyfin: {
      url: g("jellyfin_url"),
      token: g("jellyfin_token"),
      userId: g("jellyfin_user_id"),
      auto: g("jellyfin_auto") === "1",
    },
  };
}
