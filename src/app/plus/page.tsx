import Link from "next/link";
import { getDb } from "@/lib/db";
import { appMetaGet } from "@/lib/queries";
import { ResyncBouton } from "@/app/components/ResyncBouton";
import { SuggestionsListe } from "@/app/components/SuggestionsListe";
import { NotifsToggle } from "@/app/components/NotifsToggle";
import type { Suggestion } from "@/import/suggestions";

export const dynamic = "force-dynamic";

function lireSuggestions(json: string | null): Suggestion[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const LIENS = [
  { href: "/recherche", label: "Rechercher", desc: "Séries, épisodes, TMDB" },
  { href: "/films", label: "Films", desc: "Films vus & watchlist" },
  { href: "/stats", label: "Statistiques", desc: "Temps, genres, activité" },
  { href: "/bilan", label: "Bilan annuel", desc: "Ton année en séries" },
];

export default function PlusPage() {
  const db = getDb();
  const derniere = appMetaGet(db, "derniere_resync");
  const suggestions = lireSuggestions(appMetaGet(db, "suggestions"));

  return (
    <div>
      <h1>Plus</h1>

      <section className="plus-bloc">
        <h2>Mise à jour du catalogue</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Récupère les nouveaux épisodes, dates de diffusion, plateformes et suggestions depuis TMDB.
          La mise à jour automatique tourne tous les 3 jours sur le serveur.
        </p>
        <ResyncBouton derniereResync={derniere} />
      </section>

      <section className="plus-bloc">
        <h2>Notifications</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Reçois une alerte quand un nouvel épisode d&apos;une série suivie est diffusé.
        </p>
        <NotifsToggle />
      </section>

      <section className="plus-bloc">
        <h2>Rubriques</h2>
        <div className="plus-liens">
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className="plus-lien">
              <span className="plus-lien-label">{l.label}</span>
              <span className="plus-lien-desc muted">{l.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="plus-bloc">
        <h2>À commencer</h2>
        <SuggestionsListe suggestions={suggestions} />
      </section>
    </div>
  );
}
