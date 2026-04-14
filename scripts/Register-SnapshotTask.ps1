# ============================================================
# Enregistre la tache "RIUSC-Snapshot-Quotidien" dans Task Scheduler
# A executer UNE FOIS dans une fenetre PowerShell en Administrateur:
#   powershell -ExecutionPolicy Bypass -File .\Register-SnapshotTask.ps1
# ============================================================

$TaskName = "RIUSC-Snapshot-Quotidien"
$BatPath  = "C:\Users\Dany\nextjs\portail-riusc\scripts\snapshot_run.bat"
$RunTime  = "07:00"

# Supprimer la tache existante si presente (idempotent)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Tache existante detectee, suppression..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Action: lancer le .bat
$action = New-ScheduledTaskAction -Execute $BatPath

# Trigger: tous les jours a 7h00
$trigger = New-ScheduledTaskTrigger -Daily -At $RunTime

# Settings: rejouer si l'ordi etait eteint, autoriser sur batterie, timeout 1h
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# Principal: Interactive = tourne quand l'utilisateur est loggé (pas besoin d'admin pour enregistrer)
# Le workstation de Dany est toujours allume + loggé, donc ca couvre 100% des cas
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Snapshot quotidien des reservistes RIUSC -> CSV dans snapshots/ + auto-commit/push" | Out-Null

if (-not $?) {
    Write-Host "ECHEC de l'enregistrement de la tache." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Tache '$TaskName' enregistree, prochaine execution a $RunTime."
Write-Host ""
Write-Host "Pour tester manuellement maintenant:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "Pour voir le statut:"
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
