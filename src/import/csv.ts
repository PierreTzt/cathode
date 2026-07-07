import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export function readCsv(path: string): Record<string, string>[] {
  const content = readFileSync(path, "utf8");
  return parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  }) as Record<string, string>[];
}
