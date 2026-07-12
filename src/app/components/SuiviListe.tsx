"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LigneASuivre } from "@/lib/queries";
import { ProchainEpisode } from "./ProchainEpisode";

// Liste « À suivre » + filtre par plateforme (« que regarder ce soir »).
export function SuiviListe({ lignes }: { lignes: LigneASuivre[] }) {
  const router = useRouter();
  const [prov, setProv] = useState<string | null>(null);

  const plateformes = useMemo(() => {
    const set = new Set<string>();
    for (const l of lignes) for (const p of l.providers) set.add(p.nom);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [lignes]);

  const filtres = prov ? lignes.filter((l) => l.providers.some((p) => p.nom === prov)) : lignes;

  const auHasard = () => {
    if (filtres.length === 0) return;
    const i = Math.floor(Math.random() * filtres.length);
    router.push(`/series/${filtres[i].serie_id}`);
  };

  return (
    <>
      <div className="suivi-barre">
        {plateformes.length > 1 && (
          <label className="prov-filtre">
            <span className="muted">Où regarder</span>
            <select
              className="prov-select"
              value={prov ?? ""}
              onChange={(e) => setProv(e.target.value || null)}
              aria-label="Filtrer par plateforme"
            >
              <option value="">Toutes les plateformes</option>
              {plateformes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="hasard-btn" onClick={auHasard} disabled={filtres.length === 0} title="Choisir au hasard">
          🎲 Au hasard
        </button>
      </div>
      {filtres.length === 0 ? (
        <p className="muted">Rien à regarder sur {prov} pour l&apos;instant.</p>
      ) : (
        <div className="suivi-liste">
          {filtres.map((l) => (
            <ProchainEpisode key={l.serie_id} ligne={l} />
          ))}
        </div>
      )}
    </>
  );
}
