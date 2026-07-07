import { getDb } from "@/lib/db";
import { detailSerie, episodesDeSerie } from "@/lib/queries";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SeriePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const serie = detailSerie(db, Number(id));
  if (!serie) notFound();
  const eps = episodesDeSerie(db, Number(id));
  return (
    <div>
      <p><a href="/">← Mes séries</a></p>
      <h1>{serie.nom}</h1>
      <p>{eps.length} épisodes vus</p>
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
