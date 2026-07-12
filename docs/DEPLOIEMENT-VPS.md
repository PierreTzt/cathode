# Déploiement & exploitation (VPS)

MonSuivi tourne en conteneur Docker sur le VPS, derrière Caddy, exposé sous le
chemin `/monsuivi` (`BASE_PATH=/monsuivi`, baké au build et fixé au runtime).

## Démarrer / mettre à jour l'image

```bash
docker compose build
docker compose up -d
```

Le conteneur `monsuivi` écoute sur `127.0.0.1:3000` (Caddy publie vers l'extérieur).
La base et ses sauvegardes sont persistées via le volume `./data`.

Le token TMDB est fourni au conteneur par la variable `TMDB_READ_TOKEN`
(fichier `.env` lu par docker-compose). Il sert à la recherche, au catalogue
d'épisodes, aux plateformes de streaming et aux suggestions.

## Resynchronisation automatique (toutes les 72 h)

Le catalogue (nouveaux épisodes, dates de diffusion, statut de série), les
plateformes « où regarder » et les suggestions sont rafraîchis par la commande :

```bash
docker exec monsuivi npm run catalogue
```

Cette commande écrit aussi l'horodatage `derniere_resync` (visible dans l'app,
onglet **Plus**).

### Cron hôte (recommandé)

Éditer la crontab du VPS (`crontab -e`) et ajouter :

```cron
# MonSuivi — resync catalogue + plateformes + suggestions, tous les 3 jours à 4 h
0 4 */3 * * docker exec monsuivi npm run catalogue >> /var/log/monsuivi-resync.log 2>&1
```

### Récap hebdomadaire (notification du dimanche)

En plus de la resync, un récap de la semaine peut être poussé en notification le
dimanche soir :

```cron
# MonSuivi — récap hebdo poussé le dimanche à 20 h
0 20 * * 0 docker exec monsuivi npm run recap >> /var/log/monsuivi-recap.log 2>&1
```

### Alternative : service docker-compose dédié

Si l'on préfère tout garder dans `docker-compose.yml`, ajouter un service qui
lance la commande en boucle (à adapter) :

```yaml
  monsuivi-cron:
    image: monsuivi:latest
    depends_on: [monsuivi]
    environment:
      - TMDB_READ_TOKEN=${TMDB_READ_TOKEN:-}
    volumes:
      - ./data:/app/data
    entrypoint: ["sh", "-c", "while true; do npm run catalogue; sleep 259200; done"]
```

> Note : la resync peut aussi être déclenchée à la main depuis l'app
> (onglet **Plus** → « Mettre à jour maintenant »).

## Sauvegardes

`npm run backup` produit un snapshot cohérent (`VACUUM INTO`) dans
`data/backups/` avec rotation (10 dernières). À planifier de la même manière si
souhaité, ou à lancer avant une opération risquée.
```bash
docker exec monsuivi npm run backup
```
