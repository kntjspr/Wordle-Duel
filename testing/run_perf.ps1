param([switch]$StartBackend)

$ErrorActionPreference = "Stop"
$root    = Split-Path $MyInvocation.MyCommand.Path
$backend = Join-Path $root "..\Backend"
$perf    = Join-Path $backend "cmd\perf"
$report  = Join-Path $root "performance-report.html"

Write-Host ""
Write-Host "  Wordle Duel - Performance Test Runner" -ForegroundColor Cyan
Write-Host "  --------------------------------------" -ForegroundColor DarkGray
Write-Host ""

if ($StartBackend) {
    Write-Host "  Starting backend..." -ForegroundColor DarkGray
    Start-Job -ScriptBlock { Set-Location $using:backend; go run . } | Out-Null
    Write-Host "  Waiting for backend to compile (up to 30s)..." -ForegroundColor DarkGray
    $started = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep 2
        try {
            Invoke-RestMethod "http://localhost:8080/health" -TimeoutSec 1 | Out-Null
            $started = $true
            break
        } catch {}
    }
    if (-not $started) {
        Write-Host "  FAILED: Backend did not start in time." -ForegroundColor Red
        exit 1
    }
}

try {
    $health = Invoke-RestMethod "http://localhost:8080/health" -TimeoutSec 3
    Write-Host "  OK: Backend is running ($($health.service))" -ForegroundColor Green
} catch {
    Write-Host "  FAILED: Backend not reachable on :8080" -ForegroundColor Red
    Write-Host "    Option 1: cd Backend; go run ." -ForegroundColor Yellow
    Write-Host "    Option 2: .\run_perf.ps1 -StartBackend" -ForegroundColor Yellow
    exit 1
}

Write-Host "  Running load test (takes ~60s)..." -ForegroundColor Cyan
Write-Host ""

Push-Location $perf
try {
    go run -mod=vendor . -output $report 2>&1
    Write-Host ""
    if (Test-Path $report) {
        Write-Host "  DONE: Report saved to $report" -ForegroundColor Green
        Start-Process $report
    }
} finally {
    Pop-Location
}
