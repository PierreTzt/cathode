import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";
import {
  definirStatutSuivi,
  majCast,
  seriesAvecActeur,
  tableauASuivre,
  nouveautes,
  aVenir,
  activiteParJour,
  rechercheLocale,
  ajouterPushSub,
  listePushSubs,
  supprimerPushSub,
  compterPushSubs,
  episodesANotifier,
  marquerNotifie,
} from "../src/lib/queries";

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

function seedRetard() {
  const db = getDb(":memory:");
  db.exec(
    "INSERT INTO series (id,nom) VALUES (1,'NCIS'),(2,'Lost');" +
      "INSERT INTO episodes_catalogue (serie_id,saison,episode,date_diffusion,duree_min) VALUES " +
      "(1,1,1,'2003-01-01',45),(1,1,2,'2003-01-08',45)," +
      "(2,1,1,'2004-01-01',42),(2,1,2,'2004-01-08',42);" +
      "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES " +
      "(1,1,1,'x','2020-01-01',45),(2,1,1,'y','2020-01-01',42);"
  );
  return db;
}

describe("statut manuel", () => {
  it("exclut pause/abandonne de À suivre et des nouveautés", () => {
    const db = seedRetard();
    expect(tableauASuivre(db).map((r) => r.nom).sort()).toEqual(["Lost", "NCIS"]);
    expect(nouveautes(db).seriesEnRetard).toBe(2);
    definirStatutSuivi(db, 2, "abandonne");
    expect(tableauASuivre(db).map((r) => r.nom)).toEqual(["NCIS"]);
    expect(nouveautes(db).seriesEnRetard).toBe(1);
    definirStatutSuivi(db, 1, "pause");
    expect(tableauASuivre(db)).toHaveLength(0);
  });

  it("exclut aussi de À venir", () => {
    const db = getDb(":memory:");
    const bientot = isoJour(new Date(Date.now() + 3 * 86400000));
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'NCIS');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,date_diffusion) VALUES (1,1,9,'" + bientot + "');" +
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x',45);"
    );
    expect(aVenir(db, 30)).toHaveLength(1);
    definirStatutSuivi(db, 1, "pause");
    expect(aVenir(db, 30)).toHaveLength(0);
  });
});

describe("casting / acteur", () => {
  it("retrouve les séries d'un acteur", () => {
    const db = getDb(":memory:");
    db.exec("INSERT INTO series (id,nom) VALUES (1,'A'),(2,'B'),(3,'C');");
    majCast(db, 1, [{ tmdbId: 50, nom: "Pedro", personnage: "Joel", profile_path: null }]);
    majCast(db, 2, [{ tmdbId: 50, nom: "Pedro", personnage: "Din", profile_path: null }]);
    majCast(db, 3, [{ tmdbId: 99, nom: "Autre", personnage: "X", profile_path: null }]);
    const r = seriesAvecActeur(db, 50);
    expect(r.acteur).toBe("Pedro");
    expect(r.series.map((s) => s.nom)).toEqual(["A", "B"]);
    expect(r.series[0].personnage).toBe("Joel");
  });
});

describe("activiteParJour", () => {
  it("agrège les vus par jour dans la fenêtre", () => {
    const db = getDb(":memory:");
    const hier = isoJour(new Date(Date.now() - 86400000));
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'A');" +
        `INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,vu_le,duree_min) VALUES ` +
        `(1,1,1,'a','${hier}',45),(1,1,2,'b','${hier}',45),(1,1,3,'c','2000-01-01',45);`
    );
    const act = activiteParJour(db, 371);
    expect(act.find((a) => a.jour === hier)?.nb).toBe(2);
    expect(act.find((a) => a.jour === "2000-01-01")).toBeUndefined(); // hors fenêtre
  });
});

describe("rechercheLocale", () => {
  it("cherche séries et titres d'épisodes", () => {
    const db = getDb(":memory:");
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'Breaking Bad'),(2,'Better Call Saul');" +
        "INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion) VALUES " +
        "(1,1,1,'Pilot','2008-01-20'),(2,1,1,'Uno','2015-02-08');"
    );
    const r = rechercheLocale(db, "bre");
    expect(r.series.map((s) => s.nom)).toEqual(["Breaking Bad"]);
    expect(rechercheLocale(db, "call").series.map((s) => s.nom)).toEqual(["Better Call Saul"]);
    const p = rechercheLocale(db, "pilot");
    expect(p.episodes[0]).toMatchObject({ nom: "Breaking Bad", titre: "Pilot" });
  });
});

describe("push subscriptions", () => {
  it("upsert idempotent + suppression", () => {
    const db = getDb(":memory:");
    ajouterPushSub(db, { endpoint: "e1", p256dh: "k1", auth: "a1" });
    ajouterPushSub(db, { endpoint: "e1", p256dh: "k2", auth: "a2" }); // upsert
    ajouterPushSub(db, { endpoint: "e2", p256dh: "k", auth: "a" });
    expect(compterPushSubs(db)).toBe(2);
    expect(listePushSubs(db).find((s) => s.endpoint === "e1")!.p256dh).toBe("k2");
    supprimerPushSub(db, "e1");
    expect(compterPushSubs(db)).toBe(1);
  });
});

describe("episodesANotifier", () => {
  it("remonte les diffusés récents non notifiés des séries actives suivies", () => {
    const db = getDb(":memory:");
    const recent = isoJour(new Date(Date.now() - 2 * 86400000));
    const vieux = isoJour(new Date(Date.now() - 40 * 86400000));
    db.exec(
      "INSERT INTO series (id,nom) VALUES (1,'A'),(2,'B');" +
        `INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion) VALUES ` +
        `(1,1,5,'Récent','${recent}'),(1,1,4,'Vieux','${vieux}'),(2,1,1,'Autre','${recent}');` +
        // A est suivie (≥1 vu), B ne l'est pas
        "INSERT INTO episodes_vus (serie_id,saison,episode,episode_source_id,duree_min) VALUES (1,1,1,'x',45);"
    );
    let r = episodesANotifier(db, 8);
    expect(r.map((e) => e.titre)).toEqual(["Récent"]); // pas le vieux (fenêtre), pas B (non suivie)
    // anti-doublon
    marquerNotifie(db, 1, 1, 5);
    r = episodesANotifier(db, 8);
    expect(r).toHaveLength(0);
    // série en pause → exclue
    db.exec("INSERT INTO episodes_catalogue (serie_id,saison,episode,titre,date_diffusion) VALUES (1,1,6,'Encore','" + recent + "')");
    expect(episodesANotifier(db, 8).map((e) => e.titre)).toEqual(["Encore"]);
    definirStatutSuivi(db, 1, "pause");
    expect(episodesANotifier(db, 8)).toHaveLength(0);
  });
});
