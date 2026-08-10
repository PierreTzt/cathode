#!/usr/bin/env bash
# Met à jour Cathode depuis le dépôt Git, si et seulement si un nouveau commit
# est disponible. Conçu pour tourner en cron sur le serveur.
#
#   0 5 * * * /home/ubuntu/cathode/scripts/maj-auto.sh >> /home/ubuntu/cathode-maj.log 2>&1
#
# Garde-fous :
#   - ne fait rien si le dépôt est déjà à jour (sortie silencieuse) ;
#   - sauvegarde la base avant toute mise à jour ;
#   - construit l'image AVANT de remplacer le conteneur : si le build échoue,
#     la version en cours continue de tourner.

set -euo pipefail
cd "$(dirname "$0")/.."

CONTENEUR="${CATHODE_CONTENEUR:-cathode}"

git fetch --quiet origin

local_sha=$(git rev-parse HEAD)
distant_sha=$(git rev-parse '@{u}')

if [ "$local_sha" = "$distant_sha" ]; then
  exit 0
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') — mise à jour ${local_sha:0:7} → ${distant_sha:0:7}"

# Sauvegarde d'abord. Si le conteneur ne tourne pas, on continue : il n'y a
# alors rien à sauvegarder que le volume ne contienne déjà.
if docker ps --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
  docker exec "$CONTENEUR" npm run backup || echo "avertissement : sauvegarde impossible, on continue"
fi

git pull --ff-only

# Build séparé du démarrage : un échec ici laisse l'ancien conteneur en place.
docker compose build
docker compose up -d

echo "=== mise à jour terminée : $(git log -1 --format='%h %s')"
