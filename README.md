# Pixel Perfect Pixel

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e57d50c9-d7ca-4bc6-8c2b-1c145ec53a9b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## AI chatbot configuration

The portfolio chat is served by `src/routes/api/chat.ts`. Provider selection is server-side and implemented in `src/lib/ai-provider.ts`.

### Provider order

1. **JARVIS personal AI gateway (primary):** configured with `JARVIS_AI_URL` and `JARVIS_AI_KEY`. The URL must use HTTPS, except loopback HTTP for local development. The site key is sent only by the server and the selected profile scope is included in the gateway request.
2. **OpenAI paid fallback (opt-in only):** used only when `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and `OPENAI_API_KEY` is configured server-side. It is never selected silently.
3. **Offline mode:** if no provider is configured, the API returns a safe unavailable response and the UI can use its profile-grounded offline answers.

### Local development

1. Copy `.env.example` to `.env.local`.
2. Configure the JARVIS URL and site key in server-side environment variables. For local JARVIS, use the loopback URL and a locally generated site key.
3. Only if the owner explicitly wants paid fallback, set `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and provide `OPENAI_API_KEY`.
4. Restart the development server.

Never put provider keys in React components, client-side variables such as `VITE_*`, source files, screenshots, issues or public repositories. Keep real environment files out of Git.

### Deployment

Configure `JARVIS_AI_URL` and `JARVIS_AI_KEY` as server-side secrets in the hosting environment. The JARVIS gateway must be reachable through an owner-approved HTTPS endpoint; keep the laptop's main JARVIS port private and expose only the dedicated gateway port if a tunnel is explicitly approved. Paid OpenAI fallback remains disabled unless the owner explicitly opts in with `PORTFOLIO_AI_ALLOW_PAID_FALLBACK=true` and configures `OPENAI_API_KEY`. Provider availability, credentials and usage are separate from ChatGPT subscriptions.

## CI/CD artifact integrity and Nexus publication

The Jenkins pipeline builds the project, creates a packaged release artifact, generates a SHA-256 file inventory manifest, and verifies both the manifest and the package checksum before archiving the release outputs.

### Required build provenance

The pipeline sets `REQUIRE_BUILD_PROVENANCE=true`. Manifest creation and verification therefore require a full Git commit SHA and build number. Verification also compares those values with the current Jenkins build environment; a manifest copied from a different build is rejected.

### Optional Nexus Raw publication

Nexus publication runs only when `NEXUS_RAW_REPOSITORY_URL` is configured in Jenkins. Configure it as an HTTPS URL for the target Raw repository **without** embedded credentials, query parameters, or fragments. Store the Nexus username/password in Jenkins Credentials under the ID `nexus-credentials` (Username with password); do not add credentials to source control or the URL.

The release path uses the lower-case project name, Jenkins build number, and short Git commit; this aligns the Nexus coordinate with the manifest's project/build/commit identity. `verify-release` rejects a manifest whose project differs from `PROJECT_NAME`, and its successful verification output records the project, build number, full source commit, artifact name, size, and SHA-256. Jenkins also emits a concise release-traceability line naming the artifact, manifest, and checksum sidecar. Before upload, the pipeline checks each expected release asset using authenticated `HEAD` requests. It refuses to overwrite existing assets and stops if it cannot establish that an asset is absent. After upload, it downloads the files and compares SHA-256 digests with the local copies.

**Repository compatibility note:** the configured Nexus Raw repository and its access policy must support authenticated `HEAD` requests and return HTTP 404 for absent paths. Validate this behavior with your Nexus administrator before enabling publication. The HEAD preflight is a guard against accidental overwrite, not an atomic immutability guarantee; use repository-side permissions or immutable storage controls where available.

### Verify a downloaded release before extraction

Before unpacking a downloaded release archive, verify its checksum sidecar and confirm the manifest's packaged-artifact name, size, and SHA-256 agree with the archive:

```sh
node scripts/artifact-integrity.mjs verify-release <artifact.tar.gz> <manifest.json> <artifact.tar.gz.sha256>
```

When `REQUIRE_BUILD_PROVENANCE=true`, set `GIT_COMMIT` (or `GIT_COMMIT_SHA`) and `BUILD_NUMBER` (or `GITHUB_RUN_NUMBER`) to the expected approved release values; the command rejects a manifest whose provenance differs. This pre-extraction check validates the archive against its sidecar and manifest metadata. After extraction, also run the existing `verify` command against the extracted directory and manifest to validate every packaged file.

### Published build outputs

- Packaged application archive
- JSON manifest listing packaged files, sizes, and SHA-256 digests, with build provenance
- SHA-256 checksum sidecar for the archive

### Operational status

Changes to the pipeline and integrity scripts must be validated in Jenkins before being treated as release-ready. A successful local commit or PR update alone does not prove that the configured Jenkins agent, Nexus permissions, or repository behavior works end to end.

