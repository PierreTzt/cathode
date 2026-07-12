"use client";
import { useState, useTransition } from "react";
import type { EpisodeComplet, NoteEpisode } from "@/lib/queries";
import { actionMarquerVu, actionDemarquer, actionNoterEpisode } from "@/app/actions";

export function EpisodesTracker({
  serieId,
  episodes,
  notes = [],
}: {
  serieId: number;
  episodes: EpisodeComplet[];
  notes?: NoteEpisode[];
}) {
  const [pending, start] = useTransition();
  const [vus, setVus] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(episodes.map((e) => [`${e.saison}-${e.episode}`, e.vu === 1]))
  );
  const [notesMap, setNotesMap] = useState<Record<string, number>>(() =>
    Object.fromEntries(notes.map((n) => [`${n.saison}-${n.episode}`, n.note]))
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

  const noter = (e: EpisodeComplet, v: number) => {
    const key = `${e.saison}-${e.episode}`;
    const nv = notesMap[key] === v ? null : v; // recliquer la même note l'efface
    setNotesMap((m) => {
      const copie = { ...m };
      if (nv == null) delete copie[key];
      else copie[key] = nv;
      return copie;
    });
    start(async () => {
      await actionNoterEpisode(serieId, e.saison, e.episode, nv);
    });
  };

  return (
    <div className="tracker">
      {[...parSaison.entries()].map(([saison, eps]) => {
        const vusSaison = eps.filter((e) => vus[`${e.saison}-${e.episode}`]).length;
        const notesSaison = eps
          .map((e) => notesMap[`${e.saison}-${e.episode}`])
          .filter((n): n is number => typeof n === "number");
        const moy =
          notesSaison.length > 0
            ? notesSaison.reduce((a, b) => a + b, 0) / notesSaison.length
            : null;
        return (
          <section key={saison} className="tracker-saison">
            <h2 className="tracker-titre">
              {saison === 0 ? "Spéciaux" : `Saison ${saison}`}
              <span className="muted">
                {" "}
                · {vusSaison}/{eps.length} vus
                {moy !== null ? ` · ★ ${moy.toFixed(1)}` : ""}
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
                    <span className="tracker-droite">
                      {coche && (
                        <EtoilesEpisode
                          note={notesMap[key] ?? null}
                          disabled={pending}
                          onNoter={(v) => noter(e, v)}
                        />
                      )}
                      <span className="muted tracker-meta">
                        {e.diffuse === 0 ? "à venir" : e.date_diffusion?.slice(0, 10)}
                        {e.duree_min > 0 ? ` · ${e.duree_min} min` : ""}
                      </span>
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

function EtoilesEpisode({
  note,
  disabled,
  onNoter,
}: {
  note: number | null;
  disabled: boolean;
  onNoter: (v: number) => void;
}) {
  return (
    <span className="ep-etoiles" role="group" aria-label="Noter l'épisode sur 5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          className="ep-etoile"
          disabled={disabled}
          onClick={() => onNoter(v)}
          aria-label={`Note ${v} sur 5`}
          title={`${v}/5`}
        >
          {v <= (note ?? 0) ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}
