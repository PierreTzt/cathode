"use client";
import { useMemo, useState } from "react";
import type { LigneASuivre } from "@/lib/queries";
import { ProchainEpisode } from "./ProchainEpisode";

// Liste « À suivre » + filtre par plateforme (« que regarder ce soir »).
export function SuiviListe({ lignes }: { lignes: LigneASuivre[] }) {
  const [prov, setProv] = useState<string | null>(null);

  const plateformes = useMemo(() => {
    const set = new Set<string>();
    for (const l of lignes) for (const p of l.providers) set.add(p.nom);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [lignes]);

  const filtres = prov ? lignes.filter((l) => l.providers.some((p) => p.nom === prov)) : lignes;

  return (
    <>
      {plateformes.length > 1 && (
        <div className="prov-filtre" role="group" aria-label="Filtrer par plateforme">
          <button className={`prov-puce${!prov ? " actif" : ""}`} onClick={() => setProv(null)}>
            Toutes
          </button>
          {plateformes.map((p) => (
            <button
              key={p}
              className={`prov-puce${prov === p ? " actif" : ""}`}
              onClick={() => setProv((cur) => (cur === p ? null : p))}
            >
              {p}
            </button>
          ))}
        </div>
      )}
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
