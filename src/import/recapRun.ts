import { getDb } from "../lib/db";
import { envoyerRecapHebdo } from "../lib/push";

// Récap hebdo poussé en notification (cron VPS, dimanche soir).
async function main() {
  const db = getDb();
  const r = await envoyerRecapHebdo(db);
  console.log(`Récap hebdo : ${r.envoyes} notification(s) envoyée(s).`);
  db.close();
}

main().catch((e) => {
  console.error("Erreur récap hebdo :", e);
  process.exitCode = 1;
});
