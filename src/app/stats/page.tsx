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
      <p><strong>Temps total :</strong> {jours} j {heures} h ({s.totalMinutes.toLocaleString("fr-FR")} min)</p>
      <p><strong>{s.nbEpisodes}</strong> épisodes · <strong>{s.nbSeries}</strong> séries · <strong>{s.nbFilms}</strong> films</p>

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
    </div>
  );
}
