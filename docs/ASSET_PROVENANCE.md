# Portfolio — Asset Provenance, Licenses and Image Inventory

Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md)

## Design references and licenses

- ManyPixels: visual hierarchy, balance, contrast, consistent art direction and message-first imagery informed the layout. No layout or artwork was copied. References: https://www.manypixels.co/blog/social-media-design and https://www.manypixels.co/blog/inspiration/basic-principles-of-design.
- unDraw: **Code Contribution**, selected from https://undraw.co/illustrations/8 and recolored for a dark background. Served through a local asset pointer on About only. License: https://undraw.co/license. Personal/commercial use is permitted without attribution; do not redistribute as an asset pack or use in AI/ML training/development.
- Iconify: reviewed https://iconify.design/ and https://iconify.design/docs/icon-components/react/. Existing bundled Lucide family is retained instead of adding Iconify runtime API dependency; icons render offline and during SSR.
- Lucide React: ISC license, https://lucide.dev/license. Some inherited Feather artwork has an MIT notice; retain the dependency's complete LICENSE when distributing.
- Portraits and videos: existing user-provided project assets are preserved. The Home portrait is labeled AI-stylized, not an authentic photograph. No new face was generated.

## Profile asset inventory

Paths observed on new; filename inventory does not establish identity, consent, rights or publication approval.

### Abhishek
- public/images/profiles/abhishek/abhishek_main.jpeg
- public/images/profiles/abhishek/abhishek_1.jpeg
- public/images/profiles/abhishek/abhishek_2.jpeg

### Amulya / Ammu
- public/images/profiles/amulya/amulya_main.webp
- public/images/profiles/amulya/amulya_1.webp
- public/images/profiles/amulya/amulya_2.webp
- public/images/profiles/amulya/ammu3.jpeg
- public/images/profiles/amulya/ammu4.jpeg
- public/images/profiles/amulya/ammu5.jpeg

### Anjini / Bava
- public/images/profiles/anjini/anjini_main.jpg and anjini_main.webp
- public/images/profiles/anjini/anjini_1.jpg and anjini_1.webp
- public/images/profiles/anjini/anjini_2.jpg and anjini_2.webp

### Sai / Darling
- public/images/profiles/sai/sai_main.png and sai_main.webp
- public/images/profiles/sai/sai_1.jpeg
- public/images/profiles/sai/sai_2.jpeg and sai_2.webp

## Governance
Preserve owner-provided media and record source/permission where known. Confirm rights and profile assignment before release. Keep private originals/pending uploads outside public static directories. Use meaningful alt text. Never imply AI-stylized portraits are authentic photographs. Record project image placement by profile ID and project slug. Reconcile with npm run audit:images and Admin lifecycle inspector during QA.
