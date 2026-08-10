import { sauvegarder } from "@/import/backup";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// Restaure une sauvegarde : sauvegarde l'état actuel, valide l'entête SQLite,
// remplace la base et purge les fichiers WAL/SHM.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("fichier");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, erreur: "Aucun fichier reçu." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 16 || buf.subarray(0, 15).toString("latin1") !== "SQLite format 3") {
    return Response.json({ ok: false, erreur: "Ce n'est pas une base SQLite valide." }, { status: 400 });
  }
  const dbPath = join(process.cwd(), "data", "cathode.db");
  const backupDir = join(process.cwd(), "data", "backups");
  try {
    sauvegarder(dbPath, backupDir); // sécurité : snapshot de l'état actuel avant remplacement
    for (const suf of ["-wal", "-shm"]) {
      const p = dbPath + suf;
      if (existsSync(p)) rmSync(p);
    }
    writeFileSync(dbPath, buf);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, erreur: "Échec de la restauration." }, { status: 500 });
  }
}
