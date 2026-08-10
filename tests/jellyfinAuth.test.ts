import { describe, it, expect, vi } from "vitest";
import { testerConnexion, fetchJellyfinVus, fetchSerieProviderIds } from "@/lib/jellyfin";

const cfg = { url: "http://192.168.1.10:8096/", token: "abc123", userId: "u1" };

const ok = (corps: unknown) =>
  ({ ok: true, status: 200, json: async () => corps }) as unknown as Response;
const ko = (status: number) => ({ ok: false, status }) as unknown as Response;

/** En-tête Authorization envoyé lors du dernier appel. */
type MockFetch = { mock: { calls: Array<[string, RequestInit | undefined]> } };

function entetes(f: MockFetch, n = -1): Record<string, string> {
  const init = f.mock.calls.at(n)?.[1];
  return (init?.headers ?? {}) as Record<string, string>;
}

function entete(f: MockFetch): string {
  return entetes(f).Authorization ?? "";
}

describe("authentification Jellyfin", () => {
  it("utilise le schéma MediaBrowser, pas l'en-tête X-Emby-Token déprécié", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ ServerName: "Maison" }));
    await testerConnexion(cfg, f as unknown as typeof fetch);

    const headers = entetes(f as unknown as MockFetch, 0);
    expect(headers).not.toHaveProperty("X-Emby-Token");
    expect(headers.Authorization).toContain('MediaBrowser Token="abc123"');
  });

  it("envoie aussi les métadonnées de client attendues", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ ServerName: "Maison" }));
    await testerConnexion(cfg, f as unknown as typeof fetch);
    const h = entete(f as unknown as MockFetch);
    expect(h).toContain('Client="Cathode"');
    expect(h).toContain('DeviceId="cathode"');
  });

  it("authentifie de la même façon la liste des épisodes vus", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ Items: [] }));
    await fetchJellyfinVus(cfg, f as unknown as typeof fetch);
    expect(entete(f as unknown as MockFetch)).toContain('MediaBrowser Token="abc123"');
  });

  it("authentifie de la même façon la lecture des ProviderIds", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ ProviderIds: { Tmdb: "42" } }));
    await fetchSerieProviderIds(cfg, "s1", f as unknown as typeof fetch);
    expect(entete(f as unknown as MockFetch)).toContain('MediaBrowser Token="abc123"');
  });

  it("retire le slash final de l'URL", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ ServerName: "Maison" }));
    await testerConnexion(cfg, f as unknown as typeof fetch);
    expect(f.mock.calls[0][0]).toBe("http://192.168.1.10:8096/System/Info");
  });

  it("nomme la cause d'un 401 plutôt que d'afficher un code nu", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ko(401));
    const r = await testerConnexion(cfg, f as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.erreur).toMatch(/clé API refusée/);
  });

  it("distingue une URL incorrecte d'une clé refusée", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ko(404));
    const r = await testerConnexion(cfg, f as unknown as typeof fetch);
    expect(r.erreur).toMatch(/URL du serveur incorrecte/);
  });
});
