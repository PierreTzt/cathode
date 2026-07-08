import { describe, it, expect } from "vitest";
import { imageUrl, findByTvdbId } from "../src/lib/tmdb";

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
