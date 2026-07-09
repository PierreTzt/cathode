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
  const mode: TriASuivre = tri === "dernier_vu" ? "dernier_vu" : "prochain";
  const lignes = tableauASuivre(getDb(), mode);
  if (lignes.length === 0) {
    return (
      <div>
        <h1>À suivre</h1>
        <p className="muted">
          Tu es à jour 🎉 — <a href="/mes-series">voir toutes mes séries</a>.
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
        <span className="muted">Trier par :</span>
        <a className={mode === "prochain" ? "actif" : ""} href="/?tri=prochain">
          Prochain épisode
        </a>
        <a className={mode === "dernier_vu" ? "actif" : ""} href="/?tri=dernier_vu">
          Dernier vu
        </a>
      </div>
      <div className="suivi-liste">
        {lignes.map((l) => (
          <ProchainEpisode key={l.serie_id} ligne={l} />
        ))}
      </div>
    </div>
  );
}
