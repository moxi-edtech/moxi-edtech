# Apply Diff
run_id: 98a2531c-b26e-47cf-b29b-0f44ba6980e1
timestamp: 2026-03-18T12:53:37Z

## Target
- apps/web/src/app/layout.tsx

## Planned changes
- Export typed Next.js metadata from the root layout with metadataBase, commercial titles, SEO description, canonical, Open Graph and Twitter fields.
- Remove from <head> the tags already covered by the Metadata API, keeping only the manifest link and optional font stylesheet.
