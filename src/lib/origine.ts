// Protection CSRF des routes /api/* qui modifient l'état (les Server Actions
// ont la leur, intégrée à Next). Un navigateur envoie toujours l'en-tête Origin
// sur un POST : s'il désigne un autre hôte que celui servi, la requête vient
// d'un site tiers. Sans Origin, ce n'est pas un navigateur (curl, script) : on
// laisse passer, le CSRF ne concerne que les navigateurs.
// Derrière Caddy, l'hôte public arrive dans X-Forwarded-Host ou Host (Caddy
// transmet l'hôte d'origine par défaut) — même logique que Next.
export function origineAutorisee(req: Request): boolean {
  const origine = req.headers.get("origin");
  if (!origine) return true;
  const hote = (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
    ?.split(",")[0]
    .trim();
  if (!hote) return false;
  try {
    return new URL(origine).host === hote;
  } catch {
    return false; // Origin illisible, ou "null" (iframe sandbox, file://)
  }
}
