# Apply Diff
run_id: 4d5fca98-8b6f-46bb-ad3d-244f8a7dca51
timestamp: 2026-03-18T12:38:07Z

## Target
- apps/web/src/app/page.tsx
- apps/web/src/app/(auth)/login/page.tsx

## Planned changes
- Revert the mistaken public landing page from the app root back to the transactional redirect flow.
- Mark the login page as non-indexable so the app domain does not compete with the public marketing site in search.
