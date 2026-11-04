# Portfolio profile image assets

All active profile image paths below are committed under `public/images/profiles/`. The paths in this document are aligned with the current profile data and profile selector on branch `new`.

## Abhishek
- `abhishek/abhishek_main.jpeg` — profile selector avatar and main portrait
- `abhishek/abhishek_1.jpeg` — gallery photo
- `abhishek/abhishek_2.jpeg` — gallery photo

## Amulya (Ammu)
- `amulya/amulya_main.webp` — profile selector avatar and main portrait
- `amulya/ammu3.jpeg` — gallery photo
- `amulya/ammu4.jpeg` — gallery photo
- `amulya/ammu5.jpeg` — additional committed image; not currently referenced by the profile gallery

The older `amulya_1.webp` and `amulya_2.webp` files remain in the repository but are not the active gallery images.

## Anjini (Bava)
- `anjini/anjini_main.jpg` — profile selector avatar and main portrait
- `anjini/anjini_1.jpg` — gallery photo
- `anjini/anjini_2.jpg` — gallery photo

Anjini's profile data is present in the current portfolio source. Keep published details grounded in her approved resume/profile information.

## Sai (Darling)
- `sai/sai_main.png` — profile selector avatar and main portrait
- `sai/sai_1.jpeg` — gallery photo
- `sai/sai_2.jpeg` — gallery photo

## Image loading and dynamic updates
- The profile selector eagerly loads the avatar images because they appear above the fold.
- If an avatar fails to load, the initials layer remains visible as a graceful fallback.
- Static gallery images are defined in `src/lib/person-portfolios.ts`.
- New images can be uploaded through the authenticated `/admin/images` manager. Uploads remain private and pending until manually published.
- Published images are served through the approved-image API and associated with the selected profile.
- Run `npm run audit:images` when validating static image references.
