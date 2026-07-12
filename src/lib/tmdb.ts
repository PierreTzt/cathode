const IMG_BASE = "https://image.tmdb.org/t/p";

export function imageUrl(
  path: string | null | undefined,
  size: "w45" | "w92" | "w185" | "w300" | "w342" | "w780"
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
  apercu: string | null;
  still_path: string | null;
  date_diffusion: string | null;
  duree_min: number;
}

export interface CatalogueSerie {
  statut: "en cours" | "terminée";
  statutDetail: string | null;
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
    const resSerie = await fetchImpl(
      `https://api.themoviedb.org/3/tv/${tmdbId}?language=fr-FR`,
      { headers }
    );
    if (!resSerie.ok) return null;
    const serie = (await resSerie.json()) as {
      status?: string;
      seasons?: Array<{ season_number: number }>;
    };
    const statut: CatalogueSerie["statut"] = STATUTS_EN_COURS.has(serie.status ?? "")
      ? "en cours"
      : "terminée";
    const statutDetail = serie.status ?? null;
    const saisons = (serie.seasons ?? [])
      .map((s) => s.season_number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    const episodes: CatalogueEpisode[] = [];
    for (const n of saisons) {
      const resSaison = await fetchImpl(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${n}?language=fr-FR`,
        { headers }
      );
      if (!resSaison.ok) continue;
      const saison = (await resSaison.json()) as {
        episodes?: Array<{
          episode_number: number;
          name?: string;
          overview?: string;
          still_path?: string | null;
          air_date?: string;
          runtime?: number;
        }>;
      };
      for (const e of saison.episodes ?? []) {
        episodes.push({
          saison: n,
          episode: e.episode_number,
          titre: e.name ? e.name : null,
          apercu: e.overview ? e.overview : null,
          still_path: e.still_path ? e.still_path : null,
          date_diffusion: e.air_date ? e.air_date : null,
          duree_min: typeof e.runtime === "number" ? e.runtime : 0,
        });
      }
    }
    return { statut, statutDetail, episodes };
  } catch {
    return null;
  }
}

export interface ResultatRechercheSerie {
  tmdbId: number;
  nom: string;
  annee: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
}

// Recherche de séries sur TMDB (pour l'ajout manuel dans « Mes séries »).
export async function rechercheSeries(
  query: string,
  fetchImpl: typeof fetch = fetch
): Promise<ResultatRechercheSerie[]> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token || !query.trim()) return [];
  try {
    const url =
      "https://api.themoviedb.org/3/search/tv?language=fr-FR&include_adult=false&page=1&query=" +
      encodeURIComponent(query.trim());
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        id: number;
        name?: string;
        original_name?: string;
        first_air_date?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
      }>;
    };
    return (json.results ?? []).slice(0, 12).map((r) => ({
      tmdbId: r.id,
      nom: r.name || r.original_name || "Sans titre",
      annee: r.first_air_date ? r.first_air_date.slice(0, 4) : null,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
    }));
  } catch {
    return [];
  }
}

export interface Provider {
  nom: string;
  logo_path: string | null;
}

// Plateformes de streaming (offres par abonnement, région FR) où regarder la série.
// Retourne [] si aucune, null en cas d'erreur (pour ne pas écraser un cache valide).
export async function fetchProviders(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<Provider[] | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(
      `https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: {
        FR?: {
          flatrate?: Array<{ provider_name?: string; logo_path?: string | null }>;
        };
      };
    };
    const flatrate = json.results?.FR?.flatrate ?? [];
    return flatrate
      .map((p) => ({ nom: p.provider_name ?? "", logo_path: p.logo_path ?? null }))
      .filter((p) => p.nom !== "");
  } catch {
    return null;
  }
}

export interface RecommandationSerie {
  tmdbId: number;
  nom: string;
  annee: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
}

// Séries recommandées par TMDB à partir d'une série donnée (pour « à commencer »).
export async function fetchRecommandations(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<RecommandationSerie[]> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return [];
  try {
    const res = await fetchImpl(
      `https://api.themoviedb.org/3/tv/${tmdbId}/recommendations?language=fr-FR&page=1`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        id: number;
        name?: string;
        original_name?: string;
        first_air_date?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
      }>;
    };
    return (json.results ?? []).map((r) => ({
      tmdbId: r.id,
      nom: r.name || r.original_name || "Sans titre",
      annee: r.first_air_date ? r.first_air_date.slice(0, 4) : null,
      poster_path: r.poster_path ?? null,
      backdrop_path: r.backdrop_path ?? null,
    }));
  } catch {
    return [];
  }
}

export interface ResultatFilm {
  tmdbId: number;
  titre: string;
  annee: string | null;
  poster_path: string | null;
}

// Recherche d'un film (pour l'appariement des films vus / watchlist).
export async function rechercheFilm(
  nom: string,
  annee: string | null = null,
  fetchImpl: typeof fetch = fetch
): Promise<ResultatFilm | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token || !nom.trim()) return null;
  try {
    let url =
      "https://api.themoviedb.org/3/search/movie?language=fr-FR&include_adult=false&page=1&query=" +
      encodeURIComponent(nom.trim());
    if (annee) url += `&year=${encodeURIComponent(annee)}`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: Array<{ id: number; title?: string; original_title?: string; release_date?: string; poster_path?: string | null }>;
    };
    const r = json.results?.[0];
    if (!r) return null;
    return {
      tmdbId: r.id,
      titre: r.title || r.original_title || nom,
      annee: r.release_date ? r.release_date.slice(0, 4) : null,
      poster_path: r.poster_path ?? null,
    };
  } catch {
    return null;
  }
}

export interface FilmDetail {
  duree_min: number;
  genres: string[];
  poster_path: string | null;
  annee: string | null;
}

export async function fetchFilmDetail(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<FilmDetail | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(`https://api.themoviedb.org/3/movie/${tmdbId}?language=fr-FR`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      runtime?: number;
      genres?: Array<{ name?: string }>;
      poster_path?: string | null;
      release_date?: string;
    };
    return {
      duree_min: typeof j.runtime === "number" ? j.runtime : 0,
      genres: (j.genres ?? []).map((g) => g.name).filter((n): n is string => !!n),
      poster_path: j.poster_path ?? null,
      annee: j.release_date ? j.release_date.slice(0, 4) : null,
    };
  } catch {
    return null;
  }
}

export async function fetchFilmProviders(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<Provider[] | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(
      `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: { FR?: { flatrate?: Array<{ provider_name?: string; logo_path?: string | null }> } };
    };
    return (json.results?.FR?.flatrate ?? [])
      .map((p) => ({ nom: p.provider_name ?? "", logo_path: p.logo_path ?? null }))
      .filter((p) => p.nom !== "");
  } catch {
    return null;
  }
}

export interface CastMembre {
  tmdbId: number;
  nom: string;
  personnage: string | null;
  profile_path: string | null;
}

// Casting principal (top 10) d'une série via aggregate_credits.
export async function fetchCast(
  tmdbId: number,
  fetchImpl: typeof fetch = fetch
): Promise<CastMembre[] | null> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return null;
  try {
    const res = await fetchImpl(
      `https://api.themoviedb.org/3/tv/${tmdbId}/aggregate_credits?language=fr-FR`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      cast?: Array<{
        id: number;
        name?: string;
        profile_path?: string | null;
        roles?: Array<{ character?: string }>;
      }>;
    };
    return (json.cast ?? []).slice(0, 10).map((c) => ({
      tmdbId: c.id,
      nom: c.name ?? "",
      personnage: c.roles?.[0]?.character || null,
      profile_path: c.profile_path ?? null,
    }));
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
