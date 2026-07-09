import { getDb } from "@/lib/db";
import { listeSeries } from "@/lib/queries";
import { SeriesGrid } from "@/app/components/SeriesGrid";

export const dynamic = "force-dynamic";

export default function MesSeries() {
  const series = listeSeries(getDb());
  if (series.length === 0) {
    return (
      <div>
        <h1>Aucune donnée</h1>
        <p>
          Lancez d&apos;abord l&apos;import : double-cliquez sur{" "}
          <code>demarrer-monsuivi.bat</code> ou exécutez <code>npm run import</code>.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1>
        Mes séries{" "}
        <span className="muted" style={{ fontWeight: 400, fontSize: "1rem" }}>
          · {series.length}
        </span>
      </h1>
      <SeriesGrid series={series} />
    </div>
  );
}
