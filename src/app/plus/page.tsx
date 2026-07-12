import Link from "next/link";
import { getDb } from "@/lib/db";
import { appMetaGet } from "@/lib/queries";
import { SuggestionsListe } from "@/app/components/SuggestionsListe";
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
  { href: "/reglages", label: "Réglages", desc: "Thème, notifs, Jellyfin, sauvegarde" },
];

export default function PlusPage() {
  const db = getDb();
  const suggestions = lireSuggestions(appMetaGet(db, "suggestions"));

  return (
    <div>
      <h1>Plus</h1>

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
