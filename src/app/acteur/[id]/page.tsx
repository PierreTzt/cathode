import Link from "next/link";
import { getDb } from "@/lib/db";
import { seriesAvecActeur } from "@/lib/queries";
import { imageUrl } from "@/lib/tmdb";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ActeurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tmdbId = Number(id);
  const { acteur, series } = seriesAvecActeur(getDb(), tmdbId);
  if (series.length === 0) notFound();

  return (
    <div>
      <p>
        <Link className="muted" href="/mes-series">
          ← Mes séries
        </Link>
      </p>
      <h1>{acteur ?? "Cet acteur"}</h1>
      <p className="muted">
        Tu l&apos;as vu dans {series.length} série{series.length > 1 ? "s" : ""} de ta bibliothèque.
      </p>
      <div className="poster-grid">
        {series.map((s) => {
          const src = imageUrl(s.poster_path, "w342");
          return (
            <Link key={s.id} className="poster-link" href={`/series/${s.id}`}>
              <div className="poster-tile">
                {src ? (
                  <img src={src} alt={s.nom} loading="lazy" />
                ) : (
                  <div className="poster-fallback">{s.nom}</div>
                )}
              </div>
              <div className="poster-name">{s.nom}</div>
              {s.personnage && <div className="poster-statut muted cast-role">{s.personnage}</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
