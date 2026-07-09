"use client";
import { useState, useTransition } from "react";
import { actionNoter, actionFavori } from "@/app/actions";

export function NoteFavori({
  serieId,
  note,
  favori,
}: {
  serieId: number;
  note: number | null;
  favori: number;
}) {
  const [pending, start] = useTransition();
  const [n, setN] = useState<number | null>(note);
  const [fav, setFav] = useState(favori === 1);

  const noter = (v: number) => {
    const nv = n === v ? null : v; // recliquer la même note l'efface
    setN(nv);
    start(async () => {
      await actionNoter(serieId, nv);
    });
  };
  const toggleFav = () => {
    setFav((f) => !f);
    start(async () => {
      await actionFavori(serieId);
    });
  };

  return (
    <div className="notefav">
      <button
        className={`fav-btn${fav ? " actif" : ""}`}
        onClick={toggleFav}
        disabled={pending}
        aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
        title="Favori"
      >
        {fav ? "♥" : "♡"}
      </button>
      <div className="note-etoiles" role="group" aria-label="Note sur 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            className="note-pt"
            onClick={() => noter(v)}
            disabled={pending}
            aria-label={`Note ${v} sur 10`}
            title={`${v}/10`}
          >
            {v <= (n ?? 0) ? "★" : "☆"}
          </button>
        ))}
        <span className="muted note-val">{n !== null ? `${n}/10` : "non noté"}</span>
      </div>
    </div>
  );
}
