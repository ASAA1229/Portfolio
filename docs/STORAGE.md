# Storage and source of truth (PORT-US-041)

All private and admin data goes through one small contract,
`StorageAdapter` (`src/lib/storage-adapter.ts`: `get` / `put` / `delete` / `list`),
with three implementations:

| Adapter | Used when | Notes |
|---|---|---|
| `r2Adapter` | Deployed (Cloudflare `RESUME_BUCKET` binding, bucket `portfolio-private-resumes`) | Durable, private; listing is paged |
| `localDiskAdapter` | `vite dev` without an R2 binding | Files under `.local-storage/` (git-ignored; `PORTFOLIO_LOCAL_STORAGE_DIR` overrides) |
| `memoryAdapter` | Tests and previews | Lost on restart |

## Source of truth per data class

| Data | Source of truth | Key / location | Public? |
|---|---|---|---|
| Curated profile facts | Git (`src/lib/person-portfolios.ts`, `src/lib/portfolio-data.ts`) | — | Yes |
| CMS overrides (basics, projects, experience, education, certifications, SEO, navigation) | Private storage | `private-admin/content/<profile>.json` | Published version only, via `/api/published-content` |
| AI personas | Private storage | `private-admin/personas/<profile>.json` | Never directly; published persona is added to that profile's AI context only |
| Resume originals | Private storage | `private-admin/resumes/files/<id>` | Never |
| Resume index / review data | Private storage | `private-admin/resumes/index.json` | Never |
| Resume publish history | Private storage | `private-admin/resumes/history/<profile>.json` | Never |
| Published resume feed | Private storage (public copy) | `public/approved-resumes.json` | Yes, via `/api/published-resumes` |
| Image originals / index | Private storage | `private-admin/images/files/<id>`, `private-admin/images/index.json` | Never |
| Published images | Private storage (public copy) | `public/profile-images/<id>` | Yes, via `/api/published-images/<id>` |
| Optimised static images | Git (`public/images/…`) | — | Yes (CDN-cacheable) |

Precedence on public pages: published resume sections → published CMS overrides →
curated static data. Static source files are never modified at runtime.

## Backup, restore and migration

- **Admin → Backup & Restore** (`/admin/backup`) downloads one JSON file containing
  the CMS documents, personas, resume index, resume publish histories, the public
  resume feed and the image index. Binary originals are not included.
- Restore validates every document (known keys only, schema checks) **before** the
  first write and requires typing `RESTORE`. A failure part-way reports which
  documents were written; re-running the same backup is safe.
- Migrating providers: export a backup, point the deployment at the new bucket,
  restore, then copy the binary `private-admin/*/files/` and `public/profile-images/`
  objects with the provider's own copy tool.
- No paid hosting or storage dependency is assumed; local disk works for development.
