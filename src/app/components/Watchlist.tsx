"use client";
import { useState, useTransition } from "react";
import type { AVoir } from "@/lib/queries";
import { imageUrl } from "@/lib/tmdb";
import { actionAjouterAVoir, actionRetirerAVoir, actionMarquerFilmVu } from "@/app/actions";

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
  const vu = (id: number) =>
    start(async () => {
      await actionMarquerFilmVu(id);
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
        <ul className="avoir-liste2">
          {items.map((a) => {
            const src = imageUrl(a.poster_path, "w185");
            return (
              <li key={a.id} className="avoir-item2">
                {src ? (
                  <img className="avoir-poster" src={src} alt={a.titre} loading="lazy" />
                ) : (
                  <div className="avoir-poster avoir-noimg" aria-hidden>
                    🎬
                  </div>
                )}
                <div className="avoir-info">
                  <div className="avoir-titre">
                    {a.titre}
                    {a.annee ? <span className="muted"> ({a.annee})</span> : ""}
                  </div>
                  <div className="avoir-boutons">
                    <button className="avoir-vu" onClick={() => vu(a.id)} disabled={pending}>
                      J&apos;ai vu
                    </button>
                    <button
                      className="avoir-x"
                      onClick={() => retirer(a.id)}
                      disabled={pending}
                      aria-label={`Retirer ${a.titre}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
