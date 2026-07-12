import Link from "next/link";
import { getDb } from "@/lib/db";
import { tableauASuivre, nouveautes, type TriASuivre } from "@/lib/queries";
import { SuiviListe } from "@/app/components/SuiviListe";

export const dynamic = "force-dynamic";

export default async function ASuivre({
  searchParams,
}: {
  searchParams: Promise<{ tri?: string }>;
}) {
  const { tri } = await searchParams;
  const mode: TriASuivre = tri === "prochain" ? "prochain" : "dernier_vu";
  const db = getDb();
  const lignes = tableauASuivre(db, mode);
  const nouv = nouveautes(db);
  if (lignes.length === 0) {
    return (
      <div>
        <h1>À suivre</h1>
        <p className="muted">
          Tu es à jour 🎉 — <Link href="/mes-series">voir toutes mes séries</Link>.
        </p>
        {nouv.sortiesSemaine > 0 && (
          <p className="muted">
            {nouv.sortiesSemaine} sortie{nouv.sortiesSemaine > 1 ? "s" : ""} cette semaine —{" "}
            <Link href="/a-venir">voir À venir</Link>.
          </p>
        )}
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

      <NouveautesBandeau nouv={nouv} />

      <div className="tri-selecteur">
        <span className="tri-label">Trier</span>
        <Link className={mode === "dernier_vu" ? "actif" : ""} href="/?tri=dernier_vu">
          Dernier vu
        </Link>
        <Link className={mode === "prochain" ? "actif" : ""} href="/?tri=prochain">
          Prochain épisode
        </Link>
      </div>
      <SuiviListe lignes={lignes} />
    </div>
  );
}

function NouveautesBandeau({
  nouv,
}: {
  nouv: { episodesDispo: number; seriesEnRetard: number; sortiesSemaine: number };
}) {
  if (nouv.episodesDispo === 0 && nouv.sortiesSemaine === 0) return null;
  return (
    <div className="nouv-bandeau">
      {nouv.episodesDispo > 0 && (
        <span className="nouv-seg">
          <strong>{nouv.episodesDispo}</strong> épisode{nouv.episodesDispo > 1 ? "s" : ""} dispo
          {nouv.seriesEnRetard > 0 ? ` · ${nouv.seriesEnRetard} série${nouv.seriesEnRetard > 1 ? "s" : ""}` : ""}
        </span>
      )}
      {nouv.sortiesSemaine > 0 && (
        <Link className="nouv-seg nouv-lien" href="/a-venir">
          <strong>{nouv.sortiesSemaine}</strong> sortie{nouv.sortiesSemaine > 1 ? "s" : ""} cette semaine ›
        </Link>
      )}
    </div>
  );
}
