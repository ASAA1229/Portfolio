# Portfolio — Asset Provenance, Licenses and Image Inventory

Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md)

## Design references and licenses

- ManyPixels: visual hierarchy, balance, contrast, consistent art direction and message-first imagery informed the layout. No layout or artwork was copied. References: https://www.manypixels.co/blog/social-media-design and https://www.manypixels.co/blog/inspiration/basic-principles-of-design.
- unDraw: **Code Contribution**, selected from https://undraw.co/illustrations/8 and recolored for a dark background. Served through a local asset pointer on About only. License: https://undraw.co/license. Personal/commercial use is permitted without attribution; do not redistribute as an asset pack or use in AI/ML training/development.
- Iconify: reviewed https://iconify.design/ and https://iconify.design/docs/icon-components/react/. Existing bundled Lucide family is retained instead of adding Iconify runtime API dependency; icons render offline and during SSR.
- Lucide React: ISC license, https://lucide.dev/license. Some inherited Feather artwork has an MIT notice; retain the dependency's complete LICENSE when distributing.
- Portraits and videos: existing user-provided project assets are preserved. The Home portrait is labeled AI-stylized, not an authentic photograph. No new face was generated.

## Profile asset inventory (reconciled 2026-11-14)

Source: `public/images/profiles/**` on branch `new`, byte sizes from the working tree, usage from `npm run audit:images` plus a source search. A filename inventory does not establish identity, consent, rights or publication approval; those remain owner confirmations (PORT-US-048).

| Profile | File | Size (KB) | Referenced by source |
|---|---|---:|---|
| Abhishek | abhishek/abhishek_main.jpeg | 53 | Yes (avatar, social image, selector) |
| Abhishek | abhishek/abhishek_1.jpeg | 61 | Yes |
| Abhishek | abhishek/abhishek_2.jpeg | 132 | Yes |
| Amulya / Ammu | amulya/amulya_main.webp | 4 | Yes (portrait, social image) |
| Amulya / Ammu | amulya/ammu3.jpeg | 236 | Yes (gallery) |
| Amulya / Ammu | amulya/ammu4.jpeg | 44 | Yes (gallery) |
| Amulya / Ammu | amulya/ammu5.jpeg | 60 | No |
| Amulya / Ammu | amulya/amulya_1.webp, amulya_2.webp | 6 + 6 | No |
| Anjini / Bava | anjini/anjini_main.webp | 245 | Yes (portrait, selector) |
| Anjini / Bava | anjini/anjini_1.webp, anjini_2.webp | 53 + 171 | Yes (gallery) |
| Anjini / Bava | anjini/anjini_main.jpg, anjini_1.jpg, anjini_2.jpg | 4,327 + 2,942 + 838 | No (original-resolution duplicates of the webp files) |
| Sai / Darling | sai/sai_main.webp | 168 | Yes (portrait, selector) |
| Sai / Darling | sai/sai_1.jpeg | 343 | Yes (gallery) |
| Sai / Darling | sai/sai_2.webp | 65 | Yes (gallery) |
| Sai / Darling | sai/sai_2.jpeg, sai_main.png | 1,638 + 2,182 | No (original-resolution duplicates) |

Findings from the reconciliation:
- 9 committed files are unreferenced; the four largest (about 10.8 MB: anjini_main.jpg, anjini_1.jpg, sai_main.png, sai_2.jpeg) inflate the deployed static bundle. Deleting owner-provided originals is an owner decision; recommended action is to move them to private storage (Admin image manager originals) and keep only the webp renditions in `public/`.
- `public/images/profiles/priya/main.webp` is referenced by the generic `src/lib/profile-template.ts` and does not exist. The template is not routed; it should be removed or given an asset before it is used.
- `src/assets` (bundled via imports): avatar.jpg, hero.jpg, developer-constellation.jpg, series-billboard.jpg, my_1.jpeg, my_2.jpeg, video_set.mp4, plus Lovable pointers code-contribution.svg, lift.mp4 and sitting_video.mp4 (binaries not in the repository).
- License and attribution text: see [ASSET-LICENSES.md](../ASSET-LICENSES.md).

## Governance
Preserve owner-provided media and record source/permission where known. Confirm rights and profile assignment before release. Keep private originals/pending uploads outside public static directories. Use meaningful alt text. Never imply AI-stylized portraits are authentic photographs. Record project image placement by profile ID and project slug. Reconcile with npm run audit:images and Admin lifecycle inspector during QA.
