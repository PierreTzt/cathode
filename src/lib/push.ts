import webpush from "web-push";
import type { DB } from "./db";
import { listePushSubs, supprimerPushSub, compterPushSubs, recapHebdo } from "./queries";

let configure = false;

export function pushConfigure(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function config(): boolean {
  if (configure) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:cathode@localhost", pub, priv);
  configure = true;
  return true;
}

export interface PushPayload {
  titre: string;
  corps: string;
  url: string;
}

// Envoie une notification à tous les abonnements ; purge ceux qui sont morts (404/410).
export async function envoyerATous(
  db: DB,
  payload: PushPayload
): Promise<{ envoyes: number; supprimes: number }> {
  if (!config()) return { envoyes: 0, supprimes: 0 };
  const subs = listePushSubs(db);
  let envoyes = 0;
  let supprimes = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      envoyes++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        supprimerPushSub(db, s.endpoint);
        supprimes++;
      }
    }
  }
  return { envoyes, supprimes };
}

// Notification hebdomadaire (récap de la semaine) — utilisée par le cron dimanche.
export async function envoyerRecapHebdo(db: DB): Promise<{ envoyes: number }> {
  const r = recapHebdo(db);
  if ((r.nbEpisodes === 0 && r.nbFilms === 0) || compterPushSubs(db) === 0) return { envoyes: 0 };
  const h = Math.round(r.minutes / 60);
  const corps =
    `${r.nbEpisodes} épisode${r.nbEpisodes > 1 ? "s" : ""}` +
    (r.nbFilms > 0 ? `, ${r.nbFilms} film${r.nbFilms > 1 ? "s" : ""}` : "") +
    ` · ${h} h` +
    (r.topSerie ? ` · surtout ${r.topSerie}` : "");
  const res = await envoyerATous(db, { titre: "Ta semaine sur Cathode", corps, url: "/stats" });
  return { envoyes: res.envoyes };
}
