# Design references and asset licenses

Restored from the historical copy on `main` (`git show origin/main:ASSET-LICENSES.md`) and reconciled with the assets committed on `new` on 2026-11-14. The full per-file inventory, sizes and usage are in [docs/ASSET_PROVENANCE.md](docs/ASSET_PROVENANCE.md).

## Third-party design references and icon sets

- ManyPixels: visual hierarchy, balance, contrast, consistent art direction and message-first imagery informed the layout. No layout or artwork was copied. References: https://www.manypixels.co/blog/social-media-design and https://www.manypixels.co/blog/inspiration/basic-principles-of-design.
- unDraw: **Code Contribution**, selected from https://undraw.co/illustrations/8 and recolored for a dark background. The illustration is referenced through the local pointer `src/assets/code-contribution.svg.asset.json`. License: https://undraw.co/license. Personal and commercial use is permitted without attribution; do not redistribute it as an asset pack and do not use it in AI/ML training or development.
- Iconify: reviewed https://iconify.design/ and https://iconify.design/docs/icon-components/react/. The bundled Lucide family is retained instead of adding Iconify's runtime API dependency; icons render offline and during SSR without icon-network requests.
- Lucide React: ISC license, https://lucide.dev/license. Some inherited Feather artwork carries an MIT notice; retain the dependency's complete LICENSE when distributing. The installed package keeps these notices.
- Web fonts (Barlow Condensed, Sora, JetBrains Mono) are loaded from Google Fonts under the SIL Open Font License. This is a runtime third-party request (see the performance finding in docs/PROJECT_STATUS.md); self-hosting is the recommended follow-up.

## Owner-provided personal media

- Portraits, galleries and videos under `public/images/profiles/{abhishek,amulya,anjini,sai}` and `src/assets/*.jpg|jpeg|mp4` are owner-provided. Their rights, subject consent and publication approval are **not established by this repository**; they require explicit owner confirmation per file (tracked as PORT-US-048 owner sign-off).
- The Home portrait is labeled AI-stylized and must never be described as an authentic photograph. No new face was generated.
- `src/assets/lift.mp4.asset.json` and `src/assets/sitting_video.mp4.asset.json` are Lovable asset pointers; the referenced binaries live in the Lovable asset store, not in this repository.

## Reconciliation notes (2026-11-14)

- The historical `public/images/profiles/README.md` listed `abhishek_2.jpg`, "Anjini Coming Soon" and three-file sets; the committed files are `abhishek_2.jpeg`, additional `.webp` renditions for Anjini and Sai, and extra Amulya files. The inventory in docs/ASSET_PROVENANCE.md replaces it. The README is intentionally not restored under `public/` because everything in `public/` is served publicly.
- `npm run audit:images` reports one referenced-but-missing file (`public/images/profiles/priya/main.webp`, used only by the generic `src/lib/profile-template.ts`) and nine committed-but-unreferenced files; see the inventory for details.
