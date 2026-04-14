# Snapshot quotidien des reservistes

Tourne tous les jours a **7h00** sur le workstation de Dany via Task Scheduler Windows.

## Fichiers

- `snapshot_reservistes.js` - Script Node qui interroge Supabase et ecrit le CSV. Inclut retry exponentiel sur erreurs reseau.
- `snapshot_run.bat` - Wrapper Windows: lance Node, log, git add/commit/push automatique.
- `Register-SnapshotTask.ps1` - Enregistre la tache dans Task Scheduler (a rouler une fois).

## Installation

1. Ouvrir PowerShell **en Administrateur**
2. `cd C:\Users\Dany\nextjs\portail-riusc\scripts`
3. `powershell -ExecutionPolicy Bypass -File .\Register-SnapshotTask.ps1`

## Test manuel

```powershell
Start-ScheduledTask -TaskName "RIUSC-Snapshot-Quotidien"
```

Verifier le log dans `snapshots/_logs/YYYY-MM-DD_run.log`.

## Sortie

- CSV: `snapshots/YYYY-MM-DD_snapshot.csv` (commit + push automatique)
- Log: `snapshots/_logs/YYYY-MM-DD_run.log`

## Si ca echoue

- **Reseau Supabase** - le script retry 4 fois (1s, 2s, 4s, 8s). Verifier le log.
- **Git push** - si le push echoue, le commit local est fait. Faire `git push` manuel.
- **Workstation eteint a 7h** - `StartWhenAvailable` est active, la tache se lance des le boot suivant.
