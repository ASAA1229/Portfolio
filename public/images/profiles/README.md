# Portfolio profile image assets

All listed assets are committed to this branch under `public/images/profiles/`.

## Abhishek
- `abhishek/abhishek_main.jpeg` — profile selector avatar and main personal photo
- `abhishek/abhishek_1.jpeg` — classroom photo
- `abhishek/abhishek_2.jpg` — campus photo

## Amulya
- `amulya/amulya_main.webp` — profile selector avatar and main portrait
- `amulya/amulya_1.webp` — gallery photo
- `amulya/amulya_2.webp` — gallery photo

## Anjini
- `anjini/anjini_main.jpg` — profile selector avatar
- `anjini/anjini_1.jpg`
- `anjini/anjini_2.jpg`

Anjini's portfolio remains Coming Soon while her resume is pending. Her photos are used only for the profile card, not to invent portfolio details.

## Sai
- `sai/sai_main.png` — profile artwork/avatar
- `sai/sai_1.jpeg`
- `sai/sai_2.jpeg`

The profile selector eagerly loads the avatar images because they appear above the fold. If an image fails to load, the initials layer remains visible as a graceful fallback. The About galleries use the two additional photos for Abhishek, Amulya, and Sai.

## Dynamic image updates

New images can be uploaded through the authenticated `/admin/images` manager. Uploads are private and pending until manually published. Published images are served by the approved-image API and added to the matching profile gallery without exposing private bucket keys. Static images remain the fallback and should be audited with `npm run audit:images`.
