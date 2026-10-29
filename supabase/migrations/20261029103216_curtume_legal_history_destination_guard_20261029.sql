-- Applied remotely on 2026-10-29 as migration 20261029103216.
-- Complete idempotent forward migration: 20271029120000_curtume_legal_history_destination_guard.sql
-- Avoid reapplying early before lifecycle dependencies.
SELECT 1 WHERE false;
