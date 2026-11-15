// Portfolio (TanStack Start / Vitest / Cloudflare) CI/CD pipeline for a Windows Jenkins agent.
// Helpers live in ci/jenkins (Windows PowerShell 5.1 and PowerShell 7 compatible).
// Standard stage order: checkout + source verification, agent prerequisites, locked install, package-manager policy,
// SBOM + dependency audit, static analysis, tests (JUnit), build + bundle budget, package + integrity, archive,
// optional signing, optional gated Nexus release. Ordinary new/dev/fix/test builds never publish; releases need
// main or release/*, ENABLE_NEXUS_PUBLISH=true and an explicit input approval.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    skipDefaultCheckout(true)
    timeout(time: 60, unit: 'MINUTES')
  }
  environment {
    CI = 'true'
    PROJECT_NAME = 'portfolio'
    REQUIRE_BUILD_PROVENANCE = 'true'
    ARTIFACT_FILE = 'portfolio-build.tar.gz'
    MANIFEST_FILE = 'portfolio-manifest.json'
    CHECKSUM_FILE = 'portfolio-build.tar.gz.sha256'
    CUSTOMER_RELEASE_REPORT_PATH = 'customer-release-report.json'
    NPM_CONFIG_UPDATE_NOTIFIER = 'false'
    NPM_CONFIG_FUND = 'false'
  }
  parameters {
    booleanParam(name: 'ENABLE_NEXUS_PUBLISH', defaultValue: false, description: 'Nexus publishing is paused; enable only after explicit approval and configuration. Only runs from main or release/* and still asks for approval.')
    booleanParam(name: 'ENABLE_POLICY_SIGNING', defaultValue: false, description: 'Sign manifest-ignore with the configured Ed25519 Jenkins credentials.')
    booleanParam(name: 'DEPLOY_LOCAL_PROD', defaultValue: false, description: 'After a green build, run the production build locally on this agent at http://localhost:8300 (wrangler dev --local, local R2 emulation), smoke test it and roll back to the previous release if smoke fails. No Cloudflare account or network deploy is involved.')
    booleanParam(name: 'TRIGGER_LOCAL_STACK_DEPLOY', defaultValue: false, description: 'After a green build of branch new, trigger the ASAA-Local-Stack job (local development stack only; the job must exist).')
  }
  stages {
    stage('Checkout and source verification') {
      steps {
        deleteDir()
        script {
          def scmVars = checkout scm
          env.GIT_COMMIT = scmVars.GIT_COMMIT
          env.GIT_BRANCH = scmVars.GIT_BRANCH
          env.GIT_URL = scmVars.GIT_URL
        }
        bat 'git --no-pager log -1 --oneline'
        powershell '''
          $ErrorActionPreference = "Stop"
          $head = (git rev-parse HEAD).Trim()
          if ($LASTEXITCODE -ne 0) { throw "git rev-parse failed." }
          if ($head -ne $env:GIT_COMMIT) { throw "Checked-out commit $head does not match the commit Jenkins resolved ($env:GIT_COMMIT)." }
        '''
      }
    }
    stage('Agent prerequisites') {
      steps {
        bat 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ci\\jenkins\\agent-prereqs.ps1 -Require "node,npm,git,tar,lockfile,workspace" -NpmRange ">=11" -ReportFile .jenkins-temp\\agent-prereqs.json'
      }
    }
    stage('Install locked dependencies') {
      steps {
        bat 'npm ci'
        bat 'npm run check:pm'
      }
    }
    stage('SBOM and dependency audit') {
      steps {
        bat 'npm run audit:deps'
        // npm sbom has no --output-file option (it prints to stdout), so redirect it and verify the written file.
        bat 'npm sbom --sbom-format=cyclonedx > portfolio-dependencies.cdx.json'
        bat 'node scripts\\sbom-verify.mjs portfolio-dependencies.cdx.json'
      }
    }
    stage('Static analysis') {
      steps {
        bat 'npm run typecheck'
        bat 'npm run lint'
      }
    }
    stage('Automated tests') {
      steps {
        bat 'npm run test:ci'
      }
      post {
        always {
          junit testResults: 'test-results/junit-*.xml', allowEmptyResults: true
        }
      }
    }
    stage('Build and bundle budget') {
      steps {
        bat 'npm run build'
        bat 'npm run check:budget'
      }
    }
    stage('Package and verify integrity') {
      steps {
        bat 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ci\\jenkins\\package-release.ps1 -ProjectName portfolio -Prefix portfolio -OutputDirs ".output,dist"'
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
    stage('Local production deploy and smoke (optional)') {
      when {
        expression { return params.DEPLOY_LOCAL_PROD }
      }
      environment {
        // Outside the workspace (which is wiped each build) so the previous release survives for rollback.
        LOCAL_PROD_HOME = "${env.USERPROFILE}\\portfolio-local-prod"
        // Stop Jenkins' process-tree killer from terminating the detached local server when the build ends.
        JENKINS_NODE_COOKIE = 'dontKillMe'
        BUILD_ID = 'dontKillMe'
      }
      steps {
        bat 'npm run deploy:dry-run'
        // deploy = build, restart on port 8300, smoke; it rolls back to the previous release when smoke fails.
        bat 'npm run local:deploy'
      }
    }
    stage('Publish to Nexus (optional, release branches only)') {
      when {
        beforeInput true
        allOf {
          expression { return isReleaseBranch() }
          expression { return params.ENABLE_NEXUS_PUBLISH }
          expression { return (env.NEXUS_RAW_REPOSITORY_URL ?: '').trim().length() > 0 }
        }
      }
      input {
        message 'Publish the verified Portfolio release bundle to Nexus?'
        ok 'Publish'
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'nexus-credentials', usernameVariable: 'NEXUS_USER', passwordVariable: 'NEXUS_PASSWORD')]) {
          bat 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ci\\jenkins\\publish-nexus.ps1 -ProjectName portfolio -Prefix portfolio'
        }
      }
    }
  }
  post {
    success {
      echo 'Portfolio pipeline succeeded; artifact checksums and manifest were verified.'
      echo "Release traceability: project=${env.PROJECT_NAME}; build=${env.BUILD_NUMBER}; commit=${env.GIT_COMMIT}; artifact=${env.ARTIFACT_FILE}; manifest=${env.MANIFEST_FILE}; checksum=${env.CHECKSUM_FILE}."
      script {
        if (params.TRIGGER_LOCAL_STACK_DEPLOY && currentBranchName() == 'new') {
          try {
            build job: 'ASAA-Local-Stack', parameters: [string(name: 'ACTION', value: 'DEPLOY')], wait: false
          } catch (err) {
            echo "WARNING: local stack deployment was requested but could not be triggered: ${err.message}"
            currentBuild.result = 'UNSTABLE'
          }
        } else {
          echo 'No deployment was performed.'
        }
      }
    }
    failure {
      echo 'Portfolio pipeline failed. Review the first failing stage; publication is gated behind successful verification.'
    }
    always {
      archiveArtifacts artifacts: 'customer-release-report.json,.jenkins-temp/agent-prereqs.json', fingerprint: false, allowEmptyArchive: true
      powershell '''
        Remove-Item -Force (Join-Path $env:WORKSPACE ".manifest-ignore-public.pem") -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force (Join-Path $env:WORKSPACE ".jenkins-temp") -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force (Join-Path $env:WORKSPACE ".nexus-verify") -ErrorAction SilentlyContinue
      '''
    }
  }
}

def currentBranchName() {
  def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
  return branch.replaceFirst('^refs/heads/', '').replaceFirst('^origin/', '')
}

def isReleaseBranch() {
  def branch = currentBranchName()
  return branch == 'main' || branch.startsWith('release/')
}
