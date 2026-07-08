import { getDb } from "@/lib/db";
import { detailSerie, episodesDeSerie } from "@/lib/queries";
import { imageUrl } from "@/lib/tmdb";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SeriePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const serie = detailSerie(db, Number(id));
  if (!serie) notFound();
  const eps = episodesDeSerie(db, Number(id));
  const bg = imageUrl(serie.backdrop_path, "w780");
  const poster = imageUrl(serie.poster_path, "w185");
  return (
    <div>
      <p><a className="muted" href="/">← Mes séries</a></p>
      <div className="serie-hero">
        {bg && <div className="serie-hero-bg" style={{ backgroundImage: `url(${bg})` }} />}
        <div className="serie-hero-inner">
          {poster && <img className="serie-hero-poster" src={poster} alt={serie.nom} />}
          <div>
            <h1 style={{ margin: 0 }}>{serie.nom}</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>{eps.length} épisodes vus</p>
          </div>
        </div>
      </div>
      <table>
        <thead><tr><th>Saison</th><th>Épisode</th><th>Vu le</th><th>Revu</th></tr></thead>
        <tbody>
          {eps.map((e, i) => (
            <tr key={i}>
              <td>{e.saison}</td><td>{e.episode}</td>
              <td>{e.vu_le?.slice(0, 10)}</td>
              <td>{e.rewatch_count > 0 ? `×${e.rewatch_count}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
