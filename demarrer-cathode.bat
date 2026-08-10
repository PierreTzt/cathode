@echo off
cd /d "%~dp0"
if not exist "node_modules" (
  echo Premiere installation, veuillez patienter...
  call npm install
)
if not exist "data\cathode.db" (
  if exist "gdpr-data" (
    echo Import de votre historique TV Time...
    call npm run import
  ) else (
    echo Aucun export TV Time trouve dans gdpr-data : demarrage avec une base vide.
    echo Ajoutez vos series depuis l'ecran Recherche.
  )
)
echo Sauvegarde de votre suivi...
call npm run backup
echo Recuperation des affiches (TMDB)...
call npm run enrich
echo Recuperation du catalogue des episodes (TMDB)...
call npm run catalogue
echo Recuperation des genres (TMDB)...
call npm run genres
echo Demarrage de Cathode...
start "" http://localhost:3000
call npm run dev
