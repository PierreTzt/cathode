import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDb } from "@/lib/db";
import { appMetaGet } from "@/lib/queries";
import { etatVersion, versionLocale } from "@/lib/version";

const reponse = (sha: string, titre = "un changement") =>
  ({
    ok: true,
    json: async () => ({
      sha,
      commit: { message: `${titre}\n\ncorps ignoré`, committer: { date: "2026-08-10T20:00:00Z" } },
    }),
  }) as unknown as Response;

let db: ReturnType<typeof getDb>;

beforeEach(() => {
  db = getDb(":memory:");
  process.env.CATHODE_VERSION = "aaaaaaa";
});
afterEach(() => {
  delete process.env.CATHODE_VERSION;
  db.close();
});

describe("versionLocale", () => {
  it("préfère la version injectée au build", () => {
    expect(versionLocale()).toBe("aaaaaaa");
  });

  it("tronque une version longue à 7 caractères", () => {
    process.env.CATHODE_VERSION = "0123456789abcdef";
    expect(versionLocale()).toBe("0123456");
  });
});

describe("etatVersion", () => {
  it("signale une mise à jour quand les SHA diffèrent", async () => {
    const fetchImpl = vi.fn(async () => reponse("bbbbbbb", "corrige un bug"));
    const e = await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(e.locale).toBe("aaaaaaa");
    expect(e.distante).toBe("bbbbbbb");
    expect(e.majDisponible).toBe(true);
    expect(e.titre).toBe("corrige un bug");
  });

  it("ne signale rien quand la version locale est la dernière", async () => {
    const fetchImpl = vi.fn(async () => reponse("aaaaaaa"));
    const e = await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(e.majDisponible).toBe(false);
  });

  it("met en cache la réponse pour épargner le quota de l'API GitHub", async () => {
    const fetchImpl = vi.fn(async () => reponse("bbbbbbb"));
    await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(appMetaGet(db, "maj_dernier_commit")).toContain("bbbbbbb");
  });

  it("refait l'appel quand la vérification est forcée", async () => {
    const fetchImpl = vi.fn(async () => reponse("bbbbbbb"));
    await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    await etatVersion(db, { forcer: true, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("garde la dernière valeur connue si le réseau échoue", async () => {
    const ok = vi.fn(async () => reponse("bbbbbbb"));
    await etatVersion(db, { fetchImpl: ok as unknown as typeof fetch });
    const ko = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    const e = await etatVersion(db, { forcer: true, fetchImpl: ko as unknown as typeof fetch });
    expect(e.distante).toBe("bbbbbbb");
    expect(e.majDisponible).toBe(true);
  });

  it("désactive la comparaison si la version locale est indéterminable", async () => {
    delete process.env.CATHODE_VERSION;
    const fetchImpl = vi.fn(async () => reponse("bbbbbbb"));
    const e = await etatVersion(db, { fetchImpl: fetchImpl as unknown as typeof fetch });
    // En dépôt Git, versionLocale() renvoie le SHA courant ; hors dépôt, null.
    // Dans les deux cas, l'absence de comparaison ne doit jamais lever.
    if (e.locale === null) expect(e.majDisponible).toBe(false);
    expect(e.distante).toBe("bbbbbbb");
  });
});
