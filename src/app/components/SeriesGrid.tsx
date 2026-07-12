"use client";
import { useMemo, useState } from "react";
import { PosterTile } from "./PosterTile";
import type { SerieListe } from "@/lib/queries";
import { etatSuivi, type EtatSuivi } from "@/lib/etat";

type Filtre = "toutes" | EtatSuivi | "favoris";
type Tri = "az" | "temps" | "dernier";

const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: "toutes", label: "Toutes" },
  { cle: "en_retard", label: "En retard" },
  { cle: "a_jour", label: "À jour" },
  { cle: "pas_commencee", label: "Pas commencée" },
  { cle: "terminee", label: "Terminées" },
  { cle: "favoris", label: "Favoris" },
];

function etatDe(s: SerieListe): EtatSuivi {
  return etatSuivi({ nbVus: s.nb_episodes, enRetard: s.en_retard, statutTmdb: s.statut_tmdb });
}

export function SeriesGrid({ series }: { series: SerieListe[] }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [tri, setTri] = useState<Tri>("temps");

  // Comptes par filtre (pour afficher le nombre sur chaque puce).
  const comptes = useMemo(() => {
    const c: Record<Filtre, number> = {
      toutes: series.length,
      en_retard: 0,
      a_jour: 0,
      pas_commencee: 0,
      terminee: 0,
      favoris: 0,
    };
    for (const s of series) {
      c[etatDe(s)]++;
      if (s.favori === 1) c.favoris++;
    }
    return c;
  }, [series]);

  const affichees = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = series.filter((s) => {
      if (needle && !s.nom.toLowerCase().includes(needle)) return false;
      if (filtre === "toutes") return true;
      if (filtre === "favoris") return s.favori === 1;
      return etatDe(s) === filtre;
    });
    out = [...out].sort((a, b) => {
      if (tri === "az") return a.nom.localeCompare(b.nom, "fr");
      if (tri === "dernier") return (b.dernier_vu ?? "").localeCompare(a.dernier_vu ?? "");
      return b.nb_episodes - a.nb_episodes || a.nom.localeCompare(b.nom, "fr");
    });
    return out;
  }, [series, q, filtre, tri]);

  return (
    <>
      <div className="series-barre">
        <input
          className="search"
          type="search"
          placeholder="Rechercher une série…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="series-tri">
          <span className="muted">Trier</span>
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="temps">Le plus vu</option>
            <option value="az">A → Z</option>
            <option value="dernier">Dernier vu</option>
          </select>
        </label>
      </div>

      <div className="filtre-puces" role="tablist" aria-label="Filtrer par état">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            role="tab"
            aria-selected={filtre === f.cle}
            className={`filtre-puce${filtre === f.cle ? " actif" : ""}`}
            onClick={() => setFiltre(f.cle)}
            disabled={f.cle !== "toutes" && comptes[f.cle] === 0}
          >
            {f.label} <span className="filtre-nb">{comptes[f.cle]}</span>
          </button>
        ))}
      </div>

      {affichees.length === 0 ? (
        <p className="muted">Aucune série pour ce filtre.</p>
      ) : (
        <div className="poster-grid">
          {affichees.map((s) => (
            <PosterTile
              key={s.id}
              id={s.id}
              nom={s.nom}
              poster_path={s.poster_path}
              nb_episodes={s.nb_episodes}
              diffuses={s.diffuses}
              favori={s.favori}
              etat={etatDe(s)}
              enRetard={s.en_retard}
            />
          ))}
        </div>
      )}
    </>
  );
}
