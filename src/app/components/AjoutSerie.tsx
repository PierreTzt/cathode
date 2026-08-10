"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionRechercheSeries,
  actionAjouterSerie,
  type ResultatRecherche,
} from "@/app/actions";
import { imageUrl } from "@/lib/tmdb";

type Etat = "idle" | "en cours" | "ajoutee" | "existait";

// `tmdbActif` vient du serveur : sans clé TMDB, la recherche ne renverra jamais
// rien. On le dit plutôt que d'afficher « aucun résultat », qui laisserait
// croire que la série n'existe pas.
export function AjoutSerie({ tmdbActif = true }: { tmdbActif?: boolean }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [etats, setEtats] = useState<Record<number, Etat>>({});
  const [chercheEnCours, startRecherche] = useTransition();
  const [, startAjout] = useTransition();
  const router = useRouter();

  const chercher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    startRecherche(async () => {
      setResultats(await actionRechercheSeries(q));
    });
  };

  const ajouter = (s: ResultatRecherche) => {
    setEtats((m) => ({ ...m, [s.tmdbId]: "en cours" }));
    startAjout(async () => {
      const res = await actionAjouterSerie(s);
      setEtats((m) => ({ ...m, [s.tmdbId]: res.existait ? "existait" : "ajoutee" }));
      router.refresh(); // rafraîchit la grille + « À suivre »
    });
  };

  const libelle = (etat: Etat | undefined) => {
    if (etat === "en cours") return "Ajout…";
    if (etat === "ajoutee") return "✓ Ajoutée";
    if (etat === "existait") return "Déjà suivie";
    return "＋ Ajouter";
  };

  return (
    <div className="ajout-panel">
      <p className="ajout-titre">Ajouter une série</p>

      {!tmdbActif && (
        <p className="ajout-vide">
          Recherche indisponible : aucune clé TMDB configurée. Ajoute{" "}
          <code>TMDB_READ_TOKEN</code> dans <code>.env.local</code>, puis relance l&apos;appli.
        </p>
      )}

      <form className="ajout-form" onSubmit={chercher}>
        <input
          className="search"
          type="search"
          placeholder="Chercher une série sur TMDB…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!tmdbActif}
        />
        <button type="submit" disabled={!tmdbActif || chercheEnCours || !q.trim()}>
          {chercheEnCours ? "…" : "Chercher"}
        </button>
      </form>

      {resultats !== null &&
        (resultats.length === 0 ? (
          <p className="ajout-vide">Aucun résultat pour « {q} ».</p>
        ) : (
          <div className="ajout-resultats">
            {resultats.map((s) => {
              const etat = etats[s.tmdbId];
              const poster = imageUrl(s.poster_path, "w185");
              return (
                <div key={s.tmdbId} className={`ajout-res${etat === "ajoutee" ? " ok" : ""}`}>
                  {poster ? (
                    <img src={poster} alt="" loading="lazy" />
                  ) : (
                    <span className="noimg" aria-hidden />
                  )}
                  <div className="ajout-res-info">
                    <div className="ajout-res-nom">{s.nom}</div>
                    {s.annee && <div className="ajout-res-annee">{s.annee}</div>}
                  </div>
                  <button
                    onClick={() => ajouter(s)}
                    disabled={etat === "en cours" || etat === "ajoutee" || etat === "existait"}
                  >
                    {libelle(etat)}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
