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
echo Demarrage de MonSuivi...
start "" http://localhost:3000
call npm run dev
