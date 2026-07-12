import { sauvegarder } from "@/import/backup";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// Télécharge une sauvegarde cohérente (VACUUM INTO) de la base.
export async function GET() {
  const dbPath = join(process.cwd(), "data", "monsuivi.db");
  const backupDir = join(process.cwd(), "data", "backups");
  const res = sauvegarder(dbPath, backupDir);
  if (!res) return new Response("Aucune base à sauvegarder.", { status: 404 });
  const buf = readFileSync(res.chemin);
  const nom = res.chemin.split(/[\\/]/).pop() ?? "monsuivi.db";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nom}"`,
    },
  });
}
