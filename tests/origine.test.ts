import { describe, it, expect } from "vitest";
import { origineAutorisee } from "../src/lib/origine";

function req(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1:3000/cathode/api/restore", { method: "POST", headers });
}

describe("origineAutorisee", () => {
  it("accepte une requête du même site (derrière Caddy)", () => {
    expect(origineAutorisee(req({ origin: "https://vps.exemple.fr", host: "vps.exemple.fr" }))).toBe(true);
  });

  it("se fie à X-Forwarded-Host quand il est présent", () => {
    expect(
      origineAutorisee(
        req({ origin: "https://vps.exemple.fr", host: "127.0.0.1:3000", "x-forwarded-host": "vps.exemple.fr" }),
      ),
    ).toBe(true);
  });

  it("accepte le développement local avec port", () => {
    expect(origineAutorisee(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
  });

  it("refuse une requête venant d'un autre site", () => {
    expect(origineAutorisee(req({ origin: "https://malveillant.com", host: "vps.exemple.fr" }))).toBe(false);
  });

  it("refuse une Origin « null » ou illisible", () => {
    expect(origineAutorisee(req({ origin: "null", host: "vps.exemple.fr" }))).toBe(false);
  });

  it("laisse passer un client sans Origin (curl, script)", () => {
    expect(origineAutorisee(req({ host: "vps.exemple.fr" }))).toBe(true);
  });
});
