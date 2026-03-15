BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS numero_login text;

COMMIT;
