@echo off
REM ============================================================
REM Snapshot quotidien des reservistes - wrapper Windows
REM Lance par Task Scheduler tous les jours a 7h00
REM ============================================================

setlocal

REM Repertoire du repo (parent du dossier scripts)
set REPO=C:\Users\Dany\nextjs\portail-riusc
set LOGDIR=%REPO%\snapshots\_logs

REM Date au format YYYY-MM-DD (portable, independant du locale)
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set TODAY=%%i

if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set LOG=%LOGDIR%\%TODAY%_run.log

cd /d "%REPO%" || (echo ERREUR: cd vers %REPO% echoue >> "%LOG%" & exit /b 1)

echo. >> "%LOG%"
echo === Snapshot run %DATE% %TIME% === >> "%LOG%"

REM 1. Executer le script Node (retry deja integre dans le script)
call node scripts\snapshot_reservistes.js >> "%LOG%" 2>&1
set NODE_RC=%ERRORLEVEL%

if not %NODE_RC%==0 (
  echo ERREUR: snapshot_reservistes.js a retourne %NODE_RC% >> "%LOG%"
  exit /b %NODE_RC%
)

REM 2. Verifier que le CSV a bien ete cree
if not exist "snapshots\%TODAY%_snapshot.csv" (
  echo ERREUR: snapshots\%TODAY%_snapshot.csv n'existe pas apres l'execution de Node >> "%LOG%"
  exit /b 1
)

REM 3. Auto-commit + push du CSV genere
git add snapshots/%TODAY%_snapshot.csv >> "%LOG%" 2>&1
git diff --cached --quiet
if %ERRORLEVEL%==0 (
  echo Aucun changement a committer ^(snapshot identique?^) >> "%LOG%"
  exit /b 0
)

git commit -m "chore(snapshots): snapshot quotidien %TODAY%" >> "%LOG%" 2>&1
if not %ERRORLEVEL%==0 (
  echo ERREUR: git commit echoue >> "%LOG%"
  exit /b 1
)

git push >> "%LOG%" 2>&1
if not %ERRORLEVEL%==0 (
  echo ERREUR: git push echoue ^(commit local OK, push manuel requis^) >> "%LOG%"
  exit /b 1
)

echo === Snapshot %TODAY% commit + push OK === >> "%LOG%"
endlocal
exit /b 0
