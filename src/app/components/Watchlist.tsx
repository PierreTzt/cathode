"use client";
import { useState, useTransition } from "react";
import type { AVoir } from "@/lib/queries";
import { actionAjouterAVoir, actionRetirerAVoir } from "@/app/actions";

export function Watchlist({ items }: { items: AVoir[] }) {
  const [pending, start] = useTransition();
  const [titre, setTitre] = useState("");

  const ajouter = () => {
    const t = titre.trim();
    if (!t) return;
    setTitre("");
    start(async () => {
      await actionAjouterAVoir(t);
    });
  };
  const retirer = (id: number) =>
    start(async () => {
      await actionRetirerAVoir(id);
    });

  return (
    <div>
      <div className="avoir-ajout">
        <input
          className="search"
          value={titre}
          placeholder="Ajouter un film / une série à voir…"
          onChange={(e) => setTitre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ajouter();
          }}
        />
        <button onClick={ajouter} disabled={pending || !titre.trim()}>
          Ajouter
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted">Ta liste « à voir » est vide.</p>
      ) : (
        <ul className="avoir-liste">
          {items.map((a) => (
            <li key={a.id} className="avoir-item">
              <span>{a.titre}</span>
              <button
                className="avoir-x"
                onClick={() => retirer(a.id)}
                disabled={pending}
                aria-label={`Retirer ${a.titre}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
