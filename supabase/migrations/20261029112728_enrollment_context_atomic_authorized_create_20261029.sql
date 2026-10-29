-- Applied in Supabase live at migration 20261029112728.
-- Full idempotent replay with enrollment integrity guards:
-- 20271029150000_enrollment_context_atomic_authorized_create.sql
-- Avoid running this applied migration twice.
SELECT 1 WHERE false;
