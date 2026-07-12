import { getDb } from "@/lib/db";
import { aVenir, reglages } from "@/lib/queries";
import { AvenirVues } from "@/app/components/AvenirVues";

export const dynamic = "force-dynamic";

export default function AVenir() {
  const db = getDb();
  const eps = aVenir(db, 120);
  const defaut = reglages(db).avenirVue;
  if (eps.length === 0) {
    return (
      <div>
        <h1>À venir</h1>
        <p className="muted">Rien de prévu prochainement pour tes séries suivies.</p>
      </div>
    );
  }
  return (
    <div>
      <h1>À venir</h1>
      <AvenirVues eps={eps} defaut={defaut} />
    </div>
  );
}
