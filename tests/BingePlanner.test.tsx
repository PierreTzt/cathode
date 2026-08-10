// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BingePlanner } from "@/app/components/BingePlanner";

const texte = () => screen.getByRole("combobox").closest(".binge")!.textContent!;

describe("BingePlanner", () => {
  it("ne s'affiche pas quand il ne reste rien à voir", () => {
    const { container } = render(<BingePlanner restants={0} />);
    expect(container.innerHTML).toBe("");
  });

  it("arrondit au jour supérieur : 23 épisodes à 2 par soir tiennent en 12 jours", () => {
    render(<BingePlanner restants={23} />);
    expect(texte()).toContain("12 jours");
  });

  it("recalcule quand on change le rythme", async () => {
    render(<BingePlanner restants={23} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "5");
    expect(texte()).toContain("5 jours");
  });

  it("accorde les singuliers", () => {
    render(<BingePlanner restants={1} />);
    const t = texte();
    expect(t).toContain("1 restant ");
    expect(t).toContain("1 jour ");
    expect(t).not.toContain("restants");
  });

  it("annonce une date de fin cohérente avec le nombre de jours", () => {
    render(<BingePlanner restants={10} />);
    // 10 à 2/soir = 5 jours, le dernier soir étant J+4.
    const attendue = new Date();
    attendue.setDate(attendue.getDate() + 4);
    const jour = attendue.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    expect(texte()).toContain(jour);
  });
});
