-- KLASSE replay shim for an already-applied remote migration (20261028211345).
-- Original immutable SQL: supabase/ops/applied_lifecycle_20261028/20261028211345_lifecycle_p0_revoke_legacy_writers_20261028.sql
-- Objects used here were installed in live DB after later-version dependencies.
-- Fresh replays must defer these changes to supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql.
-- Version retained to match the production Supabase migration history.
SELECT 1 WHERE false;
