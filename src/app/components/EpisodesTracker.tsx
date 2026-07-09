"use client";
import { useState, useTransition } from "react";
import type { EpisodeComplet } from "@/lib/queries";
import { actionMarquerVu, actionDemarquer } from "@/app/actions";

export function EpisodesTracker({
  serieId,
  episodes,
}: {
  serieId: number;
  episodes: EpisodeComplet[];
}) {
  const [pending, start] = useTransition();
  const [vus, setVus] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(episodes.map((e) => [`${e.saison}-${e.episode}`, e.vu === 1]))
  );

  const parSaison = new Map<number, EpisodeComplet[]>();
  for (const e of episodes) {
    if (!parSaison.has(e.saison)) parSaison.set(e.saison, []);
    parSaison.get(e.saison)!.push(e);
  }

  const toggle = (e: EpisodeComplet) => {
    if (e.diffuse === 0) return; // les épisodes à venir ne se cochent pas
    const key = `${e.saison}-${e.episode}`;
    const nv = !vus[key];
    setVus((s) => ({ ...s, [key]: nv })); // optimiste
    start(async () => {
      if (nv) await actionMarquerVu(serieId, e.saison, e.episode);
      else await actionDemarquer(serieId, e.saison, e.episode);
    });
  };

  return (
    <div className="tracker">
      {[...parSaison.entries()].map(([saison, eps]) => {
        const vusSaison = eps.filter((e) => vus[`${e.saison}-${e.episode}`]).length;
        return (
          <section key={saison} className="tracker-saison">
            <h2 className="tracker-titre">
              {saison === 0 ? "Spéciaux" : `Saison ${saison}`}
              <span className="muted">
                {" "}
                · {vusSaison}/{eps.length} vus
              </span>
            </h2>
            <ul className="tracker-liste">
              {eps.map((e) => {
                const key = `${e.saison}-${e.episode}`;
                const coche = !!vus[key];
                return (
                  <li key={key} className={`tracker-ep${e.diffuse ? "" : " a-venir"}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={coche}
                        disabled={pending || e.diffuse === 0}
                        onChange={() => toggle(e)}
                      />
                      <span className="tracker-code">E{e.episode}</span>
                      <span className="tracker-nom">{e.titre ?? "—"}</span>
                    </label>
                    <span className="muted tracker-meta">
                      {e.diffuse === 0 ? "à venir" : e.date_diffusion?.slice(0, 10)}
                      {e.duree_min > 0 ? ` · ${e.duree_min} min` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
