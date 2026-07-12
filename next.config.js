/** @type {import('next').NextConfig} */
// basePath piloté par l'env : vide en local (racine), "/monsuivi" dans le
// conteneur Docker derrière Caddy. Défini au build ET au runtime.
const basePath = process.env.BASE_PATH || "";
const nextConfig = {
  basePath,
  // Exposé au client (scope du service worker, liens manifest/icônes).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};
module.exports = nextConfig;
