// État de suivi dérivé (statut TMDB + progression). Module sans dépendance à
// node:sqlite pour être importable côté client (filtres « Mes séries »).

export type EtatSuivi = "pas_commencee" | "en_retard" | "a_jour" | "terminee";

export function etatSuivi(p: {
  nbVus: number;
  enRetard: number;
  statutTmdb: string | null;
}): EtatSuivi {
  if (p.nbVus === 0) return "pas_commencee";
  if (p.enRetard > 0) return "en_retard";
  return p.statutTmdb === "terminée" ? "terminee" : "a_jour";
}
