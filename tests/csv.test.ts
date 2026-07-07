import { describe, it, expect } from "vitest";
import { readCsv } from "../src/import/csv";
import { join } from "node:path";

describe("readCsv", () => {
  it("parse les champs contenant des virgules entre guillemets", () => {
    const rows = readCsv(join(__dirname, "fixtures", "sample.csv"));
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Love, Death & Robots");
    expect(rows[0].season).toBe("1");
    expect(rows[1].name).toBe("NCIS");
  });
});
