BEGIN;

ALTER TABLE public.empresas_parceiras
  ADD COLUMN IF NOT EXISTS nome_empresa text,
  ADD COLUMN IF NOT EXISTS nome_recrutador text,
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.empresas_parceiras ep
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = ep.id
  AND (ep.email IS NULL OR btrim(ep.email) = '');

COMMIT;
