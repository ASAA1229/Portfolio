pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  environment {
    PROJECT_NAME = 'portfolio'
    REQUIRE_BUILD_PROVENANCE = 'true'
    ARTIFACT_FILE = 'portfolio-build.tar.gz'
    MANIFEST_FILE = 'portfolio-manifest.json'
    CHECKSUM_FILE = 'portfolio-build.tar.gz.sha256'
    CUSTOMER_RELEASE_REPORT_PATH = 'customer-release-report.json'
  }
  parameters {
    booleanParam(name: 'ENABLE_NEXUS_PUBLISH', defaultValue: false, description: 'Nexus publishing is paused; enable only after explicit approval and configuration.')
    booleanParam(name: 'ENABLE_POLICY_SIGNING', defaultValue: false, description: 'Sign manifest-ignore with the configured Ed25519 Jenkins credentials.')
  }
  stages {
    stage('Checkout') {
      steps {
        deleteDir()
        checkout scm
      }
    }
    stage('Agent prerequisites') {
      steps {
        powershell -ExecutionPolicy Bypass -File scripts/devops-preflight.ps1
      }
    }
    stage('Install locked dependencies') {
      steps {
        bat 'node --version'
        bat 'npm --version'
        bat 'npm ci'
        bat 'npm sbom --sbom-format=cyclonedx --output-file=portfolio-dependencies.cdx.json'
      }
    }
    stage('Build') {
      steps {
        bat 'npm run build'
      }
    }
    stage('Package and verify integrity') {
      steps {
        powershell '''
          $ErrorActionPreference = "Stop"
          function Invoke-Node {
            & node @args
            if ($LASTEXITCODE -ne 0) {
              throw "Node command failed: node $($args -join ' ') (exit code $LASTEXITCODE)."
            }
          }
          $env:BUILD_REPOSITORY = $env:GIT_URL
          $env:BUILD_BRANCH = $env:GIT_BRANCH
          $env:BUILD_WORKFLOW = $env:JOB_NAME
          $env:BUILD_RUN_ID = $env:BUILD_TAG
          $env:BUILD_RUN_URL = $env:BUILD_URL
          $artifactDir = @(".output", "dist") | Where-Object { Test-Path $_ -PathType Container } | Select-Object -First 1
          if (!$artifactDir) {
            throw "Build succeeded but no supported output directory (.output or dist) was found."
          }
          tar -czf "$env:ARTIFACT_FILE" -C "$artifactDir" .
          if ($LASTEXITCODE -ne 0) { throw "Release package creation failed." }
          $env:PROJECT_NAME = "portfolio"
          Invoke-Node scripts/artifact-integrity.mjs create "$artifactDir" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE"
          Invoke-Node scripts/artifact-integrity.mjs verify "$artifactDir" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE"
          Invoke-Node scripts/artifact-integrity.mjs hash "$env:ARTIFACT_FILE" "$env:CHECKSUM_FILE"
          Invoke-Node scripts/artifact-integrity.mjs verify-hash "$env:ARTIFACT_FILE" "$env:CHECKSUM_FILE"
          Invoke-Node scripts/artifact-integrity.mjs verify-release "$env:ARTIFACT_FILE" "$env:MANIFEST_FILE" "$env:CHECKSUM_FILE"
          Invoke-Node scripts/customer-release-verifier.mjs create "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE" "portfolio-manifest-ignore.json"
          Invoke-Node scripts/artifact-integrity.mjs hash "portfolio-manifest-ignore.json" "portfolio-manifest-ignore.json.sha256"
          $trustedPolicyHash = (Get-Content "portfolio-manifest-ignore.json.sha256").Split(' ')[0]
          Invoke-Node scripts/customer-release-verifier.mjs verify "portfolio-manifest-ignore.json" "portfolio-manifest-ignore.json.sha256" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE" $trustedPolicyHash
'''
      }
    }
    stage('Archive verified release bundle') {
      steps {
        archiveArtifacts artifacts: 'portfolio-build.tar.gz,portfolio-manifest.json,portfolio-build.tar.gz.sha256,portfolio-manifest-ignore.json,portfolio-manifest-ignore.json.sha256,portfolio-dependencies.cdx.json', fingerprint: true, onlyIfSuccessful: true
      }
    }
    stage('Sign manifest-ignore policy (optional)') {
      when {
        expression { return params.ENABLE_POLICY_SIGNING }
      }
      steps {
        withCredentials([
          string(credentialsId: 'manifest-ignore-private-key', variable: 'MANIFEST_IGNORE_PRIVATE_KEY'),
          string(credentialsId: 'manifest-ignore-public-key', variable: 'MANIFEST_IGNORE_PUBLIC_KEY')
        ]) {
          powershell '''
            $ErrorActionPreference = "Stop"
            if ([string]::IsNullOrWhiteSpace($env:MANIFEST_IGNORE_PRIVATE_KEY) -or
                [string]::IsNullOrWhiteSpace($env:MANIFEST_IGNORE_PUBLIC_KEY)) {
              throw "Policy-signing credentials are missing or empty."
            }
            $privateFileName = "portfolio-policy-private-" + [Guid]::NewGuid().ToString("N") + ".pem"
            $privatePath = Join-Path $env:TEMP $privateFileName
            $publicPath = Join-Path $env:WORKSPACE ".manifest-ignore-public.pem"
            try {
              [IO.File]::WriteAllText($privatePath, $env:MANIFEST_IGNORE_PRIVATE_KEY, [Text.Encoding]::ASCII)
              [IO.File]::WriteAllText($publicPath, $env:MANIFEST_IGNORE_PUBLIC_KEY, [Text.Encoding]::ASCII)
              node scripts/policy-signature.mjs sign "portfolio-manifest-ignore.json" "portfolio-manifest-ignore.sig" $privatePath
              if ($LASTEXITCODE -ne 0) { throw "Manifest-ignore signing failed." }
              node scripts/policy-signature.mjs verify "portfolio-manifest-ignore.json" "portfolio-manifest-ignore.sig" $publicPath
              if ($LASTEXITCODE -ne 0) { throw "Manifest-ignore signature verification failed." }
              $artifactDir = @(".output", "dist") | Where-Object { Test-Path $_ -PathType Container } | Select-Object -First 1
              node scripts/customer-release-verifier.mjs verify "portfolio-manifest-ignore.json" "portfolio-manifest-ignore.json.sha256" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE" "-" "portfolio-manifest-ignore.sig" $publicPath
              if ($LASTEXITCODE -ne 0) { throw "Signed customer release verification failed." }
            } finally {
              if ($privatePath) {
                Remove-Item -Force -LiteralPath $privatePath -ErrorAction SilentlyContinue
              }
              $env:MANIFEST_IGNORE_PRIVATE_KEY = $null
              $env:MANIFEST_IGNORE_PUBLIC_KEY = $null
            }
          '''
          archiveArtifacts artifacts: 'portfolio-manifest-ignore.sig', fingerprint: true
        }
      }
    }
    stage('Publish to Nexus (optional)') {
      when {
        allOf {
          branch 'dev'
          expression { return params.ENABLE_NEXUS_PUBLISH && env.NEXUS_RAW_REPOSITORY_URL?.trim() }
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'nexus-credentials', usernameVariable: 'NEXUS_USER', passwordVariable: 'NEXUS_PASSWORD')]) {
          powershell '''
            $ErrorActionPreference = "Stop"
            $base = $env:NEXUS_RAW_REPOSITORY_URL.TrimEnd('/')
            $repositoryUri = $null
            if (-not [Uri]::TryCreate($base, [UriKind]::Absolute, [ref]$repositoryUri)) {
              throw "NEXUS_RAW_REPOSITORY_URL must be a valid absolute HTTPS repository URL."
            }
            if ($repositoryUri.Scheme -ne [Uri]::UriSchemeHttps -or
                [string]::IsNullOrWhiteSpace($repositoryUri.Host) -or
                -not [string]::IsNullOrEmpty($repositoryUri.UserInfo) -or
                -not [string]::IsNullOrEmpty($repositoryUri.Query) -or
                -not [string]::IsNullOrEmpty($repositoryUri.Fragment)) {
              throw "NEXUS_RAW_REPOSITORY_URL must use HTTPS and must not contain embedded credentials, query parameters, or fragments."
            }
            if ([string]::IsNullOrWhiteSpace($env:GIT_COMMIT)) {
              throw "Git commit metadata is required for immutable Nexus publication paths."
            }
            $commit = $env:GIT_COMMIT.Substring(0, [Math]::Min(12, $env:GIT_COMMIT.Length))
            $projectPath = $env:PROJECT_NAME.ToLowerInvariant()
            $target = "$base/$projectPath/$env:BUILD_NUMBER-$commit"
            $pair = $env:NEXUS_USER + ':' + $env:NEXUS_PASSWORD
            $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
            $headers = @{ Authorization = "Basic $encoded" }
            $verificationDir = Join-Path $env:WORKSPACE ".nexus-verify"
            New-Item -ItemType Directory -Force -Path $verificationDir | Out-Null
            try {
              # Do not silently replace an artifact at an already-used release path.
              $releaseFiles = @($env:ARTIFACT_FILE, $env:MANIFEST_FILE, $env:CHECKSUM_FILE, 'portfolio-manifest-ignore.json', 'portfolio-manifest-ignore.json.sha256')
              if (Test-Path 'portfolio-manifest-ignore.sig' -PathType Leaf) { $releaseFiles += 'portfolio-manifest-ignore.sig' }
              foreach ($file in $releaseFiles) {
                $uri = "$target/$file"
                try {
                  $existing = Invoke-WebRequest -Uri $uri -Method Head -Headers $headers -UseBasicParsing -ErrorAction Stop
                  throw "Refusing to overwrite existing Nexus release asset: $uri (HTTP $([int]$existing.StatusCode)). Use a new build number or investigate the existing release."
                } catch {
                  $statusCode = $null
                  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                    $statusCode = [int]$_.Exception.Response.StatusCode
                  }
                  if ($statusCode -ne 404) {
                    if ($_.Exception.Message -like 'Refusing to overwrite existing Nexus release asset:*') { throw }
                    throw "Could not safely establish that Nexus release asset is absent: $uri. HTTP status: $statusCode. Publication stopped."
                  }
                }
              }
              foreach ($file in $releaseFiles) {
                $uri = "$target/$file"
                Invoke-WebRequest -Uri $uri -Method Put -InFile $file -Headers $headers -UseBasicParsing | Out-Null
                $download = Join-Path $verificationDir $file
                Invoke-WebRequest -Uri $uri -Method Get -OutFile $download -Headers $headers -UseBasicParsing | Out-Null
                $localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash
                $remoteHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $download).Hash
                if ($localHash -ne $remoteHash) {
                  throw "Nexus read-back SHA-256 mismatch for $file."
                }
                Write-Output "Published and verified $file at immutable build path $env:BUILD_NUMBER-$commit"
              }
              node scripts/artifact-integrity.mjs verify-hash (Join-Path $verificationDir $env:ARTIFACT_FILE) (Join-Path $verificationDir $env:CHECKSUM_FILE)
              if ($LASTEXITCODE -ne 0) { throw "Nexus read-back checksum verification failed." }
              node scripts/artifact-integrity.mjs verify-release (Join-Path $verificationDir $env:ARTIFACT_FILE) (Join-Path $verificationDir $env:MANIFEST_FILE) (Join-Path $verificationDir $env:CHECKSUM_FILE)
              if ($LASTEXITCODE -ne 0) { throw "Nexus read-back release verification failed." }
              # Inspect archive paths before extraction to block path traversal.
              $archivePath = Join-Path $verificationDir $env:ARTIFACT_FILE
              $archiveEntries = & tar -tzf $archivePath
              if ($LASTEXITCODE -ne 0) { throw "Could not list the downloaded Nexus package archive." }
              foreach ($entry in $archiveEntries) {
                $normalizedEntry = ([string]$entry).Replace('\\', '/')
                if ([string]::IsNullOrWhiteSpace($normalizedEntry) -or
                    $normalizedEntry.StartsWith('/') -or
                    $normalizedEntry -match '^[A-Za-z]:' -or
                    ($normalizedEntry -split '/') -contains '..') {
                  throw "Unsafe archive member path rejected: $entry"
                }
              }
              $downloadedPackageDir = Join-Path $verificationDir 'downloaded-package'
              New-Item -ItemType Directory -Force -Path $downloadedPackageDir | Out-Null
              & tar -xzf $archivePath -C $downloadedPackageDir
              if ($LASTEXITCODE -ne 0) { throw "Failed to extract the downloaded Nexus package." }
              $trustedPolicyHash = (Get-Content (Join-Path $verificationDir 'portfolio-manifest-ignore.json.sha256')).Split(' ')[0]
              $remotePolicy = Join-Path $verificationDir 'portfolio-manifest-ignore.json'
              $artifactDir = $downloadedPackageDir
              if (Test-Path (Join-Path $verificationDir 'portfolio-manifest-ignore.sig') -PathType Leaf) {
                node scripts/policy-signature.mjs verify $remotePolicy (Join-Path $verificationDir 'portfolio-manifest-ignore.sig') (Join-Path $env:WORKSPACE '.manifest-ignore-public.pem')
                if ($LASTEXITCODE -ne 0) { throw "Nexus read-back policy signature verification failed." }
                node scripts/customer-release-verifier.mjs verify $remotePolicy (Join-Path $verificationDir 'portfolio-manifest-ignore.json.sha256') (Join-Path $verificationDir $env:MANIFEST_FILE) (Join-Path $verificationDir $env:ARTIFACT_FILE) (Join-Path $verificationDir $env:ARTIFACT_FILE) '-' (Join-Path $verificationDir 'portfolio-manifest-ignore.sig') (Join-Path $env:WORKSPACE '.manifest-ignore-public.pem')
              } else {
                node scripts/customer-release-verifier.mjs verify $remotePolicy (Join-Path $verificationDir 'portfolio-manifest-ignore.json.sha256') (Join-Path $verificationDir $env:MANIFEST_FILE) (Join-Path $verificationDir $env:ARTIFACT_FILE) (Join-Path $verificationDir $env:ARTIFACT_FILE) $trustedPolicyHash
              }
              if ($LASTEXITCODE -ne 0) { throw "Nexus read-back customer release verification failed." }
            } finally {
              Remove-Item -Recurse -Force -LiteralPath $verificationDir -ErrorAction SilentlyContinue
              Remove-Variable pair, encoded, headers -ErrorAction SilentlyContinue
            }
          '''
        }
      }
    }
  }
  post {
    success {
      echo 'Portfolio pipeline succeeded; artifact checksums and manifest were verified.'
      echo "Release traceability: project=${env.PROJECT_NAME}; build=${env.BUILD_NUMBER}; commit=${env.GIT_COMMIT}; artifact=${env.ARTIFACT_FILE}; manifest=${env.MANIFEST_FILE}; checksum=${env.CHECKSUM_FILE}."
    }
    failure {
      echo 'Portfolio pipeline failed. Review the first failing stage; publication is gated behind successful verification.'
    }
    always {
      archiveArtifacts artifacts: 'customer-release-report.json', fingerprint: false, allowEmptyArchive: true
      powershell 'Remove-Item -Force (Join-Path $env:WORKSPACE ".manifest-ignore-public.pem") -ErrorAction SilentlyContinue'
    }
  }
}
