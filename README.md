<div align="center">

<img src="public/icon-192.png" alt="Cathode" width="88" />

# Cathode

**A self-hosted TV show and movie tracker.**
Know what to watch next, tick off episodes, and keep your viewing history on your own machine.

[![CI](https://github.com/PierreTzt/cathode/actions/workflows/ci.yml/badge.svg)](https://github.com/PierreTzt/cathode/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-c8b273?style=flat-square)](LICENSE)
![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003b57?style=flat-square&logo=sqlite&logoColor=white)
![5 dependencies](https://img.shields.io/badge/dependencies-5-c8b273?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-5a3fc0?style=flat-square)

[Version française](README.fr.md)

</div>

> [!NOTE]
> The interface, the code and the comments are all in French.
> This README is the only English part of the project.

Cathode was built to replace TV Time after the service shut down. It imports a
TV Time GDPR export if you saved one, and works perfectly well without.

<div align="center">
  <img src="docs/screenshots/01-a-suivre.png" alt="Up next" width="820" />
</div>

## What it does

**Track episodes.** Every show you follow lists its next unwatched episode with
a synopsis and a still. Tick one off, or use *jusqu'ici* ("up to here") to catch
up several at once. Sort by last watched or by next episode, or hit the dice
button when you can't decide.

**Know where you stand.** A show page gives you the full season-by-season
episode list, how much is left, and the real time it would take to catch up. Set
a pace — two episodes a night — and it tells you the date you'd finish.

**Keep a library.** Filter your shows by behind, up to date, not started,
finished, favourites, paused or dropped. Rate them, mark favourites, and see
cast members, streaming providers and similar shows pulled from TMDB.

**See the numbers.** Library progress, a twelve-month activity heatmap, total
time watched, your biggest binge day, top shows, and a year-in-review page.

**Movies too.** Watched movies with ratings and providers, plus a watchlist with
a one-click *j'ai vu* ("watched it").

**And the rest.** An upcoming-episodes calendar, a viewing journal, TMDB search
to add shows, renewal status ("returns on…" / "cancelled"), light and dark
themes, optional Jellyfin sync, automatic database backups with rotation, and
one-click backup and restore.

It installs as a PWA and can send web push notifications for new episodes and a
Sunday weekly recap.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/03-fiche-serie.png" alt="Show page" /><br/><sub><b>Show page</b> — episode tracker, catch-up time, binge planner</sub></td>
<td width="50%"><img src="docs/screenshots/02-mes-series.png" alt="My shows" /><br/><sub><b>My shows</b> — the library, filtered by status</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/04-statistiques.png" alt="Statistics" /><br/><sub><b>Statistics</b> — progress, heatmap, top shows</sub></td>
<td width="50%"><img src="docs/screenshots/05-films.png" alt="Movies" /><br/><sub><b>Movies</b> — watched, rated, with providers</sub></td>
</tr>
</table>

## The screens

Screen names are in French, since the interface is.

| Screen | What it holds |
|---|---|
| **À suivre** | Up next — the next episode of every show in progress |
| **À venir** | Upcoming — the release calendar, as a list or a month view |
| **Mes séries** | My shows — the whole library, with filters and show adding |
| **Journal** | What you watched, and memories ("one year ago") |
| **Rechercher** | Search locally, then fall back to TMDB |
| **Films** | Movies — watched, and the watchlist |
| **Statistiques** | Progress, activity, total time, top shows, year in review |
| **Réglages** | Settings — theme, notifications, catalogue, backup, Jellyfin |

## Stack

Deliberately small — no ORM, no CSS framework, no state library, and no native
dependency to compile. **Five runtime dependencies** in total.

- **Next.js 15** (App Router) and **React 19**
- **SQLite** through `node:sqlite`, Node's built-in driver — hence **Node 24+**
- `web-push` for notifications, `csv-parse` for the TV Time import
- **Vitest** for tests
- Deploys as a single Docker container behind a reverse proxy

## Getting started

```bash
git clone https://github.com/PierreTzt/cathode.git
cd cathode
npm install
cp .env.example .env.local   # then add your TMDB token
npm run dev
```

Open http://localhost:3000. The database is created automatically on first run
at `data/cathode.db` — there is nothing to migrate or seed. Add your first show
from the *Rechercher* screen.

On Windows, `demarrer-cathode.bat` does all of the above and opens your browser.

TMDB is not strictly required, but without a token the app has no posters, no
episode catalogue and no search — which is most of it.

### Environment variables

See [`.env.example`](.env.example) for the full list. In short:

| Variable | Required | Purpose |
|---|---|---|
| `TMDB_READ_TOKEN` | yes | Posters, episodes, cast, providers, search |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | Web push notifications |
| `BASE_PATH` | no | Serve under a sub-path instead of the domain root |

Generate the VAPID pair once with `npx web-push generate-vapid-keys`.

### Docker

```bash
cp .env.example .env   # fill it in
docker compose up -d --build
```

The container listens on `127.0.0.1:3000`, expecting a reverse proxy in front of
it. `./data` is mounted as a volume so the database survives rebuilds.

> [!IMPORTANT]
> **Cathode has no login of its own.** It is a single-user app: anyone who can
> reach it can read and edit your history. Put authentication in your reverse
> proxy — basic auth, or whatever your setup offers — before exposing it to the
> internet.

The app is served at the domain root by default. To serve it under a sub-path,
set `BASE_PATH` (e.g. `/cathode`) in `.env` and rebuild: it is baked into the
assets at build time, and `docker-compose.yml` passes it to both the build and
the container.

See [`docs/DEPLOIEMENT-VPS.md`](docs/DEPLOIEMENT-VPS.md) (French) for a full VPS
deployment with Caddy and cron jobs.

### Importing from TV Time

Optional, and only possible if you saved your data export before TV Time closed.
Unzip it into a `gdpr-data/` directory at the project root, then:

```bash
npm run import
```

It reads the series, episode and movie CSVs and populates the database. Run
`npm run enrich` and `npm run catalogue` afterwards to pull posters and the
episode catalogue from TMDB.

## Your data

Everything lives in `data/cathode.db` on your own machine or server. Nothing is
sent anywhere except to TMDB, to fetch metadata about the shows you track. There
are no accounts, no telemetry, and no third parties.

`data/` and `gdpr-data/` are git-ignored, so your history can never end up in a
commit by accident.

## Contributing

This is a personal project published so others can read it and run it. It comes
with no support, no roadmap, and no guarantee that pull requests will be
reviewed. Fork it freely — that is what the licence is for.

## Attribution

This product uses the TMDB API but is not endorsed or certified by
[TMDB](https://www.themoviedb.org/). All show and movie metadata, posters and
images come from TMDB.

Cathode is not affiliated with, endorsed by, or connected to TV Time. It reads
the personal data export TV Time provided to its users, and uses none of their
trademarks, logos or APIs.

## Licence

[MIT](LICENSE) © 2026 Pierre Touzet
