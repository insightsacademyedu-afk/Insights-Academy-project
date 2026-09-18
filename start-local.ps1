$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverLauncher = Join-Path $root "run-local-server.ps1"

try {
  Get-Command node.exe -ErrorAction Stop | Out-Null
  Get-Command npm.cmd -ErrorAction Stop | Out-Null
} catch {
  Write-Error "Node.js and npm are required. Install Node.js 22.12 or newer, then run this file again."
  Read-Host "Press Enter to close"
  exit 1
}

Set-Location -LiteralPath $root
Write-Host "Preparing the optimized local app..." -ForegroundColor Cyan
& npm.cmd --prefix client run build
if ($LASTEXITCODE -ne 0) { throw "The app build failed." }

$serverArguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$serverLauncher`""
Start-Process powershell.exe -ArgumentList $serverArguments | Out-Null

$apiReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  try {
    $apiReady = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5000/api/health" -TimeoutSec 2).StatusCode -eq 200
  } catch { $apiReady = $false }

  if ($apiReady) {
    Start-Process "http://127.0.0.1:5000/"
    Write-Host "Academy Management is running at http://127.0.0.1:5000/" -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Seconds 1
}

Write-Warning "The app did not become ready. Check the Academy Management window for the error."
Read-Host "Press Enter to close"
