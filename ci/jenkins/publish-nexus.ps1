<#
.SYNOPSIS
  Publishes the already-verified release bundle to a Nexus raw repository at an immutable path and re-verifies it.
.DESCRIPTION
  Only ever called from the Jenkinsfile's gated release stage (release branch + ENABLE_NEXUS_PUBLISH + input approval).
  Credentials arrive through Jenkins credentials binding as NEXUS_USER / NEXUS_PASSWORD (masked); nothing is hardcoded.
  Refuses to overwrite an existing asset, reads every file back, compares SHA-256, re-runs the integrity and customer
  verifiers against the downloaded copy, and rejects archives with unsafe member paths. Windows PowerShell 5.1 and 7.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectName,
  [Parameter(Mandatory = $true)][string]$Prefix
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $repoRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Invoke-Node {
  param([string]$Description, [string[]]$Arguments)
  & node @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit code $LASTEXITCODE)." }
}

foreach ($name in @('NEXUS_RAW_REPOSITORY_URL', 'NEXUS_USER', 'NEXUS_PASSWORD', 'BUILD_NUMBER', 'GIT_COMMIT')) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { throw "Required value $name is missing." }
}
$artifact = "$Prefix-build.tar.gz"
$manifest = "$Prefix-manifest.json"
$checksum = "$Prefix-build.tar.gz.sha256"
$policy = "$Prefix-manifest-ignore.json"
$policyChecksum = "$Prefix-manifest-ignore.json.sha256"
$policySig = "$Prefix-manifest-ignore.sig"
$publicKey = Join-Path $repoRoot '.manifest-ignore-public.pem'

$base = $env:NEXUS_RAW_REPOSITORY_URL.TrimEnd('/')
$repositoryUri = $null
if (-not [Uri]::TryCreate($base, [UriKind]::Absolute, [ref]$repositoryUri)) {
  throw 'NEXUS_RAW_REPOSITORY_URL must be a valid absolute HTTPS repository URL.'
}
if ($repositoryUri.Scheme -ne [Uri]::UriSchemeHttps -or
    [string]::IsNullOrWhiteSpace($repositoryUri.Host) -or
    -not [string]::IsNullOrEmpty($repositoryUri.UserInfo) -or
    -not [string]::IsNullOrEmpty($repositoryUri.Query) -or
    -not [string]::IsNullOrEmpty($repositoryUri.Fragment)) {
  throw 'NEXUS_RAW_REPOSITORY_URL must use HTTPS and must not contain embedded credentials, query parameters, or fragments.'
}
foreach ($required in @($artifact, $manifest, $checksum, $policy, $policyChecksum)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Verified release file is missing, refusing to publish: $required" }
}

$commit = $env:GIT_COMMIT.Substring(0, [Math]::Min(12, $env:GIT_COMMIT.Length))
$target = "$base/$($ProjectName.ToLowerInvariant())/$env:BUILD_NUMBER-$commit"
$pair = $env:NEXUS_USER + ':' + $env:NEXUS_PASSWORD
$headers = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair)) }
$verificationDir = Join-Path $repoRoot '.nexus-verify'
New-Item -ItemType Directory -Force -Path $verificationDir | Out-Null
try {
  $releaseFiles = @($artifact, $manifest, $checksum, $policy, $policyChecksum)
  if (Test-Path -LiteralPath $policySig -PathType Leaf) { $releaseFiles += $policySig }

  # Never silently replace an asset at an already-used release path: only a clean 404 proves it is free.
  foreach ($file in $releaseFiles) {
    $uri = "$target/$file"
    $statusCode = $null
    try {
      $existing = Invoke-WebRequest -Uri $uri -Method Head -Headers $headers -UseBasicParsing -ErrorAction Stop
      $statusCode = [int]$existing.StatusCode
    } catch {
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { $statusCode = [int]$_.Exception.Response.StatusCode }
      if ($statusCode -ne 404) { throw "Could not safely establish that Nexus release asset is absent: $uri (HTTP status: $statusCode). Publication stopped." }
    }
    if ($statusCode -ne 404) { throw "Refusing to overwrite existing Nexus release asset: $uri (HTTP $statusCode). Use a new build number or investigate the existing release." }
  }

  foreach ($file in $releaseFiles) {
    $uri = "$target/$file"
    Invoke-WebRequest -Uri $uri -Method Put -InFile $file -Headers $headers -UseBasicParsing | Out-Null
    $download = Join-Path $verificationDir $file
    Invoke-WebRequest -Uri $uri -Method Get -OutFile $download -Headers $headers -UseBasicParsing | Out-Null
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $download).Hash) {
      throw "Nexus read-back SHA-256 mismatch for $file."
    }
    Write-Output "Published and verified $file at immutable build path $env:BUILD_NUMBER-$commit"
  }

  $dArtifact = Join-Path $verificationDir $artifact
  $dManifest = Join-Path $verificationDir $manifest
  $dChecksum = Join-Path $verificationDir $checksum
  $dPolicy = Join-Path $verificationDir $policy
  $dPolicyChecksum = Join-Path $verificationDir $policyChecksum
  $dSig = Join-Path $verificationDir $policySig

  Invoke-Node 'Nexus read-back checksum verification' @('scripts/artifact-integrity.mjs', 'verify-hash', $dArtifact, $dChecksum)
  Invoke-Node 'Nexus read-back release verification' @('scripts/artifact-integrity.mjs', 'verify-release', $dArtifact, $dManifest, $dChecksum)

  # Inspect archive member paths before extraction to block path traversal.
  $archiveEntries = & tar -tzf $dArtifact
  if ($LASTEXITCODE -ne 0) { throw 'Could not list the downloaded Nexus package archive.' }
  foreach ($entry in $archiveEntries) {
    $normalizedEntry = ([string]$entry).Replace('\', '/')
    if ([string]::IsNullOrWhiteSpace($normalizedEntry) -or $normalizedEntry.StartsWith('/') -or
        $normalizedEntry -match '^[A-Za-z]:' -or ($normalizedEntry -split '/') -contains '..') {
      throw "Unsafe archive member path rejected: $entry"
    }
  }
  $downloadedPackageDir = Join-Path $verificationDir 'downloaded-package'
  New-Item -ItemType Directory -Force -Path $downloadedPackageDir | Out-Null
  & tar -xzf $dArtifact -C $downloadedPackageDir
  if ($LASTEXITCODE -ne 0) { throw 'Failed to extract the downloaded Nexus package.' }

  $trustedPolicyHash = ((Get-Content -LiteralPath $dPolicyChecksum -TotalCount 1).Trim() -split '\s+')[0]
  if ((Test-Path -LiteralPath $dSig -PathType Leaf) -and (Test-Path -LiteralPath $publicKey -PathType Leaf)) {
    Invoke-Node 'Nexus read-back policy signature verification' @('scripts/policy-signature.mjs', 'verify', $dPolicy, $dSig, $publicKey)
    Invoke-Node 'Nexus read-back signed customer release verification' @('scripts/customer-release-verifier.mjs', 'verify', $dPolicy, $dPolicyChecksum, $dManifest, $dArtifact, '-', $dSig, $publicKey)
  } else {
    Invoke-Node 'Nexus read-back customer release verification' @('scripts/customer-release-verifier.mjs', 'verify', $dPolicy, $dPolicyChecksum, $dManifest, $dArtifact, $trustedPolicyHash)
  }
} finally {
  Remove-Item -Recurse -Force -LiteralPath $verificationDir -ErrorAction SilentlyContinue
  Remove-Variable pair, headers -ErrorAction SilentlyContinue
}
exit 0
