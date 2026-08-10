# Déploiement & exploitation (VPS)

Cathode tourne en conteneur Docker sur le VPS, derrière Caddy, exposé sous le
chemin `/cathode`.

Le sous-chemin est piloté par `BASE_PATH`, vide par défaut (appli servie à la
racine). `docker-compose.yml` le fixe à `/cathode` à **deux** endroits :
`build.args` et `environment`. Les deux sont nécessaires — Next.js bake le
`basePath` dans les assets au build, donc ne le passer qu'au runtime laisse des
404 sur toutes les ressources statiques.

## Démarrer / mettre à jour l'image

```bash
docker compose build
docker compose up -d
```

Le conteneur `cathode` écoute sur `127.0.0.1:3000` (Caddy publie vers l'extérieur).
La base et ses sauvegardes sont persistées via le volume `./data`.

Le token TMDB est fourni au conteneur par la variable `TMDB_READ_TOKEN`
(fichier `.env` lu par docker-compose). Il sert à la recherche, au catalogue
d'épisodes, aux plateformes de streaming et aux suggestions.

## Resynchronisation automatique (toutes les 72 h)

Le catalogue (nouveaux épisodes, dates de diffusion, statut de série), les
plateformes « où regarder » et les suggestions sont rafraîchis par la commande :

```bash
docker exec cathode npm run catalogue
```

Cette commande écrit aussi l'horodatage `derniere_resync` (visible dans l'app,
onglet **Plus**).

### Cron hôte (recommandé)

Éditer la crontab du VPS (`crontab -e`) et ajouter :

```cron
# Cathode — resync catalogue + plateformes + suggestions, tous les 3 jours à 4 h
0 4 */3 * * docker exec cathode npm run catalogue >> /var/log/cathode-resync.log 2>&1
```

### Récap hebdomadaire (notification du dimanche)

En plus de la resync, un récap de la semaine peut être poussé en notification le
dimanche soir :

```cron
# Cathode — récap hebdo poussé le dimanche à 20 h
0 20 * * 0 docker exec cathode npm run recap >> /var/log/cathode-recap.log 2>&1
```

### Alternative : service docker-compose dédié

Si l'on préfère tout garder dans `docker-compose.yml`, ajouter un service qui
lance la commande en boucle (à adapter) :

```yaml
  cathode-cron:
    image: cathode:latest
    depends_on: [cathode]
    environment:
      - TMDB_READ_TOKEN=${TMDB_READ_TOKEN:-}
    volumes:
      - ./data:/app/data
    entrypoint: ["sh", "-c", "while true; do npm run catalogue; sleep 259200; done"]
```

> Note : la resync peut aussi être déclenchée à la main depuis l'app
> (onglet **Plus** → « Mettre à jour maintenant »).

## Mise à jour automatique depuis Git

`scripts/maj-auto.sh` interroge le dépôt et ne fait rien tant qu'aucun nouveau
commit n'est disponible. Quand il y en a un : sauvegarde de la base, `git pull`,
build, puis redémarrage.

```cron
# Cathode — mise à jour depuis Git, tous les jours à 5 h
0 5 * * * /home/ubuntu/cathode/scripts/maj-auto.sh >> /home/ubuntu/cathode-maj.log 2>&1
```

Le build est fait **avant** de remplacer le conteneur : s'il échoue, la version
en cours continue de tourner et l'erreur part dans le log. Le script est
idempotent et peut être lancé à la main à tout moment.

Choix assumé du *poll* plutôt que d'un webhook GitHub : aucun port à exposer,
aucun secret partagé avec un tiers. Le prix est un délai pouvant aller jusqu'à
24 h, sans importance ici — et `docker compose up -d --build` reste disponible
pour déployer sur-le-champ.

## Sauvegardes

`npm run backup` produit un snapshot cohérent (`VACUUM INTO`) dans
`data/backups/` avec rotation (10 dernières). À planifier de la même manière si
souhaité, ou à lancer avant une opération risquée.
```bash
docker exec cathode npm run backup
```
