<#
.SYNOPSIS
  Packages the build output and creates + verifies the integrity bundle (manifest, SHA-256, customer policy).
.DESCRIPTION
  Extracted from the Jenkinsfile so the exact same code runs locally and in Jenkins (Windows PowerShell 5.1 and 7).
  Fails closed on any error. Reads CI context from the standard Jenkins variables (GIT_COMMIT, GIT_URL, GIT_BRANCH,
  JOB_NAME, BUILD_TAG, BUILD_URL, BUILD_NUMBER) and falls back to git for commit/branch when they are missing.
  Output files: <Prefix>-build.tar.gz, <Prefix>-manifest.json, <Prefix>-build.tar.gz.sha256,
  <Prefix>-manifest-ignore.json, <Prefix>-manifest-ignore.json.sha256
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectName,
  [Parameter(Mandatory = $true)][string]$Prefix,
  [string]$OutputDirs = 'dist'
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $repoRoot

function Invoke-Native {
  param([string]$Description, [string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit code $LASTEXITCODE): $File $($Arguments -join ' ')" }
}
function Invoke-Node {
  param([string]$Description, [string[]]$Arguments)
  Invoke-Native $Description 'node' $Arguments
}

if (-not $env:GIT_COMMIT) { $env:GIT_COMMIT = (& git rev-parse HEAD).Trim() }
$branch = $env:GIT_BRANCH
if (-not $branch) { $branch = $env:BRANCH_NAME }
if (-not $branch) { throw 'No branch information (GIT_BRANCH/BRANCH_NAME) is available for release provenance.' }
$repository = $env:GIT_URL
if (-not $repository) { $repository = (& git config --get remote.origin.url).Trim() }
foreach ($required in @('JOB_NAME', 'BUILD_TAG', 'BUILD_URL', 'BUILD_NUMBER')) {
  if (-not [Environment]::GetEnvironmentVariable($required)) { throw "Jenkins variable $required is required for release provenance." }
}

$env:BUILD_REPOSITORY = $repository
$env:BUILD_BRANCH = $branch
$env:BUILD_WORKFLOW = $env:JOB_NAME
$env:BUILD_RUN_ID = $env:BUILD_TAG
$env:BUILD_RUN_URL = $env:BUILD_URL
$env:PROJECT_NAME = $ProjectName
$env:REQUIRE_BUILD_PROVENANCE = 'true'
if (-not $env:CUSTOMER_RELEASE_REPORT_PATH) { $env:CUSTOMER_RELEASE_REPORT_PATH = 'customer-release-report.json' }

$artifact = "$Prefix-build.tar.gz"
$manifest = "$Prefix-manifest.json"
$checksum = "$Prefix-build.tar.gz.sha256"
$policy = "$Prefix-manifest-ignore.json"
$policyChecksum = "$Prefix-manifest-ignore.json.sha256"

# Outputs are create-only ("wx" in the integrity tooling); remove leftovers from a previous attempt in this workspace.
foreach ($leftover in @($artifact, $manifest, $checksum, $policy, $policyChecksum)) {
  Remove-Item -Force -LiteralPath $leftover -ErrorAction SilentlyContinue
}

$artifactDir = @($OutputDirs -split '[,;]' | Where-Object { $_ } | Where-Object { Test-Path -LiteralPath $_ -PathType Container }) | Select-Object -First 1
if (-not $artifactDir) { throw "Build succeeded but no supported output directory ($OutputDirs) was found." }

Invoke-Native 'Release package creation' 'tar' @('-czf', $artifact, '-C', $artifactDir, '.')
Invoke-Node 'Manifest creation' @('scripts/artifact-integrity.mjs', 'create', $artifactDir, $manifest, $artifact)
Invoke-Node 'Manifest verification' @('scripts/artifact-integrity.mjs', 'verify', $artifactDir, $manifest, $artifact)
Invoke-Node 'Artifact hashing' @('scripts/artifact-integrity.mjs', 'hash', $artifact, $checksum)
Invoke-Node 'Artifact checksum verification' @('scripts/artifact-integrity.mjs', 'verify-hash', $artifact, $checksum)
Invoke-Node 'Release verification' @('scripts/artifact-integrity.mjs', 'verify-release', $artifact, $manifest, $checksum)
Invoke-Node 'Manifest-ignore policy creation' @('scripts/customer-release-verifier.mjs', 'create', $manifest, $artifact, $policy)
Invoke-Node 'Manifest-ignore policy hashing' @('scripts/artifact-integrity.mjs', 'hash', $policy, $policyChecksum)
$trustedPolicyHash = ((Get-Content -LiteralPath $policyChecksum -TotalCount 1).Trim() -split '\s+')[0]
if ($trustedPolicyHash -notmatch '^[0-9a-fA-F]{64}$') { throw "Unexpected policy checksum format in $policyChecksum." }
Invoke-Node 'Customer release verification' @('scripts/customer-release-verifier.mjs', 'verify', $policy, $policyChecksum, $manifest, $artifact, $trustedPolicyHash)
Write-Host "Release bundle verified: $artifact (from '$artifactDir'), $manifest, $checksum, $policy, $policyChecksum"
exit 0
