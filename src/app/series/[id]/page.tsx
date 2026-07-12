import { getDb } from "@/lib/db";
import {
  detailSerie,
  episodesDeSerie,
  episodesCompletsDeSerie,
  notesEpisodesDeSerie,
  progressionSerie,
  etatSuivi,
} from "@/lib/queries";
import { EpisodesTracker } from "@/app/components/EpisodesTracker";
import { NoteFavori } from "@/app/components/NoteFavori";
import { StatutBadge } from "@/app/components/StatutBadge";
import { Providers } from "@/app/components/Providers";
import { imageUrl } from "@/lib/tmdb";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function heures(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export default async function SeriePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const serieId = Number(id);
  const db = getDb();
  const serie = detailSerie(db, serieId);
  if (!serie) notFound();
  const prog = progressionSerie(db, serieId);
  const eps = episodesCompletsDeSerie(db, serieId);
  const notes = notesEpisodesDeSerie(db, serieId);
  const bg = imageUrl(serie.backdrop_path, "w780");
  const poster = imageUrl(serie.poster_path, "w185");
  const pct = prog.diffuses > 0 ? Math.round((prog.vus / prog.diffuses) * 100) : 0;
  const enRetard = Math.max(0, prog.diffuses - prog.vus);
  const etat = etatSuivi({ nbVus: prog.vus, enRetard, statutTmdb: serie.statut_tmdb });
  const moyenneGlobale =
    notes.length > 0 ? notes.reduce((a, n) => a + n.note, 0) / notes.length : null;

  return (
    <div>
      <p>
        <Link className="muted" href="/">
          ← À suivre
        </Link>
      </p>
      <div className="serie-hero">
        {bg && <div className="serie-hero-bg" style={{ backgroundImage: `url(${bg})` }} />}
        <div className="serie-hero-inner">
          {poster && <img className="serie-hero-poster" src={poster} alt={serie.nom} />}
          <div>
            <h1 style={{ margin: 0 }}>{serie.nom}</h1>
            <div className="serie-hero-meta">
              <StatutBadge etat={etat} enRetard={enRetard} />
              {moyenneGlobale !== null && (
                <span className="serie-moy" title="Moyenne de tes notes d'épisodes">
                  ★ {moyenneGlobale.toFixed(1)}
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {prog.vus}/{prog.diffuses} épisodes vus
              {prog.total > prog.diffuses ? ` · ${prog.total} au total` : ""}
            </p>
            <Providers providers={serie.providers} />
            <NoteFavori serieId={serieId} note={serie.note} favori={serie.favori} />
          </div>
        </div>
      </div>

      {prog.diffuses > 0 && (
        <div className="prog-bandeau">
          <div className="prog-barre">
            <div className="prog-remplissage" style={{ width: `${pct}%` }} />
          </div>
          <div className="prog-legende">
            <span>
              <strong>{pct}%</strong> vu
            </span>
            {prog.minutesRestantes > 0 && (
              <span className="muted">~{heures(prog.minutesRestantes)} de rattrapage</span>
            )}
          </div>
        </div>
      )}

      {eps.length > 0 ? (
        <EpisodesTracker serieId={serieId} episodes={eps} notes={notes} />
      ) : (
        <FallbackVus serieId={serieId} />
      )}
    </div>
  );
}

// Séries sans catalogue TMDB (non enrichies) : on montre au moins l'historique vu, en lecture seule.
function FallbackVus({ serieId }: { serieId: number }) {
  const eps = episodesDeSerie(getDb(), serieId);
  if (eps.length === 0) {
    return <p className="muted">Catalogue d&apos;épisodes indisponible pour cette série.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Saison</th>
          <th>Épisode</th>
          <th>Vu le</th>
          <th>Revu</th>
        </tr>
      </thead>
      <tbody>
        {eps.map((e, i) => (
          <tr key={i}>
            <td>{e.saison}</td>
            <td>{e.episode}</td>
            <td>{e.vu_le?.slice(0, 10)}</td>
            <td>{e.rewatch_count > 0 ? `×${e.rewatch_count}` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
