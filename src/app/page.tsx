import Link from "next/link";
import { getDb } from "@/lib/db";
import { tableauASuivre, type TriASuivre } from "@/lib/queries";
import { ProchainEpisode } from "@/app/components/ProchainEpisode";

export const dynamic = "force-dynamic";

export default async function ASuivre({
  searchParams,
}: {
  searchParams: Promise<{ tri?: string }>;
}) {
  const { tri } = await searchParams;
  const mode: TriASuivre = tri === "prochain" ? "prochain" : "dernier_vu";
  const lignes = tableauASuivre(getDb(), mode);
  if (lignes.length === 0) {
    return (
      <div>
        <h1>À suivre</h1>
        <p className="muted">
          Tu es à jour 🎉 — <Link href="/mes-series">voir toutes mes séries</Link>.
        </p>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          (Si tu viens d&apos;importer, le catalogue des épisodes se remplit au lancement via{" "}
          <code>demarrer-monsuivi.bat</code>.)
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1>
        À suivre{" "}
        <span className="muted" style={{ fontWeight: 400, fontSize: "1rem" }}>
          · {lignes.length}
        </span>
      </h1>
      <div className="tri-selecteur">
        <span className="tri-label">Trier</span>
        <Link className={mode === "dernier_vu" ? "actif" : ""} href="/?tri=dernier_vu">
          Dernier vu
        </Link>
        <Link className={mode === "prochain" ? "actif" : ""} href="/?tri=prochain">
          Prochain épisode
        </Link>
      </div>
      <div className="suivi-liste">
        {lignes.map((l) => (
          <ProchainEpisode key={l.serie_id} ligne={l} />
        ))}
      </div>
    </div>
  );
}
