CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT UNIQUE,
  nom TEXT NOT NULL,
  suivi_le TEXT,
  actif INTEGER NOT NULL DEFAULT 0,
  archive INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS episodes_vus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serie_id INTEGER NOT NULL REFERENCES series(id),
  saison INTEGER,
  episode INTEGER,
  episode_source_id TEXT,
  vu_le TEXT,
  duree_min INTEGER NOT NULL DEFAULT 0,
  rewatch_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (serie_id, saison, episode, episode_source_id)
);

CREATE TABLE IF NOT EXISTS films_vus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  vu_le TEXT,
  duree_min INTEGER NOT NULL DEFAULT 0,
  UNIQUE (nom, vu_le)
);

CREATE INDEX IF NOT EXISTS idx_ep_serie ON episodes_vus (serie_id);

CREATE TABLE IF NOT EXISTS episodes_catalogue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serie_id INTEGER NOT NULL REFERENCES series(id),
  saison INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  titre TEXT,
  apercu TEXT,
  still_path TEXT,
  date_diffusion TEXT,
  duree_min INTEGER NOT NULL DEFAULT 0,
  UNIQUE (serie_id, saison, episode)
);

CREATE INDEX IF NOT EXISTS idx_cat_serie ON episodes_catalogue (serie_id);

CREATE TABLE IF NOT EXISTS a_voir (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titre TEXT NOT NULL UNIQUE,
  ajoute_le TEXT
);
