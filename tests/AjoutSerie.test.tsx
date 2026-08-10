// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Les actions serveur tirent node:sqlite : on les neutralise, seul le rendu
// nous intéresse ici.
vi.mock("@/app/actions", () => ({
  actionRechercheSeries: vi.fn(async () => []),
  actionAjouterSerie: vi.fn(async () => ({ id: 1, existait: false })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AjoutSerie } from "@/app/components/AjoutSerie";

describe("AjoutSerie", () => {
  it("laisse chercher quand une clé TMDB est configurée", () => {
    render(<AjoutSerie tmdbActif />);
    expect(screen.getByPlaceholderText(/Chercher une série/)).toHaveProperty("disabled", false);
    expect(screen.queryByText(/aucune clé TMDB/i)).toBeNull();
  });

  it("explique l'absence de clé plutôt que de laisser croire à un échec de recherche", () => {
    render(<AjoutSerie tmdbActif={false} />);
    expect(screen.getByText(/aucune clé TMDB configurée/i)).toBeTruthy();
    expect(screen.getByText(/TMDB_READ_TOKEN/)).toBeTruthy();
  });

  it("désactive le champ et le bouton sans clé, pour ne pas mener à un cul-de-sac", () => {
    render(<AjoutSerie tmdbActif={false} />);
    expect(screen.getByPlaceholderText(/Chercher une série/)).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /Chercher/ })).toHaveProperty("disabled", true);
  });
});
