import { getDb } from "@/lib/db";
import { filmsGroupes, listeAVoir } from "@/lib/queries";
import { FilmsGrid } from "@/app/components/FilmsGrid";
import { Watchlist } from "@/app/components/Watchlist";

export const dynamic = "force-dynamic";

export default function Films() {
  const db = getDb();
  const vus = filmsGroupes(db);
  const aVoir = listeAVoir(db);
  return (
    <div>
      <h1>
        Films{" "}
        <span className="muted" style={{ fontWeight: 400, fontSize: "1rem" }}>
          · {vus.length}
        </span>
      </h1>
      <FilmsGrid films={vus} />
      <h2>À voir</h2>
      <Watchlist items={aVoir} />
    </div>
  );
}
