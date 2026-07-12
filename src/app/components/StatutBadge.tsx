import type { EtatSuivi } from "@/lib/etat";

const LABELS: Record<EtatSuivi, string> = {
  pas_commencee: "Pas commencée",
  en_retard: "En retard",
  a_jour: "À jour",
  terminee: "Terminée",
};

// Pastille d'état de suivi (dérivé statut TMDB + progression).
export function StatutBadge({
  etat,
  enRetard = 0,
}: {
  etat: EtatSuivi;
  enRetard?: number;
}) {
  const label =
    etat === "en_retard" && enRetard > 0 ? `En retard · ${enRetard}` : LABELS[etat];
  return <span className={`statut-badge statut-${etat}`}>{label}</span>;
}
