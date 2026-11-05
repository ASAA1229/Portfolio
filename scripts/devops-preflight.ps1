# Preflight checks for the Windows Jenkins agent used by this repository.
$ErrorActionPreference = 'Stop'

$requiredCommands = @('node', 'npm', 'git', 'tar')
foreach ($commandName in $requiredCommands) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Required command '$commandName' was not found on this Jenkins agent. Install it or correct PATH."
  }
}

$lockFile = Join-Path $PSScriptRoot '..\package-lock.json'
if (-not (Test-Path -LiteralPath $lockFile -PathType Leaf)) {
  throw "package-lock.json is missing. npm ci requires a committed npm lockfile."
}

$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the Node.js version.' }
$npmVersion = (& npm --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the npm version.' }
$gitVersion = (& git --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the Git version.' }
$tarVersion = (& tar --version | Select-Object -First 1).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the tar version.' }


Write-Output "Agent preflight passed: Node $nodeVersion; npm $npmVersion; $gitVersion; $tarVersion." 
