import { describe, it, expect } from "vitest";
import {
  imageUrl,
  findByTvdbId,
  fetchSeriesEpisodes,
  fetchProviders,
  fetchRecommandations,
  fetchCast,
} from "../src/lib/tmdb";

describe("imageUrl", () => {
  it("construit l'URL ou renvoie null", () => {
    expect(imageUrl("/abc.jpg", "w342")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(imageUrl(null, "w342")).toBeNull();
    expect(imageUrl("", "w185")).toBeNull();
  });
});

describe("findByTvdbId", () => {
  const okFetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        tv_results: [{ id: 72108, poster_path: "/p.jpg", backdrop_path: "/b.jpg", name: "NCIS" }],
      }),
    }) as any;

  it("retourne l'id TMDB et les chemins d'images", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const r = await findByTvdbId("72108", okFetch as any);
    expect(r).toEqual({ tmdbId: 72108, posterPath: "/p.jpg", backdropPath: "/b.jpg" });
  });

  it("retourne null quand aucun résultat", async () => {
    const empty = async () => ({ ok: true, status: 200, json: async () => ({ tv_results: [] }) }) as any;
    expect(await findByTvdbId("999", empty as any)).toBeNull();
  });

  it("retourne null sur erreur réseau", async () => {
    const boom = async () => {
      throw new Error("network down");
    };
    expect(await findByTvdbId("72108", boom as any)).toBeNull();
  });
});

describe("fetchSeriesEpisodes", () => {
  function fakeFetch(): typeof fetch {
    return (async (url: string) => {
      if (/\/tv\/42$/.test(url) || /\/tv\/42\?/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "Ended",
            seasons: [{ season_number: 0 }, { season_number: 1 }],
          }),
        } as any;
      }
      if (/\/tv\/42\/season\/0/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            episodes: [
              { episode_number: 1, name: "Special", overview: "Un hors-série.", still_path: "/s0e1.jpg", air_date: "2003-01-01", runtime: 20 },
            ],
          }),
        } as any;
      }
      if (/\/tv\/42\/season\/1/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            episodes: [
              { episode_number: 1, name: "Pilot", still_path: "/s1e1.jpg", air_date: "2003-09-23", runtime: 45 },
              { episode_number: 2, name: "Hung Out to Dry", air_date: "", runtime: 0 },
            ],
          }),
        } as any;
      }
      throw new Error("url inattendue " + url);
    }) as any;
  }

  it("agrège saisons/épisodes, mappe statut, minutes et air_date vide→null", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const r = await fetchSeriesEpisodes(42, fakeFetch());
    expect(r!.statut).toBe("terminée");
    expect(r!.episodes).toEqual([
      { saison: 0, episode: 1, titre: "Special", apercu: "Un hors-série.", still_path: "/s0e1.jpg", date_diffusion: "2003-01-01", duree_min: 20 },
      { saison: 1, episode: 1, titre: "Pilot", apercu: null, still_path: "/s1e1.jpg", date_diffusion: "2003-09-23", duree_min: 45 },
      { saison: 1, episode: 2, titre: "Hung Out to Dry", apercu: null, still_path: null, date_diffusion: null, duree_min: 0 },
    ]);
  });

  it("retourne null sur erreur réseau", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const boom = (async () => {
      throw new Error("down");
    }) as any;
    expect(await fetchSeriesEpisodes(42, boom)).toBeNull();
  });
});

describe("fetchProviders", () => {
  it("extrait les plateformes par abonnement FR", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: {
          FR: {
            flatrate: [
              { provider_name: "Netflix", logo_path: "/nf.jpg" },
              { provider_name: "Disney Plus", logo_path: "/dp.jpg" },
            ],
          },
          US: { flatrate: [{ provider_name: "Hulu", logo_path: "/h.jpg" }] },
        },
      }),
    })) as any;
    expect(await fetchProviders(42, fetchImpl)).toEqual([
      { nom: "Netflix", logo_path: "/nf.jpg" },
      { nom: "Disney Plus", logo_path: "/dp.jpg" },
    ]);
  });

  it("retourne [] si pas d'offre FR, null sur erreur", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const vide = (async () => ({ ok: true, status: 200, json: async () => ({ results: {} }) })) as any;
    expect(await fetchProviders(42, vide)).toEqual([]);
    const boom = (async () => {
      throw new Error("down");
    }) as any;
    expect(await fetchProviders(42, boom)).toBeNull();
  });
});

describe("fetchRecommandations", () => {
  it("mappe les séries recommandées", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: 7, name: "The Wire", first_air_date: "2002-06-02", poster_path: "/w.jpg", backdrop_path: "/wb.jpg" },
          { id: 8, original_name: "Fringe" },
        ],
      }),
    })) as any;
    const r = await fetchRecommandations(42, fetchImpl);
    expect(r[0]).toEqual({ tmdbId: 7, nom: "The Wire", annee: "2002", poster_path: "/w.jpg", backdrop_path: "/wb.jpg" });
    expect(r[1]).toMatchObject({ tmdbId: 8, nom: "Fringe", annee: null });
  });

  it("retourne [] sur erreur réseau", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const boom = (async () => {
      throw new Error("down");
    }) as any;
    expect(await fetchRecommandations(42, boom)).toEqual([]);
  });
});

describe("fetchCast", () => {
  it("garde le top 10 avec premier rôle", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const cast = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      name: `Acteur ${i + 1}`,
      profile_path: i === 0 ? "/a.jpg" : null,
      roles: [{ character: `Rôle ${i + 1}` }],
    }));
    const fetchImpl = (async () => ({ ok: true, status: 200, json: async () => ({ cast }) })) as any;
    const r = (await fetchCast(42, fetchImpl))!;
    expect(r.length).toBe(10);
    expect(r[0]).toEqual({ tmdbId: 1, nom: "Acteur 1", personnage: "Rôle 1", profile_path: "/a.jpg" });
  });

  it("retourne null sur erreur", async () => {
    process.env.TMDB_READ_TOKEN = "test-token";
    const boom = (async () => {
      throw new Error("down");
    }) as any;
    expect(await fetchCast(42, boom)).toBeNull();
  });
});
