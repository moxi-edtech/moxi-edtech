BEGIN;

-- 1) SSOT de tipo de tenant no nível da escola/produto.
ALTER TABLE public.escolas
  ADD COLUMN IF NOT EXISTS tenant_type text;

UPDATE public.escolas e
SET tenant_type = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.escola_users eu
    WHERE eu.escola_id = e.id
      AND eu.papel IN ('formacao_admin', 'formacao_secretaria', 'formacao_financeiro', 'formador', 'formando')
  ) THEN 'formacao'
  ELSE 'k12'
END
WHERE e.tenant_type IS NULL;

ALTER TABLE public.escolas
  ALTER COLUMN tenant_type SET DEFAULT 'k12';

ALTER TABLE public.escolas
  ALTER COLUMN tenant_type SET NOT NULL;

ALTER TABLE public.escolas
  DROP CONSTRAINT IF EXISTS escolas_tenant_type_check;

ALTER TABLE public.escolas
  ADD CONSTRAINT escolas_tenant_type_check
  CHECK (tenant_type IN ('k12', 'formacao'));

CREATE INDEX IF NOT EXISTS idx_escolas_tenant_type_slug
  ON public.escolas (tenant_type, slug);

-- 2) Persistência de tenant_type em memberships para hardening de guardas de API.
ALTER TABLE public.escola_users
  ADD COLUMN IF NOT EXISTS tenant_type text;

UPDATE public.escola_users eu
SET tenant_type = e.tenant_type
FROM public.escolas e
WHERE e.id = eu.escola_id
  AND eu.tenant_type IS NULL;

ALTER TABLE public.escola_users
  ALTER COLUMN tenant_type SET DEFAULT 'k12';

ALTER TABLE public.escola_users
  ALTER COLUMN tenant_type SET NOT NULL;

ALTER TABLE public.escola_users
  DROP CONSTRAINT IF EXISTS escola_users_tenant_type_check;

ALTER TABLE public.escola_users
  ADD CONSTRAINT escola_users_tenant_type_check
  CHECK (tenant_type IN ('k12', 'formacao'));

CREATE OR REPLACE FUNCTION public.sync_escola_users_tenant_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT e.tenant_type
    INTO NEW.tenant_type
  FROM public.escolas e
  WHERE e.id = NEW.escola_id;

  IF NEW.tenant_type IS NULL THEN
    NEW.tenant_type := 'k12';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_escola_users_tenant_type ON public.escola_users;

CREATE TRIGGER trg_sync_escola_users_tenant_type
BEFORE INSERT OR UPDATE OF escola_id
ON public.escola_users
FOR EACH ROW
EXECUTE FUNCTION public.sync_escola_users_tenant_type();

COMMIT;
