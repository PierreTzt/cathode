import { getDb } from "@/lib/db";
import { stats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function StatsPage() {
  const s = stats(getDb());
  const jours = Math.floor(s.totalMinutes / 60 / 24);
  const heures = Math.floor((s.totalMinutes / 60) % 24);
  return (
    <div>
      <h1>Statistiques</h1>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="n">{jours} j {heures} h</div>
          <div className="l">Temps total ({s.totalMinutes.toLocaleString("fr-FR")} min)</div>
        </div>
        <div className="stat-card"><div className="n">{s.nbEpisodes.toLocaleString("fr-FR")}</div><div className="l">Épisodes vus</div></div>
        <div className="stat-card"><div className="n">{s.nbSeries}</div><div className="l">Séries</div></div>
        <div className="stat-card"><div className="n">{s.nbFilms}</div><div className="l">Films</div></div>
        {s.topBinge && (
          <div className="stat-card">
            <div className="n">{s.topBinge.nb}</div>
            <div className="l">Plus gros binge ({s.topBinge.jour})</div>
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Estimation basse : l&apos;export TV Time ne fournit la durée que pour une partie des épisodes,
        et un épisode revu n&apos;est compté qu&apos;une fois. Ton temps réel est plus élevé.
      </p>

      <h2>Top séries</h2>
      <table>
        <thead><tr><th>Série</th><th>Épisodes vus</th></tr></thead>
        <tbody>
          {s.topSeries.map((t) => (
            <tr key={t.nom}><td>{t.nom}</td><td>{t.nb}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Activité par année</h2>
      <table>
        <thead><tr><th>Année</th><th>Épisodes vus</th></tr></thead>
        <tbody>
          {s.parAnnee.map((a) => (
            <tr key={a.annee}><td>{a.annee}</td><td>{a.nb}</td></tr>
          ))}
        </tbody>
      </table>

      {s.parGenre.length > 0 && (
        <>
          <h2>Par genre</h2>
          <Barres data={s.parGenre.map((g) => ({ label: g.genre, nb: g.nb }))} />
        </>
      )}

      <h2>Par jour de la semaine</h2>
      <Barres data={s.parJourSemaine.map((d) => ({ label: d.jour, nb: d.nb }))} />

      {s.parMois.length > 0 && (
        <>
          <h2>Par mois (12 derniers)</h2>
          <Barres data={s.parMois.map((m) => ({ label: m.mois, nb: m.nb }))} />
        </>
      )}
    </div>
  );
}

function Barres({ data }: { data: { label: string; nb: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.nb));
  return (
    <div className="barres">
      {data.map((d) => (
        <div key={d.label} className="barre-ligne">
          <span className="barre-label">{d.label}</span>
          <span className="barre-piste">
            <span className="barre-remplissage" style={{ width: `${Math.round((d.nb / max) * 100)}%` }} />
          </span>
          <span className="barre-val muted">{d.nb}</span>
        </div>
      ))}
    </div>
  );
}
