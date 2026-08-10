// Façade des requêtes : réexporte les modules par domaine.
// Les appelants importent depuis "@/lib/queries" sans connaître le découpage.

export { etatSuivi, type EtatSuivi } from "../etat";
export * from "./series";
export * from "./episodes";
export * from "./films";
export * from "./stats";
export * from "./journal";
export * from "./reglages";
export * from "./notifications";
export * from "./recherche";
