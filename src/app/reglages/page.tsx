import { getDb } from "@/lib/db";
import { reglages, appMetaGet } from "@/lib/queries";
import { ThemeSelecteur } from "@/app/components/ThemeSelecteur";
import { AvenirVueReglage } from "@/app/components/AvenirVueReglage";
import { NotifsToggle } from "@/app/components/NotifsToggle";
import { ResyncBouton } from "@/app/components/ResyncBouton";
import { JellyfinReglages } from "@/app/components/JellyfinReglages";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function ReglagesPage() {
  const db = getDb();
  const reg = reglages(db);
  const derniere = appMetaGet(db, "derniere_resync");

  return (
    <div>
      <h1>Réglages</h1>

      <section className="plus-bloc">
        <h2>Apparence</h2>
        <p className="muted" style={{ marginTop: 0 }}>Thème de l&apos;application.</p>
        <ThemeSelecteur />
      </section>

      <section className="plus-bloc">
        <h2>Vue « À venir » par défaut</h2>
        <AvenirVueReglage initial={reg.avenirVue} />
      </section>

      <section className="plus-bloc">
        <h2>Notifications</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Alerte quand un nouvel épisode d&apos;une série suivie est diffusé.
        </p>
        <NotifsToggle />
      </section>

      <section className="plus-bloc">
        <h2>Mise à jour du catalogue</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Récupère nouveaux épisodes, plateformes, casting, similaires et suggestions.
          Automatique tous les 3 jours sur le serveur.
        </p>
        <ResyncBouton derniereResync={derniere} />
      </section>

      <section className="plus-bloc">
        <h2>Sauvegarde</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Télécharge une copie complète de ta base (séries, épisodes vus, notes…).
        </p>
        <a className="notifs-btn secondaire" href={`${BASE}/api/backup`} download>
          Télécharger une sauvegarde
        </a>
      </section>

      <section className="plus-bloc">
        <h2>Jellyfin</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Importe automatiquement les épisodes vus sur ton serveur Jellyfin (en complément du
          marquage manuel).
        </p>
        <JellyfinReglages initial={reg.jellyfin} />
      </section>
    </div>
  );
}
