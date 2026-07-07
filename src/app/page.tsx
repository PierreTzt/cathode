import { getDb } from "@/lib/db";
import { listeSeries } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const series = listeSeries(db);
  if (series.length === 0) {
    return (
      <div>
        <h1>Aucune donnée</h1>
        <p>Lancez d'abord l'import : double-cliquez sur <code>demarrer-monsuivi.bat</code> (l'import se fait automatiquement au premier démarrage) ou exécutez <code>npm run import</code>.</p>
      </div>
    );
  }
  return (
    <div>
      <h1>Mes séries ({series.length})</h1>
      <table>
        <thead>
          <tr><th>Série</th><th>Épisodes vus</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.id}>
              <td><a href={`/series/${s.id}`}>{s.nom}</a></td>
              <td>{s.nb_episodes}</td>
              <td>{s.archive ? "Archivée" : s.actif ? "En cours" : "Terminée"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
