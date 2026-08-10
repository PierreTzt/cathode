// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeriesGrid } from "@/app/components/SeriesGrid";
import type { SerieListe } from "@/lib/queries";

// Jeu minimal couvrant chaque état calculé par etatSuivi + les statuts manuels.
function serie(over: Partial<SerieListe> & { id: number; nom: string }): SerieListe {
  return {
    source_id: null,
    suivi_le: null,
    actif: 1,
    archive: 0,
    tmdb_id: null,
    poster_path: null,
    nb_episodes: 0,
    diffuses: 0,
    en_retard: 0,
    statut_tmdb: null,
    dernier_vu: null,
    favori: 0,
    suivi_statut: "actif",
    ...over,
  } as SerieListe;
}

const SERIES: SerieListe[] = [
  serie({ id: 1, nom: "Alpha", nb_episodes: 40, en_retard: 5, dernier_vu: "2026-08-01" }),
  serie({ id: 2, nom: "Beta", nb_episodes: 10, en_retard: 0, dernier_vu: "2026-08-05" }),
  serie({ id: 3, nom: "Gamma", nb_episodes: 0, en_retard: 3 }),
  serie({ id: 4, nom: "Delta", nb_episodes: 5, en_retard: 0, favori: 1, dernier_vu: "2026-07-01" }),
  serie({ id: 5, nom: "Epsilon", nb_episodes: 7, en_retard: 2, suivi_statut: "pause" }),
  serie({ id: 6, nom: "Zeta", nb_episodes: 3, en_retard: 1, suivi_statut: "abandonne" }),
];

const titres = () =>
  screen.getAllByRole("link").map((a) => a.textContent?.split("·")[0]?.trim());

describe("SeriesGrid", () => {
  it("affiche toutes les séries par défaut, triées par épisodes vus", () => {
    render(<SeriesGrid series={SERIES} />);
    expect(screen.getByRole("tab", { name: /Toutes/ }).getAttribute("aria-selected")).toBe("true");
    // Tri « le plus vu » : 40, 10, 7, 5, 3, 0.
    expect(titres()[0]).toContain("Alpha");
    expect(titres()).toHaveLength(6);
  });

  it("compte les séries par filtre, statuts manuels compris", () => {
    render(<SeriesGrid series={SERIES} />);
    // Le compte est affiché dans la puce, à côté du libellé.
    expect(screen.getByRole("tab", { name: /Favoris/ }).textContent).toMatch(/1$/);
    expect(screen.getByRole("tab", { name: /En pause/ }).textContent).toMatch(/1$/);
    expect(screen.getByRole("tab", { name: /Abandonnées/ }).textContent).toMatch(/1$/);
    expect(screen.getByRole("tab", { name: /Pas commencée/ }).textContent).toMatch(/1$/);
  });

  it("filtre sur les favoris quand on clique la puce", async () => {
    render(<SeriesGrid series={SERIES} />);
    await userEvent.click(screen.getByRole("tab", { name: /Favoris/ }));
    expect(titres()).toHaveLength(1);
    expect(titres()[0]).toContain("Delta");
  });

  it("désactive une puce dont le compte est nul", () => {
    render(<SeriesGrid series={[serie({ id: 1, nom: "Seule", nb_episodes: 4 })]} />);
    expect(screen.getByRole("tab", { name: /Favoris/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("tab", { name: /Toutes/ })).toHaveProperty("disabled", false);
  });

  it("recherche sans tenir compte de la casse", async () => {
    render(<SeriesGrid series={SERIES} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher une série/), "GAMM");
    expect(titres()).toHaveLength(1);
    expect(titres()[0]).toContain("Gamma");
  });

  it("montre un message plutôt qu'une grille vide", async () => {
    render(<SeriesGrid series={SERIES} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher une série/), "introuvable");
    expect(screen.getByText("Aucune série pour ce filtre.")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("trie de A à Z avec les accents français", async () => {
    render(<SeriesGrid series={SERIES} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "az");
    expect(titres()[0]).toContain("Alpha");
    expect(titres()[1]).toContain("Beta");
  });

  it("combine recherche et filtre", async () => {
    render(<SeriesGrid series={SERIES} />);
    await userEvent.click(screen.getByRole("tab", { name: /En retard/ }));
    await userEvent.type(screen.getByPlaceholderText(/Rechercher une série/), "alpha");
    expect(titres()).toHaveLength(1);
    expect(titres()[0]).toContain("Alpha");
  });
});
