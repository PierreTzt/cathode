// Détection des mises à jour disponibles sur GitHub.
//
// À n'utiliser que côté serveur. La version locale est injectée au build Docker
// (ARG CATHODE_VERSION) ; en développement, elle est lue depuis le dépôt Git.
// Si aucune des deux n'est disponible, la comparaison est simplement désactivée
// plutôt que d'afficher une information fausse.

import { execFileSync } from "node:child_process";
import { appMetaGet, appMetaSet } from "./queries";
import type { DB } from "./db";

const DEPOT = "PierreTzt/cathode";
const BRANCHE = "master";

// L'API GitHub non authentifiée est limitée à 60 requêtes par heure et par IP.
// On garde donc la réponse en cache ; le bouton « Vérifier » force le rafraîchissement.
const CACHE_MS = 6 * 60 * 60 * 1000;

export interface EtatVersion {
  /** Version en cours d'exécution, ou null si indéterminable. */
  locale: string | null;
  /** Dernier commit publié sur GitHub, ou null si la vérification a échoué. */
  distante: string | null;
  /** Message du dernier commit distant. */
  titre: string | null;
  /** Date ISO du dernier commit distant. */
  date: string | null;
  /** true si une version plus récente est disponible. */
  majDisponible: boolean;
  /** Horodatage de la dernière vérification réussie. */
  verifieLe: string | null;
}

export function versionLocale(): string | null {
  const injectee = process.env.CATHODE_VERSION?.trim();
  if (injectee) return injectee.slice(0, 7);
  // Repli développement : le dépôt Git est présent à côté du code.
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

interface CacheDistant {
  sha: string;
  titre: string;
  date: string;
  verifieLe: string;
}

async function recupererDistante(
  fetchImpl: typeof fetch = fetch
): Promise<CacheDistant | null> {
  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${DEPOT}/commits/${BRANCHE}`,
      { headers: { accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      sha?: string;
      commit?: { message?: string; committer?: { date?: string } };
    };
    if (!j.sha) return null;
    return {
      sha: j.sha.slice(0, 7),
      titre: (j.commit?.message ?? "").split("\n")[0],
      date: j.commit?.committer?.date ?? "",
      verifieLe: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function etatVersion(
  db: DB,
  options: { forcer?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<EtatVersion> {
  const locale = versionLocale();

  let cache: CacheDistant | null = null;
  const brut = appMetaGet(db, "maj_dernier_commit");
  if (brut) {
    try {
      cache = JSON.parse(brut) as CacheDistant;
    } catch {
      cache = null;
    }
  }

  const perime =
    !cache || Date.now() - new Date(cache.verifieLe).getTime() > CACHE_MS;

  if (options.forcer || perime) {
    const frais = await recupererDistante(options.fetchImpl);
    // En cas d'échec réseau, on garde le cache précédent plutôt que de
    // prétendre qu'aucune mise à jour n'existe.
    if (frais) {
      cache = frais;
      appMetaSet(db, "maj_dernier_commit", JSON.stringify(frais));
    }
  }

  return {
    locale,
    distante: cache?.sha ?? null,
    titre: cache?.titre ?? null,
    date: cache?.date ?? null,
    majDisponible: !!(locale && cache?.sha && locale !== cache.sha),
    verifieLe: cache?.verifieLe ?? null,
  };
}
