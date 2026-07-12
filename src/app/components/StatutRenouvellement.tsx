// Statut de renouvellement TMDB (revient le / annulée / terminée…) sur la fiche.

const LABELS: Record<string, string> = {
  "Returning Series": "En cours",
  Ended: "Terminée",
  Canceled: "Annulée",
  Cancelled: "Annulée",
  "In Production": "En production",
  Planned: "Prévue",
  Pilot: "Pilote",
};

function libelleDate(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function StatutRenouvellement({
  statutDetail,
  prochaineDate,
}: {
  statutDetail: string | null;
  prochaineDate: string | null;
}) {
  const label = statutDetail ? LABELS[statutDetail] : null;
  if (!label && !prochaineDate) return null;
  const annulee = statutDetail === "Canceled" || statutDetail === "Cancelled";
  return (
    <p className={`renouvellement${annulee ? " annulee" : ""}`}>
      {prochaineDate ? (
        <>
          Revient le <strong>{libelleDate(prochaineDate)}</strong>
        </>
      ) : (
        label
      )}
    </p>
  );
}
