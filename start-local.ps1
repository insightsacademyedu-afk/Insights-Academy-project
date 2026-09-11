$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$escapedRoot = $root.Replace("'", "''")

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$escapedRoot'; $Command"
  ) | Out-Null
}

try {
  Get-Command node.exe -ErrorAction Stop | Out-Null
  Get-Command npm.cmd -ErrorAction Stop | Out-Null
} catch {
  Write-Error "Node.js and npm are required. Install Node.js 22.12 or newer, then run this file again."
  Read-Host "Press Enter to close"
  exit 1
}

Start-DevWindow -Title "Academy Management - Backend" -Command "npm --prefix server run dev"
Start-DevWindow -Title "Academy Management - Frontend" -Command "npm --prefix client run dev"

$apiReady = $false
$webReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  try {
    $apiReady = (Invoke-WebRequest -UseBasicParsing "http://localhost:5000/api/health" -TimeoutSec 2).StatusCode -eq 200
  } catch { $apiReady = $false }

  try {
    $webReady = (Invoke-WebRequest -UseBasicParsing "http://localhost:5173/" -TimeoutSec 2).StatusCode -eq 200
  } catch { $webReady = $false }

  if ($apiReady -and $webReady) {
    Start-Process "http://localhost:5173/"
    Write-Host "Academy Management is running at http://localhost:5173/" -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Seconds 1
}

Write-Warning "The services did not both become ready. Check the Backend and Frontend windows for the error."
Read-Host "Press Enter to close"