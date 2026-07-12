import Link from "next/link";
import { getDb } from "@/lib/db";
import { journal, souvenirs, type EntreeJournal } from "@/lib/queries";
import { imageUrl } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

function libelleJour(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const label = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function grouperParJour(entrees: EntreeJournal[]): { jour: string; entrees: EntreeJournal[] }[] {
  const map = new Map<string, EntreeJournal[]>();
  for (const e of entrees) {
    const jour = e.vu_le.slice(0, 10);
    if (!map.has(jour)) map.set(jour, []);
    map.get(jour)!.push(e);
  }
  return [...map.entries()].map(([jour, entrees]) => ({ jour, entrees }));
}

export default function JournalPage() {
  const db = getDb();
  const entrees = journal(db);
  const memoire = souvenirs(db);

  if (entrees.length === 0) {
    return (
      <div>
        <h1>Journal</h1>
        <p className="muted">Rien de visionné pour l&apos;instant.</p>
      </div>
    );
  }

  const jours = grouperParJour(entrees);

  return (
    <div>
      <h1>Journal</h1>

      {memoire.length > 0 && (
        <section className="souvenirs">
          <h2>Il y a un an…</h2>
          <ul className="journal-liste">
            {memoire.map((e, i) => (
              <EntreeLigne key={`s${i}`} e={e} avecAnnee />
            ))}
          </ul>
        </section>
      )}

      {jours.map(({ jour, entrees }) => (
        <section key={jour} className="journal-jour">
          <h2 className="journal-date">{libelleJour(jour)}</h2>
          <ul className="journal-liste">
            {entrees.map((e, i) => (
              <EntreeLigne key={`${jour}-${i}`} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntreeLigne({ e, avecAnnee = false }: { e: EntreeJournal; avecAnnee?: boolean }) {
  const poster = imageUrl(e.poster_path, "w92");
  const annee = avecAnnee ? ` · ${e.vu_le.slice(0, 4)}` : "";
  const contenu = (
    <>
      {poster ? (
        <img className="journal-poster" src={poster} alt="" loading="lazy" />
      ) : (
        <div className="journal-poster journal-noimg" aria-hidden>
          🎬
        </div>
      )}
      <div className="journal-texte">
        {e.type === "episode" ? (
          <>
            <div className="journal-nom">{e.nom}</div>
            <div className="muted journal-sous">
              S{deuxChiffres(e.saison ?? 0)}E{deuxChiffres(e.episode ?? 0)}
              {e.titre ? ` · ${e.titre}` : ""}
              {annee}
            </div>
          </>
        ) : (
          <>
            <div className="journal-nom">{e.nom}</div>
            <div className="muted journal-sous">Film{annee}</div>
          </>
        )}
      </div>
    </>
  );
  return (
    <li className="journal-entree">
      {e.type === "episode" && e.serie_id != null ? (
        <Link className="journal-lien" href={`/series/${e.serie_id}`}>
          {contenu}
        </Link>
      ) : (
        <div className="journal-lien">{contenu}</div>
      )}
    </li>
  );
}
