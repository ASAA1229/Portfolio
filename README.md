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

The portfolio chatbot API is handled server-side by `src/routes/api/chat.ts` and uses the OpenAI Responses API only. Lovable AI is currently paused and is not used as a fallback.

### Local development

1. Copy `.env.example` to `.env.local`.
2. Put your key in `.env.local` as `OPENAI_API_KEY=your_real_key`.
3. Restart the development server.

`.env`, `.env.local`, and other real environment files are ignored by Git. Never put an API key in React components, client-side variables such as `VITE_OPENAI_API_KEY`, source files, screenshots, issues, or public repositories.

### Deployment

Add `OPENAI_API_KEY` as a **server-side environment secret** in the hosting provider's dashboard, then redeploy. Do not put the secret into frontend build variables. No Lovable AI key is needed while Lovable AI is paused. OpenAI API access and usage billing are managed separately from ChatGPT subscriptions.

## CI/CD artifact integrity and Nexus publication

The Jenkins pipeline builds the project, creates a packaged release artifact, generates a SHA-256 file inventory manifest, and verifies both the manifest and the package checksum before archiving the release outputs.

### Required build provenance

The pipeline sets `REQUIRE_BUILD_PROVENANCE=true`. Manifest creation and verification therefore require a full Git commit SHA and build number. Verification also compares those values with the current Jenkins build environment; a manifest copied from a different build is rejected.

### Optional Nexus Raw publication

Nexus publication runs only when `NEXUS_RAW_REPOSITORY_URL` is configured in Jenkins. Configure it as an HTTPS URL for the target Raw repository **without** embedded credentials, query parameters, or fragments. Store the Nexus username/password in Jenkins Credentials under the ID `nexus-credentials` (Username with password); do not add credentials to source control or the URL.

The release path includes the project name, Jenkins build number, and short Git commit. Before upload, the pipeline checks each expected release asset using authenticated `HEAD` requests. It refuses to overwrite existing assets and stops if it cannot establish that an asset is absent. After upload, it downloads the files and compares SHA-256 digests with the local copies.

**Repository compatibility note:** the configured Nexus Raw repository and its access policy must support authenticated `HEAD` requests and return HTTP 404 for absent paths. Validate this behavior with your Nexus administrator before enabling publication. The HEAD preflight is a guard against accidental overwrite, not an atomic immutability guarantee; use repository-side permissions or immutable storage controls where available.

### Published build outputs

- Packaged application archive
- JSON manifest listing packaged files, sizes, and SHA-256 digests, with build provenance
- SHA-256 checksum sidecar for the archive

### Operational status

Changes to the pipeline and integrity scripts must be validated in Jenkins before being treated as release-ready. A successful local commit or PR update alone does not prove that the configured Jenkins agent, Nexus permissions, or repository behavior works end to end.

