# ================================================================
# run-all-tests.ps1
# Lance unit tests + E2E tests + build, puis affiche un resume clair.
# Usage : .\scripts\run-all-tests.ps1
# ================================================================

$ErrorActionPreference = "Continue"
$startTime = Get-Date

# Aller a la racine du projet (le script est dans scripts/)
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LANCEMENT DES TESTS - Portail RIUSC" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$results = @{}

# ---------- 1. Unit Tests ----------
Write-Host "[1/3] Tests unitaires (vitest)..." -ForegroundColor Yellow
$unitLog = "$env:TEMP\riusc-unit-$(Get-Random).log"
npm test 2>&1 | Tee-Object -FilePath $unitLog | Out-Null
$results.Unit = @{
    Success  = $LASTEXITCODE -eq 0
    ExitCode = $LASTEXITCODE
    Log      = $unitLog
}
if ($results.Unit.Success) {
    Write-Host "      OK" -ForegroundColor Green
} else {
    Write-Host "      ECHEC" -ForegroundColor Red
}

# ---------- 2. E2E Tests ----------
Write-Host "[2/3] Tests E2E (playwright)..." -ForegroundColor Yellow
$e2eLog = "$env:TEMP\riusc-e2e-$(Get-Random).log"
npm run test:e2e 2>&1 | Tee-Object -FilePath $e2eLog | Out-Null
$results.E2E = @{
    Success  = $LASTEXITCODE -eq 0
    ExitCode = $LASTEXITCODE
    Log      = $e2eLog
}
if ($results.E2E.Success) {
    Write-Host "      OK" -ForegroundColor Green
} else {
    Write-Host "      ECHEC" -ForegroundColor Red
}

# ---------- 3. Build ----------
Write-Host "[3/3] Build Next.js..." -ForegroundColor Yellow
$buildLog = "$env:TEMP\riusc-build-$(Get-Random).log"
npm run build 2>&1 | Tee-Object -FilePath $buildLog | Out-Null
$results.Build = @{
    Success  = $LASTEXITCODE -eq 0
    ExitCode = $LASTEXITCODE
    Log      = $buildLog
}
if ($results.Build.Success) {
    Write-Host "      OK" -ForegroundColor Green
} else {
    Write-Host "      ECHEC" -ForegroundColor Red
}

# ---------- Extraire les stats ----------
$unitContent  = if (Test-Path $results.Unit.Log)  { Get-Content $results.Unit.Log -Raw }  else { "" }
$e2eContent   = if (Test-Path $results.E2E.Log)   { Get-Content $results.E2E.Log -Raw }   else { "" }
$buildContent = if (Test-Path $results.Build.Log) { Get-Content $results.Build.Log -Raw } else { "" }

# Nettoyer les codes ANSI puis essayer plusieurs formats vitest
$unitClean = $unitContent -replace "\x1b\[[0-9;]*[a-zA-Z]", ""
$unitStats = if ($unitClean -match "Tests\s+(\d+)\s+passed\s+\((\d+)\)") { "$($matches[1])/$($matches[2])" }
             elseif ($unitClean -match "Tests\s+(\d+)\s+passed")          { "$($matches[1]) passed" }
             elseif ($unitClean -match "(\d+)\s+passed\s*\|\s*\d+\s+skipped") { "$($matches[1]) passed" }
             else { "?" }
$e2eStats   = if ($e2eContent  -match "(\d+)\s+passed")                     { "$($matches[1]) passed" }    else { "?" }
$buildTime  = if ($buildContent -match "Compiled successfully in ([\d.]+)s") { "$($matches[1])s" }          else { "?" }

$elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

# ---------- Resume final ----------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESULTAT FINAL" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

function Show-Result($label, $res, $detail) {
    $status = if ($res.Success) { "  OK  " } else { "ECHEC " }
    $color  = if ($res.Success) { "Green" }  else { "Red" }
    Write-Host ("  [{0}] {1,-25} {2}" -f $status, $label, $detail) -ForegroundColor $color
}

Show-Result "Unit Tests"  $results.Unit  "($unitStats tests)"
Show-Result "E2E Tests"   $results.E2E   "($e2eStats)"
Show-Result "Build"       $results.Build "(compile en $buildTime)"

Write-Host ""
Write-Host "  Duree totale : $elapsed s" -ForegroundColor Gray
Write-Host ""

$allOk = $results.Unit.Success -and $results.E2E.Success -and $results.Build.Success

if ($allOk) {
    Write-Host "  >>> TOUT EST VERT - Tu peux pousser en toute confiance <<<" -ForegroundColor Green
    Write-Host ""
    # Nettoyage des logs
    Remove-Item $results.Unit.Log, $results.E2E.Log, $results.Build.Log -ErrorAction SilentlyContinue
    exit 0
} else {
    Write-Host "  >>> QUELQUE CHOSE A ECHOUE <<<" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Logs complets :" -ForegroundColor Yellow
    if (-not $results.Unit.Success)  { Write-Host "    Unit  : $($results.Unit.Log)"  -ForegroundColor Yellow }
    if (-not $results.E2E.Success)   { Write-Host "    E2E   : $($results.E2E.Log)"   -ForegroundColor Yellow }
    if (-not $results.Build.Success) { Write-Host "    Build : $($results.Build.Log)" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "  Ouvre le(s) log(s) ci-dessus et copie-colle le contenu a Claude." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
