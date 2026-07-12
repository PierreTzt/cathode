import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import {
  reglages,
  appMetaSet,
  upsertVuJellyfin,
  episodesDeSerie,
} from "../src/lib/queries";
import { testerConnexion, fetchJellyfinVus } from "../src/lib/jellyfin";
import { syncJellyfin } from "../src/import/jellyfin";

const cfg = { url: "https://jf.test/", token: "tok", userId: "u1" };

describe("réglages app_meta", () => {
  it("lit les valeurs par défaut puis les écrit", () => {
    const db = getDb(":memory:");
    const r0 = reglages(db);
    expect(r0.avenirVue).toBe("calendrier");
    expect(r0.jellyfin.auto).toBe(false);
    appMetaSet(db, "avenir_vue_defaut", "liste");
    appMetaSet(db, "jellyfin_url", "https://x");
    appMetaSet(db, "jellyfin_auto", "1");
    const r1 = reglages(db);
    expect(r1.avenirVue).toBe("liste");
    expect(r1.jellyfin.url).toBe("https://x");
    expect(r1.jellyfin.auto).toBe(true);
  });
});

describe("upsertVuJellyfin", () => {
  it("ajoute, n'écrase pas un vu_le manuel, remonte le rewatch", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom) VALUES (1,'A');");
    // ajout
    expect(upsertVuJellyfin(db, 1, 1, 1, "2024-01-01", 0)).toBe(true);
    // déjà vu → pas un ajout, vu_le conservé, rewatch remonté
    db.prepare("UPDATE episodes_vus SET vu_le='2020-05-05' WHERE serie_id=1 AND saison=1 AND episode=1").run();
    expect(upsertVuJellyfin(db, 1, 1, 1, "2024-01-01", 2)).toBe(false);
    const row = db
      .prepare("SELECT vu_le, rewatch_count FROM episodes_vus WHERE serie_id=1 AND saison=1 AND episode=1")
      .get() as any;
    expect(row.vu_le).toBe("2020-05-05"); // vu_le manuel conservé
    expect(row.rewatch_count).toBe(2);
  });
});

describe("testerConnexion", () => {
  it("ok si System/Info répond", async () => {
    const f = (async () => ({ ok: true, status: 200, json: async () => ({ ServerName: "Maison" }) })) as any;
    expect(await testerConnexion(cfg, f)).toEqual({ ok: true, nom: "Maison" });
  });
  it("ko sur erreur HTTP ou config manquante", async () => {
    const f = (async () => ({ ok: false, status: 401, json: async () => ({}) })) as any;
    expect((await testerConnexion(cfg, f)).ok).toBe(false);
    expect((await testerConnexion({ url: "", token: "", userId: "" }, f)).ok).toBe(false);
  });
});

describe("fetchJellyfinVus", () => {
  it("mappe les épisodes joués valides", async () => {
    const f = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        Items: [
          { SeriesId: "s1", ParentIndexNumber: 1, IndexNumber: 2, UserData: { LastPlayedDate: "2024-03-01T10:00:00Z", PlayCount: 3 } },
          { SeriesId: "s1", ParentIndexNumber: null, IndexNumber: 5, UserData: {} }, // saison invalide → filtré
        ],
      }),
    })) as any;
    const r = (await fetchJellyfinVus(cfg, f))!;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ seriesId: "s1", saison: 1, episode: 2, playCount: 3 });
  });
});

describe("syncJellyfin", () => {
  it("apparie par tmdb puis tvdb, dédup, compte non appariés", async () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom,tmdb_id,source_id) VALUES (1,'A',1399,'121361'),(2,'B',NULL,'999');"
    );
    const getVus = async () => [
      { seriesId: "jf-a", saison: 1, episode: 1, lastPlayed: "2024-01-01T00:00:00Z", playCount: 1 },
      { seriesId: "jf-a", saison: 1, episode: 1, lastPlayed: "2024-01-01T00:00:00Z", playCount: 1 }, // doublon
      { seriesId: "jf-b", saison: 2, episode: 3, lastPlayed: "2024-02-02T00:00:00Z", playCount: 1 },
      { seriesId: "jf-x", saison: 1, episode: 1, lastPlayed: null, playCount: 1 }, // inconnu
    ];
    const getProviderIds = async (_c: any, id: string) => {
      if (id === "jf-a") return { tmdb: 1399, tvdb: null }; // → série 1 par tmdb
      if (id === "jf-b") return { tmdb: null, tvdb: "999" }; // → série 2 par tvdb
      return { tmdb: 42, tvdb: "0" }; // aucun match
    };
    const r = await syncJellyfin(db, cfg, { getVus, getProviderIds });
    expect(r.ajoutes).toBe(2); // A S1E1 + B S2E3 (le doublon ne ré-ajoute pas)
    expect(r.nonAppariees).toBe(1); // jf-x
    expect(r.appariees).toBe(3); // 2×A + 1×B
    expect(episodesDeSerie(db, 1).some((e) => e.saison === 1 && e.episode === 1)).toBe(true);
    expect(episodesDeSerie(db, 2).some((e) => e.saison === 2 && e.episode === 3)).toBe(true);
  });
});
