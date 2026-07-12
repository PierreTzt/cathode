import { imageUrl } from "@/lib/tmdb";
import type { Provider } from "@/lib/tmdb";

// Rangée « Dispo sur : … » — logos des plateformes de streaming (abonnement, FR).
export function Providers({
  providers,
  compact = false,
}: {
  providers: Provider[];
  compact?: boolean;
}) {
  if (!providers || providers.length === 0) return null;
  return (
    <div className={`providers${compact ? " compact" : ""}`}>
      {!compact && <span className="providers-label">Dispo sur</span>}
      <div className="providers-logos">
        {providers.map((p) => {
          const src = imageUrl(p.logo_path, "w45");
          return src ? (
            <img key={p.nom} src={src} alt={p.nom} title={p.nom} className="provider-logo" loading="lazy" />
          ) : (
            <span key={p.nom} className="provider-nom">
              {p.nom}
            </span>
          );
        })}
      </div>
    </div>
  );
}
