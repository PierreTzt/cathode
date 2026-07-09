import { describe, it, expect } from "vitest";
import { imageUrl, findByTvdbId, fetchSeriesEpisodes } from "../src/lib/tmdb";

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
            episodes: [{ episode_number: 1, name: "Special", air_date: "2003-01-01", runtime: 20 }],
          }),
        } as any;
      }
      if (/\/tv\/42\/season\/1/.test(url)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            episodes: [
              { episode_number: 1, name: "Pilot", air_date: "2003-09-23", runtime: 45 },
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
      { saison: 0, episode: 1, titre: "Special", date_diffusion: "2003-01-01", duree_min: 20 },
      { saison: 1, episode: 1, titre: "Pilot", date_diffusion: "2003-09-23", duree_min: 45 },
      { saison: 1, episode: 2, titre: "Hung Out to Dry", date_diffusion: null, duree_min: 0 },
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
