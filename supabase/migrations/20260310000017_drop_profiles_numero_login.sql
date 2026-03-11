BEGIN;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS numero_login;

COMMIT;
