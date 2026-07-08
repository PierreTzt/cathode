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
