const IMG_BASE = "https://image.tmdb.org/t/p";

export function imageUrl(
  path: string | null | undefined,
  size: "w185" | "w342" | "w780"
): string | null {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export interface TmdbSerie {
  tmdbId: number;
  posterPath: string | null;
  backdropPath: string | null;
}

export async function fetchGenres(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<string[] | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(`https://api.themoviedb.org/3/tv/${tmdbId}`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { genres?: Array<{ name?: string }> };
    return (json.genres ?? []).map((g) => g.name).filter((n): n is string => !!n);
  } catch {
    return null;
  }
}

export interface CatalogueEpisode {
  saison: number;
  episode: number;
  titre: string | null;
  date_diffusion: string | null;
  duree_min: number;
}

export interface CatalogueSerie {
  statut: "en cours" | "terminée";
  episodes: CatalogueEpisode[];
}

const STATUTS_EN_COURS = new Set(["Returning Series", "In Production", "Planned", "Pilot"]);

export async function fetchSeriesEpisodes(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogueSerie | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}`, accept: "application/json" };
  try {
    const resSerie = await fetchImpl(`https://api.themoviedb.org/3/tv/${tmdbId}`, { headers });
    if (!resSerie.ok) return null;
    const serie = (await resSerie.json()) as {
      status?: string;
      seasons?: Array<{ season_number: number }>;
    };
    const statut: CatalogueSerie["statut"] = STATUTS_EN_COURS.has(serie.status ?? "")
      ? "en cours"
      : "terminée";
    const saisons = (serie.seasons ?? [])
      .map((s) => s.season_number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    const episodes: CatalogueEpisode[] = [];
    for (const n of saisons) {
      const resSaison = await fetchImpl(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${n}`,
        { headers }
      );
      if (!resSaison.ok) continue;
      const saison = (await resSaison.json()) as {
        episodes?: Array<{ episode_number: number; name?: string; air_date?: string; runtime?: number }>;
      };
      for (const e of saison.episodes ?? []) {
        episodes.push({
          saison: n,
          episode: e.episode_number,
          titre: e.name ? e.name : null,
          date_diffusion: e.air_date ? e.air_date : null,
          duree_min: typeof e.runtime === "number" ? e.runtime : 0,
        });
      }
    }
    return { statut, episodes };
  } catch {
    return null;
  }
}

export async function findByTvdbId(
  tvdbId: string,
  fetchImpl: typeof fetch = fetch
): Promise<TmdbSerie | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(
      `https://api.themoviedb.org/3/find/${tvdbId}?external_source=tvdb_id`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { tv_results?: Array<Record<string, unknown>> };
    const hit = json.tv_results?.[0];
    if (!hit) return null;
    return {
      tmdbId: Number(hit.id),
      posterPath: (hit.poster_path as string) ?? null,
      backdropPath: (hit.backdrop_path as string) ?? null,
    };
  } catch {
    return null;
  }
}
