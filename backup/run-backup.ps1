param([string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$backupRoot = $PSScriptRoot
$logDir = Join-Path $backupRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ('backup-' + (Get-Date -Format 'yyyy-MM-dd') + '.log')
try {
    & $NodePath (Join-Path $backupRoot 'backup.mjs') *>> $logFile
    $backupExit = $LASTEXITCODE
    if ($backupExit -ne 0) { exit $backupExit }
    & $NodePath (Join-Path $backupRoot 'verify-latest.mjs') *>> $logFile
    exit $LASTEXITCODE
} catch {
    'Backup runner failed. Check Node path and folder permissions.' | Add-Content -LiteralPath $logFile
    exit 1
}
