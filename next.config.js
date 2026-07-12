/** @type {import('next').NextConfig} */
// basePath piloté par l'env : vide en local (racine), "/monsuivi" dans le
// conteneur Docker derrière Caddy. Défini au build ET au runtime.
const basePath = process.env.BASE_PATH || "";
const nextConfig = {
  basePath,
};
module.exports = nextConfig;
