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
  }
  stages {
    stage('Checkout') {
      steps {
        deleteDir()
        checkout scm
      }
    }
    stage('Install locked dependencies') {
      steps {
        bat 'node --version'
        bat 'npm --version'
        bat 'npm ci'
      }
    }
    stage('Build and test') {
      steps {
        bat 'npm run build'
        bat 'npm run lint'
        bat 'npm test'
      }
    }
    stage('Package and verify integrity') {
      steps {
        powershell '''
          $ErrorActionPreference = "Stop"
          $artifactDir = @(".output", "dist") | Where-Object { Test-Path $_ -PathType Container } | Select-Object -First 1
          if (!$artifactDir) {
            throw "Build succeeded but no supported output directory (.output or dist) was found."
          }
          tar -czf "$env:ARTIFACT_FILE" -C "$artifactDir" .
          $env:PROJECT_NAME = "portfolio"
          node scripts/artifact-integrity.mjs create "$artifactDir" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE"
          node scripts/artifact-integrity.mjs verify "$artifactDir" "$env:MANIFEST_FILE" "$env:ARTIFACT_FILE"
          node scripts/artifact-integrity.mjs hash "$env:ARTIFACT_FILE" "$env:CHECKSUM_FILE"
          node scripts/artifact-integrity.mjs verify-hash "$env:ARTIFACT_FILE" "$env:CHECKSUM_FILE"
          node scripts/artifact-integrity.mjs verify-release "$env:ARTIFACT_FILE" "$env:MANIFEST_FILE" "$env:CHECKSUM_FILE"
        '''
        archiveArtifacts artifacts: 'portfolio-build.tar.gz,portfolio-manifest.json,portfolio-build.tar.gz.sha256', fingerprint: true
      }
    }
    stage('Publish to Nexus (optional)') {
      when {
        expression { return env.NEXUS_RAW_REPOSITORY_URL?.trim() }
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
              foreach ($file in @($env:ARTIFACT_FILE, $env:MANIFEST_FILE, $env:CHECKSUM_FILE)) {
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
              foreach ($file in @($env:ARTIFACT_FILE, $env:MANIFEST_FILE, $env:CHECKSUM_FILE)) {
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
              node scripts/artifact-integrity.mjs verify-release (Join-Path $verificationDir $env:ARTIFACT_FILE) (Join-Path $verificationDir $env:MANIFEST_FILE) (Join-Path $verificationDir $env:CHECKSUM_FILE)
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
  }
}
