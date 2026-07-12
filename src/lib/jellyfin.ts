// Client Jellyfin minimal (lecture seule). Auth par clé API : header X-Emby-Token.
// La config vient des réglages (base de données), pas de l'environnement.

export interface JellyfinConfig {
  url: string;
  token: string;
  userId: string;
}

const base = (url: string) => url.replace(/\/+$/, "");
const entetes = (token: string) => ({ "X-Emby-Token": token, accept: "application/json" });

export async function testerConnexion(
  cfg: JellyfinConfig,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; nom?: string; erreur?: string }> {
  if (!cfg.url || !cfg.token) return { ok: false, erreur: "URL ou clé manquante" };
  try {
    const res = await fetchImpl(`${base(cfg.url)}/System/Info`, { headers: entetes(cfg.token) });
    if (!res.ok) return { ok: false, erreur: `HTTP ${res.status}` };
    const j = (await res.json()) as { ServerName?: string };
    return { ok: true, nom: j.ServerName };
  } catch {
    return { ok: false, erreur: "connexion impossible" };
  }
}

export interface JellyfinEpisodeVu {
  seriesId: string;
  saison: number;
  episode: number;
  lastPlayed: string | null;
  playCount: number;
}

export async function fetchJellyfinVus(
  cfg: JellyfinConfig,
  fetchImpl: typeof fetch = fetch
): Promise<JellyfinEpisodeVu[] | null> {
  if (!cfg.url || !cfg.token || !cfg.userId) return null;
  try {
    const url =
      `${base(cfg.url)}/Users/${encodeURIComponent(cfg.userId)}/Items` +
      "?IncludeItemTypes=Episode&Recursive=true&Filters=IsPlayed" +
      "&Fields=ParentIndexNumber,IndexNumber,SeriesId,UserData&EnableTotalRecordCount=false";
    const res = await fetchImpl(url, { headers: entetes(cfg.token) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      Items?: Array<{
        SeriesId?: string;
        ParentIndexNumber?: number;
        IndexNumber?: number;
        UserData?: { LastPlayedDate?: string; PlayCount?: number };
      }>;
    };
    return (j.Items ?? [])
      .map((it) => ({
        seriesId: String(it.SeriesId ?? ""),
        saison: typeof it.ParentIndexNumber === "number" ? it.ParentIndexNumber : -1,
        episode: typeof it.IndexNumber === "number" ? it.IndexNumber : -1,
        lastPlayed: it.UserData?.LastPlayedDate ?? null,
        playCount: it.UserData?.PlayCount ?? 0,
      }))
      .filter((e) => e.seriesId && e.saison >= 0 && e.episode >= 0);
  } catch {
    return null;
  }
}

export interface SerieProviderIds {
  tmdb: number | null;
  tvdb: string | null;
}

export async function fetchSerieProviderIds(
  cfg: JellyfinConfig,
  seriesId: string,
  fetchImpl: typeof fetch = fetch
): Promise<SerieProviderIds | null> {
  try {
    const res = await fetchImpl(
      `${base(cfg.url)}/Users/${encodeURIComponent(cfg.userId)}/Items/${encodeURIComponent(seriesId)}`,
      { headers: entetes(cfg.token) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { ProviderIds?: Record<string, string> };
    const p = j.ProviderIds ?? {};
    const tmdbRaw = p.Tmdb ?? p.tmdb;
    const tvdbRaw = p.Tvdb ?? p.tvdb;
    return {
      tmdb: tmdbRaw ? Number(tmdbRaw) : null,
      tvdb: tvdbRaw ? String(tvdbRaw) : null,
    };
  } catch {
    return null;
  }
}
