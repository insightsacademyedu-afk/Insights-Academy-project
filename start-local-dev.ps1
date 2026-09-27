$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendUrl = "http://localhost:5173"

$backendCommand = "Set-Location -LiteralPath '$root'; `$env:NODE_ENV='development'; `$env:SERVE_CLIENT='false'; `$env:CLIENT_URL='$frontendUrl'; npm.cmd --prefix server start"
$frontendCommand = "Set-Location -LiteralPath '$root'; npm.cmd --prefix client run dev -- --host 127.0.0.1"

Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", $backendCommand
) | Out-Null

Start-Process powershell.exe -WorkingDirectory $root -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", $frontendCommand
) | Out-Null

Start-Process $frontendUrl | Out-Null
Write-Host "Backend: http://127.0.0.1:5000"
Write-Host "Frontend: $frontendUrl"
