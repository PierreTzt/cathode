// Abonnements push et sélection des épisodes à notifier.
import type { DB } from "../db";

export interface PushSub {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function ajouterPushSub(
  db: DB,
  sub: { endpoint: string; p256dh: string; auth: string }
): void {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, cree_le)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(sub.endpoint, sub.p256dh, sub.auth);
}

export function listePushSubs(db: DB): PushSub[] {
  return (
    db
      .prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions")
      .all() as unknown as PushSub[]
  ).map((r) => ({ ...r }));
}

export function supprimerPushSub(db: DB, endpoint: string): void {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function compterPushSubs(db: DB): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").get() as unknown as { n: number }
  ).n;
}

// --- Épisodes à notifier (#2) ----------------------------------------------

export interface EpisodeANotifier {
  serie_id: number;
  nom: string;
  saison: number;
  episode: number;
  titre: string | null;
}

// Épisodes récemment diffusés (fenêtre `joursRecents`), séries actives suivies
// (≥1 vu), non encore notifiés. Fenêtre = ne pas notifier tout l'arriéré.
export function episodesANotifier(db: DB, joursRecents = 8): EpisodeANotifier[] {
  const rows = db
    .prepare(
      `SELECT c.serie_id, s.nom, c.saison, c.episode, c.titre
         FROM episodes_catalogue c JOIN series s ON s.id = c.serie_id
        WHERE c.saison >= 1
          AND c.date_diffusion IS NOT NULL
          AND c.date_diffusion <= date('now')
          AND c.date_diffusion >= date('now', '-' || ? || ' days')
          AND COALESCE(s.suivi_statut,'actif') = 'actif'
          AND EXISTS (SELECT 1 FROM episodes_vus v WHERE v.serie_id = s.id)
          AND NOT EXISTS (
            SELECT 1 FROM notifications_envoyees n
             WHERE n.serie_id = c.serie_id AND n.saison = c.saison AND n.episode = c.episode)
        ORDER BY c.date_diffusion DESC, s.nom ASC`
    )
    .all(joursRecents) as unknown as EpisodeANotifier[];
  return rows.map((r) => ({ ...r }));
}

export function marquerNotifie(db: DB, serieId: number, saison: number, episode: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO notifications_envoyees (serie_id, saison, episode, envoye_le)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(serieId, saison, episode);
}
