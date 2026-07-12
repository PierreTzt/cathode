"use client";
import { useState } from "react";

// À partir des épisodes diffusés non vus, estime la date de fin selon un rythme.
export function BingePlanner({ restants }: { restants: number }) {
  const [parSoir, setParSoir] = useState(2);
  if (restants <= 0) return null;
  const jours = Math.ceil(restants / parSoir);
  const fin = new Date();
  fin.setDate(fin.getDate() + jours - 1);
  const dateFin = fin.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="binge">
      <span className="binge-txt">
        À{" "}
        <select value={parSoir} onChange={(e) => setParSoir(Number(e.target.value))} aria-label="Épisodes par soir">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>{" "}
        épisode{parSoir > 1 ? "s" : ""}/soir → {restants} restant{restants > 1 ? "s" : ""} en{" "}
        <strong>{jours} jour{jours > 1 ? "s" : ""}</strong> (fini {dateFin})
      </span>
    </div>
  );
}
