import webpush from "web-push";
import type { DB } from "./db";
import { listePushSubs, supprimerPushSub } from "./queries";

let configure = false;

export function pushConfigure(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function config(): boolean {
  if (configure) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:monsuivi@localhost", pub, priv);
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
