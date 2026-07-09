import { getDb } from "@/lib/db";
import { filmsVus, listeAVoir } from "@/lib/queries";
import { Watchlist } from "@/app/components/Watchlist";

export const dynamic = "force-dynamic";

function heures(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export default function Films() {
  const db = getDb();
  const vus = filmsVus(db);
  const aVoir = listeAVoir(db);
  return (
    <div>
      <h1>
        Films{" "}
        <span className="muted" style={{ fontWeight: 400, fontSize: "1rem" }}>
          · {vus.length} vus
        </span>
      </h1>
      {vus.length === 0 ? (
        <p className="muted">Aucun film vu importé.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Film</th>
              <th>Vu le</th>
              <th>Durée</th>
            </tr>
          </thead>
          <tbody>
            {vus.map((f, i) => (
              <tr key={i}>
                <td>{f.nom}</td>
                <td>{f.vu_le?.slice(0, 10)}</td>
                <td>{f.duree_min > 0 ? heures(f.duree_min) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>À voir</h2>
      <Watchlist items={aVoir} />
    </div>
  );
}
