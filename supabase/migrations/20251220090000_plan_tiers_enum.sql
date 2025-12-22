-- Idempotent migration to normalize school plans
BEGIN;

-- 1) Create ENUM (idempotent)
DO $$ BEGIN
  CREATE TYPE public.app_plan_tier AS ENUM ('essencial', 'profissional', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.1) Drop legacy constraint that still enforces basico/standard/premium
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'escolas'
      AND column_name = 'plano'
      AND constraint_name = 'escolas_plano_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.escolas DROP CONSTRAINT IF EXISTS escolas_plano_check';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'escolas'
      AND column_name = 'plano_atual'
      AND constraint_name = 'escolas_plano_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.escolas DROP CONSTRAINT IF EXISTS escolas_plano_check';
  END IF;
END $$;

-- 2) Case A: legacy column "plano"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escolas' AND column_name='plano'
  ) THEN
    EXECUTE $q$
      UPDATE public.escolas
      SET plano = CASE
        WHEN plano IS NULL THEN 'essencial'
        WHEN lower(btrim(plano)) IN ('basico', 'básico') THEN 'essencial'
        WHEN lower(btrim(plano)) IN ('standard', 'padrao', 'padrão') THEN 'profissional'
        WHEN lower(btrim(plano)) IN ('essencial','profissional','premium') THEN lower(btrim(plano))
        ELSE 'essencial'
      END
    $q$;

    EXECUTE 'ALTER TABLE public.escolas RENAME COLUMN plano TO plano_atual';
  END IF;
END $$;

-- 3) Case B: ensure plano_atual exists and uses enum type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='escolas' AND column_name='plano_atual'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='escolas' AND column_name='plano_atual'
        AND udt_name <> 'app_plan_tier'
    ) THEN
      EXECUTE 'ALTER TABLE public.escolas ALTER COLUMN plano_atual DROP DEFAULT';
      EXECUTE 'ALTER TABLE public.escolas ALTER COLUMN plano_atual TYPE public.app_plan_tier USING lower(btrim(plano_atual::text))::public.app_plan_tier';
    END IF;

    EXECUTE 'ALTER TABLE public.escolas ALTER COLUMN plano_atual SET DEFAULT ''essencial''';
    EXECUTE 'ALTER TABLE public.escolas ALTER COLUMN plano_atual SET NOT NULL';
  ELSE
    EXECUTE 'ALTER TABLE public.escolas ADD COLUMN plano_atual public.app_plan_tier NOT NULL DEFAULT ''essencial''';
  END IF;
END $$;

-- 4) View compatibility (retains legacy columns)
CREATE OR REPLACE VIEW public.escolas_view AS
SELECT
  e.id,
  e.nome,
  e.status,
  e.plano_atual,
  e.plano_atual::text AS plano,
  NULL::timestamp AS last_access,
  COALESCE(a.total_alunos, 0) AS total_alunos,
  COALESCE(pf.total_professores, 0) AS total_professores,
  e.endereco AS cidade,
  NULL::text AS estado
FROM public.escolas e
LEFT JOIN (
  SELECT escola_id, COUNT(*)::int AS total_alunos
  FROM public.alunos
  GROUP BY escola_id
) a ON a.escola_id = e.id
LEFT JOIN (
  SELECT p.escola_id, COUNT(*)::int AS total_professores
  FROM public.profiles p
  WHERE p.role = 'professor'
  GROUP BY p.escola_id
) pf ON pf.escola_id = e.id;

-- 5) Feature check helper
CREATE OR REPLACE FUNCTION public.escola_has_feature(p_escola_id uuid, p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.app_plan_tier := 'essencial';
  v_feature text := lower(btrim(coalesce(p_feature, '')));
BEGIN
  SELECT plano_atual INTO v_plan FROM public.escolas WHERE id = p_escola_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  CASE v_feature
    WHEN 'fin_recibo_pdf' THEN RETURN v_plan IN ('profissional', 'premium');
    WHEN 'sec_upload_docs' THEN RETURN v_plan IN ('profissional', 'premium');
    WHEN 'sec_matricula_online' THEN RETURN v_plan = 'premium';
    WHEN 'doc_qr_code' THEN RETURN v_plan = 'premium';
    WHEN 'app_whatsapp_auto' THEN RETURN v_plan = 'premium';
    WHEN 'suporte_prioritario' THEN RETURN v_plan = 'premium';
    ELSE RETURN FALSE;
  END CASE;
END;
$$;

-- 6) Ensure API layers refresh schemas
NOTIFY pgrst, 'reload schema';

COMMIT;
