# Cathode — votre suivi de séries et de films

Cathode garde la trace de ce que vous regardez : le prochain épisode de chaque
série, ce qu'il vous reste à rattraper, vos films vus et votre historique. Tout
est stocké chez vous.

*(Version anglaise : [README.md](README.md).)*

## Démarrer l'appli

Double-cliquez sur **`demarrer-cathode.bat`**. Votre navigateur s'ouvre sur
l'appli. Pour l'arrêter, fermez la fenêtre noire.

Au tout premier lancement, l'appli s'installe et prépare sa base — comptez une
minute. Les fois suivantes, le démarrage est immédiat.

### Prérequis, une seule fois

**Node.js 24 ou plus** : https://nodejs.org (choisir la version proposée, puis
« suivant » jusqu'au bout).

**Une clé TMDB**, sans quoi il n'y a ni affiches, ni catalogue d'épisodes, ni
recherche. Créez un compte sur [themoviedb.org](https://www.themoviedb.org/),
puis dans Paramètres → API, copiez le *jeton d'accès en lecture* (une longue
chaîne commençant par `eyJ`). Collez-le dans un fichier `.env.local` à la racine :

```
TMDB_READ_TOKEN=votre_jeton_ici
```

Le fichier [`.env.example`](.env.example) sert de modèle.

## Première utilisation

Si vous avez un export TV Time, décompressez-le dans un dossier `gdpr-data/` à
la racine **avant** le premier lancement : votre historique sera importé
automatiquement.

Sinon, l'appli démarre sur une base vide. Ajoutez vos séries depuis l'écran
**Rechercher**.

## Où sont mes données ?

Tout est dans `data/cathode.db`, sur votre machine. Rien n'est envoyé ailleurs,
à l'exception des requêtes à TMDB pour récupérer les affiches et les épisodes
des séries que vous suivez. Aucun compte, aucun traçage.

Une sauvegarde automatique est faite à chaque démarrage dans `data/backups/`,
avec rotation des anciennes.

Vous pouvez aussi télécharger une sauvegarde et la restaurer depuis
**Réglages → Sauvegarde**.

## Les écrans

- **À suivre** — le prochain épisode de chaque série en cours. Cochez-le, ou
  utilisez « jusqu'ici » pour rattraper plusieurs épisodes d'un coup. Le bouton
  « Au hasard » choisit à votre place.
- **À venir** — le calendrier des prochaines diffusions.
- **Mes séries** — toute votre bibliothèque, avec filtres (en retard, à jour,
  terminées, favoris, en pause, abandonnées) et ajout de nouvelles séries.
- **Journal** — l'historique de ce que vous avez vu.
- **Rechercher** — chercher une série ou un film sur TMDB.
- **Films** — vos films vus et votre liste « à voir ».
- **Statistiques** — progression, carte d'activité sur douze mois, temps total,
  top séries, et le bilan de l'année.
- **Réglages** — thème clair/sombre/auto, notifications, mise à jour du
  catalogue, sauvegarde, synchronisation Jellyfin.

## Notifications

L'appli s'installe comme une application (PWA) depuis le menu de votre
navigateur. Elle peut alors vous prévenir des nouveaux épisodes et vous envoyer
un récapitulatif le dimanche soir.

Cela demande une paire de clés VAPID, à générer une fois avec
`npx web-push generate-vapid-keys` puis à coller dans `.env.local` — voir
[`.env.example`](.env.example).

## Mettre à jour le catalogue

Les affiches, les nouveaux épisodes, les plateformes de streaming et les
suggestions se rafraîchissent au démarrage, et à la demande depuis
**Réglages → Mise à jour du catalogue**.

## Hébergement sur un serveur

Voir [`docs/DEPLOIEMENT-VPS.md`](docs/DEPLOIEMENT-VPS.md) : conteneur Docker
derrière Caddy, avec les tâches cron de resynchronisation et de récapitulatif.

## Crédits

Les données des séries et des films viennent de
[TMDB](https://www.themoviedb.org/). Ce produit utilise l'API TMDB sans être
approuvé ni certifié par TMDB.

Cathode n'est ni affilié ni lié à TV Time.

Sous licence [MIT](LICENSE).
