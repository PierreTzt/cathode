// Fragments SQL et helpers partagés par plusieurs modules de requêtes.

export function parseJsonArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

// Sélection commune : épisodes diffusés (date passée), hors spéciaux, non vus.
export const RETARD_WHERE = `
  c.saison >= 1
  AND c.date_diffusion IS NOT NULL
  AND c.date_diffusion <= date('now')
  AND NOT EXISTS (
    SELECT 1 FROM episodes_vus v
     WHERE v.serie_id = c.serie_id AND v.saison = c.saison AND v.episode = c.episode
  )`;
