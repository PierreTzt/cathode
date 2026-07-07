import { describe, it, expect } from "vitest";
import { getDb } from "../src/lib/db";

describe("getDb", () => {
  it("crée les tables attendues sur une base en mémoire", () => {
    const db = getDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("series");
    expect(tables).toContain("episodes_vus");
    expect(tables).toContain("films_vus");
  });
});
