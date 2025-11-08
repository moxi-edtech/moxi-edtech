-- Migration: Ensure profiles.numero_login is TEXT (supports alfanumérico prefixes)
-- Run this in Supabase SQL editor (or psql) connected to your project.

BEGIN;

-- 1) Ensure column exists as TEXT
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS numero_login TEXT;

-- 2) Force type to TEXT in case it's INTEGER/NUMERIC
--    The USING clause safely casts existing numeric values.
ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN numero_login TYPE TEXT USING numero_login::TEXT;

-- 3) (Optional but recommended) prevent duplicates per escola
--    This requires that existing data has no duplicates; remove the IF NOT EXISTS
--    if you want the migration to fail loudly on conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_escola_numero_login_uidx
  ON public.profiles (escola_id, numero_login)
  WHERE numero_login IS NOT NULL;

COMMIT;

