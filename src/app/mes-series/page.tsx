import { getDb } from "@/lib/db";
import { listeSeries } from "@/lib/queries";
import { tmdbConfigure } from "@/lib/tmdb";
import { SeriesGrid } from "@/app/components/SeriesGrid";
import { AjoutSerie } from "@/app/components/AjoutSerie";

export const dynamic = "force-dynamic";

export default function MesSeries() {
  const series = listeSeries(getDb());
  const tmdbActif = tmdbConfigure();
  if (series.length === 0) {
    return (
      <div>
        <h1>Aucune série</h1>
        <p className="muted">
          Importe ton export TV Time (<code>npm run import</code>) ou ajoute une série ci-dessous.
        </p>
        <AjoutSerie tmdbActif={tmdbActif} />
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
      <AjoutSerie tmdbActif={tmdbActif} />
      <SeriesGrid series={series} />
    </div>
  );
}
