$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = "C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg"
$configBackup = "$configPath.pre-academy-replica-set.bak"
$logPath = Join-Path $root "mongodb-replica-setup.log"

try {
  if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must be run as Administrator. Right-click it and choose Run with PowerShell, then accept the administrator prompt."
  }
  if (-not (Test-Path -LiteralPath $configPath)) { throw "MongoDB configuration was not found at $configPath" }

  $content = Get-Content -LiteralPath $configPath -Raw
  if ($content -notmatch '(?m)^replication:\s*$') {
    if (-not (Test-Path -LiteralPath $configBackup)) { Copy-Item -LiteralPath $configPath -Destination $configBackup }
    Add-Content -LiteralPath $configPath -Value "`r`nreplication:`r`n  replSetName: academy-rs`r`n"
  } elseif ($content -notmatch '(?m)^\s+replSetName:\s*academy-rs\s*$') {
    throw "The MongoDB configuration already has different replication settings. No automatic change was made."
  }

  Restart-Service -Name MongoDB -Force
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    if ((Get-Service -Name MongoDB).Status -eq 'Running') { break }
    Start-Sleep -Seconds 1
  }
  & node.exe (Join-Path $root "scripts/init-local-replica-set.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Replica-set initialization failed with exit code $LASTEXITCODE." }

  "SUCCESS: MongoDB replica set academy-rs is ready. You can run start-local.cmd." | Set-Content -LiteralPath $logPath
  Write-Host "MongoDB is ready for Academy Management transactions." -ForegroundColor Green
} catch {
  "FAILED: $($_.Exception.Message)" | Set-Content -LiteralPath $logPath
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
