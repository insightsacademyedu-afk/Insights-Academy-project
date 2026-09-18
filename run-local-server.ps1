$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:NODE_ENV = "development"
$env:SERVE_CLIENT = "true"
$env:CLIENT_URL = "http://127.0.0.1:5000"

$host.UI.RawUI.WindowTitle = "Academy Management"
Set-Location -LiteralPath $root

try {
  & node.exe (Join-Path $root "server/server.js")
  if ($LASTEXITCODE -ne 0) { throw "The server stopped with exit code $LASTEXITCODE." }
} catch {
  Write-Host "Academy Management could not start:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
