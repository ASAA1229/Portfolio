<#
.SYNOPSIS
  Validates the Windows Jenkins agent prerequisites for this repository and prints a status table.

.DESCRIPTION
  Same interface and behaviour in every ASAA1229 repo (kept self-contained per repo on purpose).
  Works under Windows PowerShell 5.1 (what the Jenkins "powershell" step and "powershell.exe -File" use)
  and PowerShell 7. Fails closed: exits 1 when any required prerequisite is missing or too old.
  It never installs or modifies anything on the machine.

  Recommended invocation from a Jenkinsfile (real exit code, no profile, no wrapper):
    bat 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ci\jenkins\agent-prereqs.ps1 -Require node,npm,git'

.PARAMETER Require
  Comma-separated list of checks: node, npm, git, tar, python, browser, docker, postgres, workspace, lockfile.
  ("-File" passes the list as one string, so both "node,npm" and an array are accepted.)

.PARAMETER NodeRange / NpmRange
  Semver range such as ">=24.0.0 <25". When empty the "engines" field of package.json is used.

.PARAMETER PythonMin
  Minimum Python version (default 3.11).

.PARAMETER PythonEnvVars
  Environment variables (in priority order) that may hold an explicit interpreter path.
  Resolution order: those variables, then python3/python on PATH, then "py -3". The version is
  verified by actually running the interpreter.

.PARAMETER PythonExportFile
  When set, the resolved interpreter path is written there (read it back with readFile in a Jenkinsfile).

.PARAMETER ReportFile
  When set, a JSON report with every row of the table is written there (archive it as a build artifact).
#>
[CmdletBinding()]
param(
  [string[]]$Require = @('node', 'npm', 'git'),
  [string]$PackageJson = '',
  [string]$NodeRange = '',
  [string]$NpmRange = '',
  [string]$PythonMin = '3.11',
  [string]$PythonEnvVars = 'ASAA_PYTHON,PYTHON',
  [string]$PythonExportFile = '',
  [string]$ReportFile = ''
)

$ErrorActionPreference = 'Stop'
$requireSet = @($Require | ForEach-Object { $_ -split '[,;\s]+' } | Where-Object { $_ } | ForEach-Object { $_.ToLowerInvariant() })
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $PackageJson) { $PackageJson = Join-Path $repoRoot 'package.json' }
$rows = New-Object System.Collections.ArrayList

function Add-Row {
  param([string]$Tool, [string]$Required, [string]$Detected, [string]$Path, [string]$Status, [string]$Remediation = '')
  [void]$rows.Add([pscustomobject]@{
      Tool = $Tool; Required = $Required; Detected = $Detected; Path = $Path; Status = $Status; Remediation = $Remediation
    })
}

function ConvertTo-QuotedArgument {
  param([string]$Value)
  if ($Value -eq '') { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  $escaped = $Value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  return '"' + $escaped + '"'
}

# Runs a program with a hard timeout and captures exit code, stdout and stderr (no PowerShell error records).
function Invoke-Probe {
  param([string]$File, [string[]]$ArgumentList = @(), [int]$TimeoutSec = 30)
  $result = [pscustomobject]@{ ExitCode = $null; StdOut = ''; StdErr = ''; TimedOut = $false; Error = '' }
  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $File
    $psi.Arguments = (($ArgumentList | ForEach-Object { ConvertTo-QuotedArgument $_ }) -join ' ')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($psi)
    $process.StandardInput.Close()
    $outTask = $process.StandardOutput.ReadToEndAsync()
    $errTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutSec * 1000)) {
      $result.TimedOut = $true
      try { & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null } catch { }
      try { $process.Kill() } catch { }
    } else {
      $process.WaitForExit()
      $result.ExitCode = $process.ExitCode
    }
    $result.StdOut = [string]$outTask.Result
    $result.StdErr = [string]$errTask.Result
  } catch {
    $result.Error = $_.Exception.Message
  }
  return $result
}

function Get-ToolPath {
  param([string]$Name)
  $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { return $command.Source }
  return $null
}

function ConvertTo-Version {
  param([string]$Text)
  $match = [regex]::Match($Text, '(\d+)(?:\.(\d+))?(?:\.(\d+))?')
  if (-not $match.Success) { return $null }
  $minor = 0; $patch = 0
  if ($match.Groups[2].Success) { $minor = [int]$match.Groups[2].Value }
  if ($match.Groups[3].Success) { $patch = [int]$match.Groups[3].Value }
  return New-Object System.Version ([int]$match.Groups[1].Value), $minor, $patch
}

# Minimal npm-style semver range evaluator: comparators (>=, >, <=, <, =), bare versions, "||" alternatives.
function Test-VersionRange {
  param([System.Version]$Version, [string]$Range)
  foreach ($alternative in ($Range -split '\|\|')) {
    $ok = $true
    $tokens = @(([regex]::Matches($alternative.Trim(), '(>=|<=|>|<|=|\^|~)?\s*v?\d+(?:\.\d+){0,2}[\w.+-]*') | ForEach-Object { $_.Value }))
    if ($tokens.Count -eq 0) { $ok = $false }
    foreach ($token in $tokens) {
      $m = [regex]::Match($token, '^(>=|<=|>|<|=|\^|~)?\s*v?(.+)$')
      $op = $m.Groups[1].Value
      $target = ConvertTo-Version $m.Groups[2].Value
      if (-not $target) { $ok = $false; continue }
      switch ($op) {
        '>=' { if ($Version -lt $target) { $ok = $false } }
        '>'  { if ($Version -le $target) { $ok = $false } }
        '<=' { if ($Version -gt $target) { $ok = $false } }
        '<'  { if ($Version -ge $target) { $ok = $false } }
        '^'  { if ($Version -lt $target -or $Version.Major -ne $target.Major) { $ok = $false } }
        '~'  { if ($Version -lt $target -or $Version.Major -ne $target.Major -or $Version.Minor -ne $target.Minor) { $ok = $false } }
        default { if ($Version -ne $target) { $ok = $false } }
      }
    }
    if ($ok) { return $true }
  }
  return $false
}

function Get-Engines {
  if (-not (Test-Path -LiteralPath $PackageJson -PathType Leaf)) { return $null }
  try { return (Get-Content -LiteralPath $PackageJson -Raw | ConvertFrom-Json).engines } catch { return $null }
}
$engines = Get-Engines

function Test-VersionedTool {
  param([string]$Row, [string]$Command, [string[]]$VersionArgs, [string]$ExplicitRange, [string]$EngineKey, [string]$Remediation)
  $range = $ExplicitRange
  if (-not $range -and $engines -and $engines.PSObject.Properties[$EngineKey]) { $range = [string]$engines.$EngineKey }
  $requiredText = 'any'
  if ($range) { $requiredText = $range }
  $path = Get-ToolPath $Command
  if (-not $path) { Add-Row $Row $requiredText '(not found)' '' 'FAIL' $Remediation; return }
  $probe = Invoke-Probe -File $path -ArgumentList $VersionArgs -TimeoutSec 60
  $version = ConvertTo-Version $probe.StdOut
  if ($probe.ExitCode -ne 0 -or -not $version) {
    Add-Row $Row $requiredText "(failed to run, exit $($probe.ExitCode) $($probe.Error))" $path 'FAIL' $Remediation
    return
  }
  if ($range -and -not (Test-VersionRange $version $range)) {
    Add-Row $Row $requiredText $version.ToString() $path 'FAIL' $Remediation
    return
  }
  Add-Row $Row $requiredText $version.ToString() $path 'OK'
}

function Test-PythonInterpreter {
  param([string]$Exe, [string[]]$Prefix = @())
  $code = 'import sys; print("%d.%d.%d" % sys.version_info[:3]); print(sys.executable)'
  $probe = Invoke-Probe -File $Exe -ArgumentList ($Prefix + @('-c', $code)) -TimeoutSec 30
  if ($probe.ExitCode -ne 0 -or $probe.TimedOut) {
    $why = "exit $($probe.ExitCode)"
    if ($probe.TimedOut) { $why = 'timed out' }
    if ($probe.Error) { $why = $probe.Error }
    return [pscustomobject]@{ Ok = $false; Version = $null; Executable = $Exe; Detail = "could not run ($why)" }
  }
  $lines = @($probe.StdOut -split "\r?\n" | Where-Object { $_.Trim() })
  if ($lines.Count -lt 2) { return [pscustomobject]@{ Ok = $false; Version = $null; Executable = $Exe; Detail = 'unexpected output' } }
  return [pscustomobject]@{ Ok = $true; Version = (ConvertTo-Version $lines[0]); Executable = $lines[1].Trim(); Detail = $lines[0].Trim() }
}

function Test-Python {
  $minimum = ConvertTo-Version $PythonMin
  $remediation = "Install Python $PythonMin+ machine-wide (e.g. Python 3.12 'for all users' with 'Add to PATH', or 'winget install Python.Python.3.12 --scope machine') " +
    "and restart the Jenkins service, or set a Jenkins global environment variable ($(($PythonEnvVars -split ',')[0])) to an interpreter path readable by the agent account."
  $attempts = New-Object System.Collections.ArrayList
  $accepted = $null

  # 1. Explicit Jenkins-configured interpreter. A configured-but-broken value fails closed (never silently ignored).
  foreach ($name in ($PythonEnvVars -split '[,;\s]+' | Where-Object { $_ })) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    $value = $value.Trim().Trim('"')
    if (-not (Test-Path -LiteralPath $value -PathType Leaf)) {
      Add-Row 'python' ">= $PythonMin" "(`$env:$name does not point to a file)" $value 'FAIL' "Fix `$env:$name (Jenkins > Manage Jenkins > System > Global properties) to the full path of python.exe. $remediation"
      return
    }
    $info = Test-PythonInterpreter $value
    if (-not $info.Ok -or $info.Version -lt $minimum) {
      $detected = $info.Detail
      Add-Row 'python' ">= $PythonMin" "(`$env:$name -> $detected)" $value 'FAIL' "`$env:$name points to an unusable or too-old interpreter. $remediation"
      return
    }
    $accepted = $info; $info | Add-Member -NotePropertyName Source -NotePropertyValue "`$env:$name" -Force
    break
  }

  # 2. python3 / python on PATH (each verified by running it; the Microsoft Store stub fails here).
  if (-not $accepted) {
    foreach ($name in @('python3', 'python')) {
      foreach ($command in @(Get-Command $name -CommandType Application -All -ErrorAction SilentlyContinue)) {
        $info = Test-PythonInterpreter $command.Source
        if ($info.Ok -and $info.Version -ge $minimum) { $accepted = $info; $info | Add-Member -NotePropertyName Source -NotePropertyValue 'PATH' -Force; break }
        [void]$attempts.Add("$($command.Source): $($info.Detail)")
      }
      if ($accepted) { break }
    }
  }

  # 3. The py launcher (note: under LocalSystem it only sees machine-wide registrations).
  if (-not $accepted) {
    $launcher = Get-ToolPath 'py'
    if ($launcher) {
      $info = Test-PythonInterpreter $launcher @('-3')
      if ($info.Ok -and $info.Version -ge $minimum) { $accepted = $info; $info | Add-Member -NotePropertyName Source -NotePropertyValue 'py -3' -Force }
      else { [void]$attempts.Add("py -3: $($info.Detail)") }
    }
  }

  if (-not $accepted) {
    $detected = '(none usable)'
    if ($attempts.Count -gt 0) { $detected = 'rejected: ' + ($attempts -join '; ') }
    Add-Row 'python' ">= $PythonMin" $detected '' 'FAIL' $remediation
    return
  }
  Add-Row 'python' ">= $PythonMin" $accepted.Version.ToString() $accepted.Executable 'OK' "(resolved via $($accepted.Source))"
  if ($PythonExportFile) {
    $dir = Split-Path -Parent $PythonExportFile
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [IO.File]::WriteAllText($PythonExportFile, $accepted.Executable, (New-Object System.Text.UTF8Encoding($false)))
  }
}

function Find-FirstExistingPath {
  param([string[]]$Candidates)
  foreach ($candidate in $Candidates) { if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate } }
  return $null
}

# Launches a browser headlessly against about:blank with a private profile in the workspace temp dir.
function Test-BrowserLaunch {
  param([string]$Exe, [string[]]$ExtraArgs)
  $profileRoot = $env:TEMP
  if ($env:WORKSPACE) { $profileRoot = Join-Path $env:WORKSPACE '.jenkins-temp' }
  New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null
  $profile = Join-Path $profileRoot ('prereq-browser-' + [Guid]::NewGuid().ToString('N'))
  try {
    $browserArgs = @("--user-data-dir=$profile", '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-extensions', '--dump-dom') + $ExtraArgs + @('about:blank')
    $probe = Invoke-Probe -File $Exe -ArgumentList $browserArgs -TimeoutSec 45
    if ($probe.TimedOut) { return [pscustomobject]@{ Ok = $false; Detail = 'launch timed out' } }
    if ($probe.ExitCode -eq 0 -and $probe.StdOut -match '<html') { return [pscustomobject]@{ Ok = $true; Detail = 'headless launch OK' } }
    $stderr = ($probe.StdErr -replace '\s+', ' ').Trim()
    if ($stderr.Length -gt 160) { $stderr = $stderr.Substring(0, 160) }
    return [pscustomobject]@{ Ok = $false; Detail = "launch failed (exit $($probe.ExitCode)) $($probe.Error) $stderr" }
  } finally {
    Remove-Item -Recurse -Force -LiteralPath $profile -ErrorAction SilentlyContinue
  }
}

function Test-Browser {
  $remediation = 'Run "npx playwright-core install chromium-headless-shell" (set PLAYWRIGHT_BROWSERS_PATH to a writable folder), or set BROWSER_PATH/EDGE_PATH to a browser the agent account can launch headlessly. ' +
    'Prefer running the Jenkins service as a dedicated local user instead of LocalSystem.'
  $usable = New-Object System.Collections.ArrayList

  $explicit = $env:BROWSER_PATH
  if (-not $explicit) { $explicit = $env:EDGE_PATH }
  $edge = Find-FirstExistingPath @(
    $explicit,
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
  )
  if ($edge) {
    $launch = Test-BrowserLaunch $edge @('--headless=new')
    $status = 'WARN'; if ($launch.Ok) { $status = 'OK'; [void]$usable.Add($edge) }
    Add-Row 'browser: Microsoft Edge' 'any one browser' $launch.Detail $edge $status 'Edge may refuse to start under LocalSystem/session 0; the Playwright headless shell is the supported fallback.'
  } else {
    Add-Row 'browser: Microsoft Edge' 'any one browser' '(not installed)' '' 'SKIP'
  }

  $shell = $null
  $browsersRoot = $env:PLAYWRIGHT_BROWSERS_PATH
  if (-not $browsersRoot -and $env:LOCALAPPDATA) { $browsersRoot = Join-Path $env:LOCALAPPDATA 'ms-playwright' }
  if ($browsersRoot -and (Test-Path -LiteralPath $browsersRoot -PathType Container)) {
    $shell = Get-ChildItem -LiteralPath $browsersRoot -Directory -Filter 'chromium_headless_shell-*' -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('chrome-headless-shell.exe', 'headless_shell.exe') } } |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if ($shell) {
    $launch = Test-BrowserLaunch $shell @('--no-sandbox')
    $status = 'WARN'; if ($launch.Ok) { $status = 'OK'; [void]$usable.Add($shell) }
    Add-Row 'browser: Playwright chromium-headless-shell' 'any one browser' $launch.Detail $shell $status 'Re-run "npx playwright-core install chromium-headless-shell".'
  } else {
    Add-Row 'browser: Playwright chromium-headless-shell' 'any one browser' '(not installed)' "$browsersRoot" 'SKIP' 'npx playwright-core install chromium-headless-shell'
  }

  if ($usable.Count -gt 0) {
    Add-Row 'browser (gate)' 'at least one launchable' "$($usable.Count) launchable" $usable[0] 'OK'
  } else {
    Add-Row 'browser (gate)' 'at least one launchable' '(none launchable)' '' 'FAIL' $remediation
  }
}

# ---- run the requested checks -------------------------------------------------------------------------
if ($requireSet -contains 'node') {
  Test-VersionedTool 'node' 'node' @('--version') $NodeRange 'node' 'Install the Node.js version required by package.json engines machine-wide and make sure it is on the Jenkins service PATH.'
}
if ($requireSet -contains 'npm') {
  Test-VersionedTool 'npm' 'npm' @('--version') $NpmRange 'npm' 'Upgrade npm (npm install -g npm@<required>) or install a Node.js release that bundles the required npm.'
}
if ($requireSet -contains 'git') {
  Test-VersionedTool 'git' 'git' @('--version') '' 'git' 'Install Git for Windows machine-wide and add it to the Jenkins service PATH.'
}
if ($requireSet -contains 'tar') {
  Test-VersionedTool 'tar' 'tar' @('--version') '' 'tar' 'Windows 10+ ships bsdtar in System32; make sure C:\Windows\System32 is on PATH.'
}
if ($requireSet -contains 'python') { Test-Python }
if ($requireSet -contains 'docker') {
  $docker = Get-ToolPath 'docker'
  if (-not $docker) {
    Add-Row 'docker' 'running engine' '(not found)' '' 'FAIL' 'Install Docker Desktop and start it, and make sure the Jenkins account can reach the Docker named pipe.'
  } else {
    $probe = Invoke-Probe -File $docker -ArgumentList @('version', '--format', '{{.Server.Version}}') -TimeoutSec 60
    if ($probe.ExitCode -eq 0 -and $probe.StdOut.Trim()) { Add-Row 'docker' 'running engine' $probe.StdOut.Trim() $docker 'OK' }
    else { Add-Row 'docker' 'running engine' '(engine not reachable)' $docker 'FAIL' 'Start Docker Desktop and grant the Jenkins service account access to the Docker engine.' }
  }
}
if ($requireSet -contains 'postgres') {
  foreach ($name in @('initdb', 'pg_ctl', 'psql')) {
    $path = Get-ToolPath $name
    if (-not $path) { Add-Row $name 'PostgreSQL client/server tools' '(not found)' '' 'FAIL' 'Install PostgreSQL and add its bin folder to the machine PATH of the Jenkins service.'; continue }
    $probe = Invoke-Probe -File $path -ArgumentList @('--version') -TimeoutSec 30
    $status = 'FAIL'; if ($probe.ExitCode -eq 0) { $status = 'OK' }
    Add-Row $name 'PostgreSQL client/server tools' $probe.StdOut.Trim() $path $status 'Reinstall PostgreSQL or fix PATH.'
  }
}
if ($requireSet -contains 'lockfile') {
  $lock = Join-Path $repoRoot 'package-lock.json'
  if (Test-Path -LiteralPath $lock -PathType Leaf) { Add-Row 'package-lock.json' 'lockfile' 'present' $lock 'OK' }
  else { Add-Row 'package-lock.json' 'lockfile' '(missing)' $lock 'OK' 'Lockfile policy: package-lock.json is generated by npm install and is not committed.' }
}
if ($requireSet -contains 'workspace') {
  $targets = @($repoRoot)
  if ($env:TEMP) { $targets += $env:TEMP }
  foreach ($target in $targets) {
    $probeFile = Join-Path $target ('.agent-write-test-' + [Guid]::NewGuid().ToString('N'))
    try {
      [IO.File]::WriteAllText($probeFile, 'ok')
      Remove-Item -Force -LiteralPath $probeFile
      Add-Row 'writable directory' 'read/write' 'writable' $target 'OK'
    } catch {
      Add-Row 'writable directory' 'read/write' "not writable: $($_.Exception.Message)" $target 'FAIL' 'Grant the Jenkins account modify rights on the workspace and TEMP, or fix the TEMP variable.'
    }
  }
}
if ($requireSet -contains 'browser') { Test-Browser }

# ---- report -------------------------------------------------------------------------------------------
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Host "Agent prerequisites for $(Split-Path -Leaf $repoRoot) | account: $identity | PowerShell $($PSVersionTable.PSVersion) | host: $env:COMPUTERNAME"
Write-Host (($rows | Select-Object Tool, Required, Detected, Path, Status, Remediation | Format-Table -AutoSize -Wrap | Out-String -Width 400).TrimEnd())

if ($ReportFile) {
  $dir = Split-Path -Parent $ReportFile
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $report = [pscustomobject]@{ account = $identity; powershell = $PSVersionTable.PSVersion.ToString(); machine = $env:COMPUTERNAME; rows = @($rows) }
  [IO.File]::WriteAllText($ReportFile, ($report | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
}

$failed = @($rows | Where-Object { $_.Status -eq 'FAIL' })
if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host "PREREQUISITES FAILED ($($failed.Count)):"
  foreach ($row in $failed) { Write-Host " - $($row.Tool): required $($row.Required); detected $($row.Detected). $($row.Remediation)" }
  exit 1
}
Write-Host 'All required agent prerequisites are satisfied.'
exit 0
