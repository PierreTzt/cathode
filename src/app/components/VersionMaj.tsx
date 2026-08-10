"use client";
import { useState, useTransition } from "react";
import { actionVerifierMaj } from "@/app/actions";
import type { EtatVersion } from "@/lib/version";

const COMMANDE = "git pull && docker compose up -d --build";

// Volontairement informatif : l'appli signale la mise à jour, elle ne
// l'applique pas. Cathode n'ayant pas d'authentification propre, un bouton
// déclenchant un déploiement depuis une page web ouvrirait une exécution de
// code à distance sur le serveur.
export function VersionMaj({ initial }: { initial: EtatVersion }) {
  const [etat, setEtat] = useState(initial);
  const [enCours, start] = useTransition();
  const [copie, setCopie] = useState(false);

  const verifier = () =>
    start(async () => {
      setEtat(await actionVerifierMaj());
    });

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDE);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Version installée :{" "}
        <code>{etat.locale ?? "inconnue"}</code>
        {etat.distante && (
          <>
            {" "}· dernière publiée : <code>{etat.distante}</code>
          </>
        )}
      </p>

      {etat.majDisponible && (
        <div className="alerte">
          <p>
            <strong>Une nouvelle version est disponible.</strong>
            {etat.titre && <> Dernier changement : {etat.titre}</>}
          </p>
          <p className="muted">
            Pour l&apos;appliquer, dans le dossier du projet :
          </p>
          <p>
            <code>{COMMANDE}</code>{" "}
            <button type="button" className="notifs-btn secondaire" onClick={copier}>
              {copie ? "Copié" : "Copier"}
            </button>
          </p>
        </div>
      )}

      {!etat.majDisponible && etat.locale && etat.distante && (
        <p className="muted">Tu es à jour.</p>
      )}

      {!etat.locale && (
        <p className="muted">
          Version installée indéterminable : la comparaison est désactivée. En Docker, passe{" "}
          <code>CATHODE_VERSION</code> au build (voir <code>docker-compose.yml</code>).
        </p>
      )}

      <button
        type="button"
        className="notifs-btn secondaire"
        onClick={verifier}
        disabled={enCours}
      >
        {enCours ? "Vérification…" : "Vérifier maintenant"}
      </button>
    </div>
  );
}
