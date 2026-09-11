param(
    [string]$TaskName = 'Academy Database Backup',
    [string]$At = '20:00',
    [string]$NodePath = (Get-Command node -ErrorAction Stop).Source
)
$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run-backup.ps1'
$expectedTimeZone = 'Pakistan Standard Time'
$actualTimeZone = [System.TimeZoneInfo]::Local.Id
if ($actualTimeZone -ne $expectedTimeZone) {
    throw "This task uses the computer's local clock. Set Windows time zone to '$expectedTimeZone' before installing the 8:00 PM Pakistan-time task. Current time zone: '$actualTimeZone'."
}
if ($NodePath.Contains('"') -or $runner.Contains('"')) { throw 'Unsupported quote in path' }
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Node executable not found' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $runner + '" -NodePath "' + $NodePath + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)
# Current user preserves access to that user's rclone configuration; no password is embedded.
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
# No -Force: do not silently replace an existing task.
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
Write-Output "Installed daily backup at $At Pakistan time for the current signed-in user. To run while signed out, configure the task account in Task Scheduler and test it there."
