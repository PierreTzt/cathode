"use client";
import { useState } from "react";
import { PosterTile } from "./PosterTile";
import type { SerieListe } from "@/lib/queries";

export function SeriesGrid({ series }: { series: SerieListe[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? series.filter((s) => s.nom.toLowerCase().includes(needle))
    : series;
  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Rechercher une série…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="poster-grid">
        {filtered.map((s) => (
          <PosterTile
            key={s.id}
            id={s.id}
            nom={s.nom}
            poster_path={s.poster_path}
            nb_episodes={s.nb_episodes}
            diffuses={s.diffuses}
            favori={s.favori}
          />
        ))}
      </div>
    </>
  );
}
