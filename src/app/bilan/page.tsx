import Link from "next/link";
import { getDb } from "@/lib/db";
import { anneesDisponibles, statsAnnee } from "@/lib/queries";

export const dynamic = "force-dynamic";

const MOIS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

function duree(min: number): string {
  const h = Math.floor(min / 60);
  const j = Math.floor(h / 24);
  if (j >= 1) return `${j} j ${h % 24} h`;
  return `${h} h ${min % 60} min`;
}

export default async function BilanPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>;
}) {
  const { annee: anneeParam } = await searchParams;
  const db = getDb();
  const annees = anneesDisponibles(db);

  if (annees.length === 0) {
    return (
      <div>
        <h1>Bilan annuel</h1>
        <p className="muted">Pas encore d&apos;activité datée à récapituler.</p>
      </div>
    );
  }

  const annee = anneeParam && annees.includes(anneeParam) ? anneeParam : annees[0];
  const b = statsAnnee(db, annee);
  const maxMois = Math.max(1, ...b.parMois.map((m) => m.nb));

  return (
    <div>
      <h1>Bilan {annee}</h1>

      <div className="bilan-annees">
        {annees.map((a) => (
          <Link key={a} href={`/bilan?annee=${a}`} className={`bilan-annee${a === annee ? " actif" : ""}`}>
            {a}
          </Link>
        ))}
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="n">{duree(b.totalMinutes)}</div>
          <div className="l">Temps de visionnage</div>
        </div>
        <div className="stat-card">
          <div className="n">{b.nbEpisodes.toLocaleString("fr-FR")}</div>
          <div className="l">Épisodes vus</div>
        </div>
        <div className="stat-card">
          <div className="n">{b.nbSeries}</div>
          <div className="l">Séries suivies</div>
        </div>
        <div className="stat-card">
          <div className="n">{b.nbFilms}</div>
          <div className="l">Films</div>
        </div>
        {b.genreDominant && (
          <div className="stat-card">
            <div className="n" style={{ fontSize: "1.3rem" }}>{b.genreDominant}</div>
            <div className="l">Genre dominant</div>
          </div>
        )}
        {b.topBinge && (
          <div className="stat-card">
            <div className="n">{b.topBinge.nb}</div>
            <div className="l">Plus gros binge ({b.topBinge.jour})</div>
          </div>
        )}
      </div>

      {b.nbEpisodes === 0 && b.nbFilms === 0 ? (
        <p className="muted">Aucune activité en {annee}.</p>
      ) : (
        <>
          <h2>Par mois</h2>
          <div className="barres">
            {b.parMois.map((m, i) => (
              <div key={m.mois} className="barre-ligne">
                <span className="barre-label">{MOIS[i]}</span>
                <span className="barre-piste">
                  <span
                    className="barre-remplissage"
                    style={{ width: `${Math.round((m.nb / maxMois) * 100)}%` }}
                  />
                </span>
                <span className="barre-val muted">{m.nb}</span>
              </div>
            ))}
          </div>

          {b.topSeries.length > 0 && (
            <>
              <h2>Top séries {annee}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Série</th>
                    <th>Épisodes vus</th>
                  </tr>
                </thead>
                <tbody>
                  {b.topSeries.map((t) => (
                    <tr key={t.nom}>
                      <td>{t.nom}</td>
                      <td>{t.nb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
