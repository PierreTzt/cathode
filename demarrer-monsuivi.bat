@echo off
cd /d "%~dp0"
if not exist "node_modules" (
  echo Premiere installation, veuillez patienter...
  call npm install
)
if not exist "data\monsuivi.db" (
  echo Import de votre historique TV Time...
  call npm run import
)
echo Recuperation des affiches (TMDB)...
call npm run enrich
echo Recuperation du catalogue des episodes (TMDB)...
call npm run catalogue
echo Demarrage de MonSuivi...
start "" http://localhost:3000
call npm run dev
