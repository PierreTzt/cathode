"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { imageUrl } from "@/lib/tmdb";
import type { EpisodeAVenir } from "@/lib/queries";

function dateLisible(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(iso + "T00:00:00")
  );
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

export function AvenirVues({
  eps,
  defaut,
}: {
  eps: EpisodeAVenir[];
  defaut: "calendrier" | "liste";
}) {
  const [vue, setVue] = useState<"calendrier" | "liste">(defaut);
  const [moisOffset, setMoisOffset] = useState(0);

  const parJour = useMemo(() => {
    const m = new Map<string, EpisodeAVenir[]>();
    for (const e of eps) {
      if (!m.has(e.date_diffusion)) m.set(e.date_diffusion, []);
      m.get(e.date_diffusion)!.push(e);
    }
    return m;
  }, [eps]);

  return (
    <div>
      <div className="avenir-barre">
        <div className="theme-sel" role="group" aria-label="Vue">
          <button className={`theme-btn${vue === "calendrier" ? " actif" : ""}`} onClick={() => setVue("calendrier")}>
            Calendrier
          </button>
          <button className={`theme-btn${vue === "liste" ? " actif" : ""}`} onClick={() => setVue("liste")}>
            Liste
          </button>
        </div>
      </div>

      {vue === "liste" ? (
        <Liste parJour={parJour} />
      ) : (
        <Calendrier parJour={parJour} moisOffset={moisOffset} setMoisOffset={setMoisOffset} />
      )}
    </div>
  );
}

function Liste({ parJour }: { parJour: Map<string, EpisodeAVenir[]> }) {
  const jours = [...parJour.keys()].sort();
  return (
    <>
      {jours.map((date) => (
        <section key={date} className="avenir-jour">
          <h2 className="avenir-date">{dateLisible(date)}</h2>
          <ul className="avenir-liste">
            {parJour.get(date)!.map((e) => {
              const poster = imageUrl(e.poster_path, "w185");
              return (
                <li key={`${e.serie_id}-${e.saison}-${e.episode}`} className="avenir-ep">
                  {poster && <img className="avenir-poster" src={poster} alt={e.nom} loading="lazy" />}
                  <div>
                    <Link className="avenir-nom" href={`/series/${e.serie_id}`}>
                      {e.nom}
                    </Link>
                    <div className="muted">
                      S{e.saison}E{e.episode}
                      {e.titre ? ` — ${e.titre}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function Calendrier({
  parJour,
  moisOffset,
  setMoisOffset,
}: {
  parJour: Map<string, EpisodeAVenir[]>;
  moisOffset: number;
  setMoisOffset: (n: number) => void;
}) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + moisOffset);
  const annee = base.getFullYear();
  const mois = base.getMonth();
  const titreMois = base.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // 0 = lundi
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const cellules: (Date | null)[] = [];
  for (let i = 0; i < decalage; i++) cellules.push(null);
  for (let d = 1; d <= nbJours; d++) cellules.push(new Date(annee, mois, d));
  while (cellules.length % 7 !== 0) cellules.push(null);
  const aujourdhui = iso(new Date());

  return (
    <div className="cal">
      <div className="cal-tete">
        <button className="cal-nav" onClick={() => setMoisOffset(moisOffset - 1)} aria-label="Mois précédent">
          ‹
        </button>
        <span className="cal-mois">{titreMois.charAt(0).toUpperCase() + titreMois.slice(1)}</span>
        <button className="cal-nav" onClick={() => setMoisOffset(moisOffset + 1)} aria-label="Mois suivant">
          ›
        </button>
      </div>
      <div className="cal-grille">
        {JOURS.map((j, i) => (
          <div key={i} className="cal-jour-tete">
            {j}
          </div>
        ))}
        {cellules.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell vide" />;
          const key = iso(d);
          const liste = parJour.get(key) ?? [];
          return (
            <div key={i} className={`cal-cell${key === aujourdhui ? " today" : ""}`}>
              <span className="cal-num">{d.getDate()}</span>
              <div className="cal-eps">
                {liste.slice(0, 3).map((e) => {
                  const poster = imageUrl(e.poster_path, "w92");
                  return (
                    <Link
                      key={`${e.serie_id}-${e.saison}-${e.episode}`}
                      href={`/series/${e.serie_id}`}
                      className="cal-ep"
                      title={`${e.nom} S${e.saison}E${e.episode}`}
                    >
                      {poster ? <img src={poster} alt={e.nom} loading="lazy" /> : <span>{e.nom.slice(0, 2)}</span>}
                    </Link>
                  );
                })}
                {liste.length > 3 && <span className="cal-plus">+{liste.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
