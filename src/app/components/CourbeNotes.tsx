import type { NoteEpisode } from "@/lib/queries";

// Mini-graphe SVG des notes d'épisodes par saison (barres). Rendu serveur.
export function CourbeNotes({ notes }: { notes: NoteEpisode[] }) {
  if (!notes || notes.length === 0) return null;
  const parSaison = new Map<number, NoteEpisode[]>();
  for (const n of notes) {
    if (!parSaison.has(n.saison)) parSaison.set(n.saison, []);
    parSaison.get(n.saison)!.push(n);
  }
  const saisons = [...parSaison.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <section>
      <h2>Qualité par saison</h2>
      <div className="courbe-saisons">
        {saisons.map(([saison, eps]) => {
          const ordonnes = [...eps].sort((a, b) => a.episode - b.episode);
          const moy = ordonnes.reduce((s, e) => s + e.note, 0) / ordonnes.length;
          const largeur = Math.max(ordonnes.length * 14, 40);
          return (
            <div key={saison} className="courbe-bloc">
              <div className="courbe-titre">
                {saison === 0 ? "Spéciaux" : `S${saison}`}
                <span className="muted"> · ★ {moy.toFixed(1)}</span>
              </div>
              <svg className="courbe-svg" width={largeur} height="52" role="img"
                   aria-label={`Notes saison ${saison}`}>
                {ordonnes.map((e, i) => {
                  const h = (e.note / 5) * 44;
                  return (
                    <rect
                      key={e.episode}
                      x={i * 14 + 2}
                      y={48 - h}
                      width="10"
                      height={h}
                      rx="2"
                      fill="var(--gold)"
                    >
                      <title>{`E${e.episode} · ${e.note}/5`}</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}
