-- 1) Entidade intermediária: candidaturas
CREATE TABLE IF NOT EXISTS public.candidaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  curso_id uuid NOT NULL REFERENCES public.cursos(id),
  ano_letivo int NOT NULL,
  status text DEFAULT 'pendente',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidaturas_status ON public.candidaturas(escola_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidaturas TO authenticated;
GRANT ALL ON public.candidaturas TO service_role;

ALTER TABLE public.candidaturas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'candidaturas' AND policyname = 'candidaturas_tenant_isolation'
  ) THEN
    CREATE POLICY candidaturas_tenant_isolation
      ON public.candidaturas
      FOR ALL
      TO authenticated
      USING (escola_id = public.current_tenant_escola_id())
      WITH CHECK (escola_id = public.current_tenant_escola_id());
  END IF;
END$$;

-- 2) Trigger para número de processo automático (sem input manual)
DROP TRIGGER IF EXISTS trg_alunos_set_processo ON public.alunos;
DROP TRIGGER IF EXISTS trg_auto_numero_processo ON public.alunos;

CREATE OR REPLACE FUNCTION public.trg_auto_numero_processo() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
BEGIN
  -- Evita colisão concorrente por escola
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(NEW.escola_id::text, '')));

  IF NEW.numero_processo IS NULL OR btrim(NEW.numero_processo) = '' THEN
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(numero_processo, '[^0-9]', '', 'g'), '')::bigint),
      0
    ) + 1
    INTO v_next
    FROM public.alunos
    WHERE escola_id = NEW.escola_id;

    NEW.numero_processo := lpad(v_next::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_numero_processo
BEFORE INSERT ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_numero_processo();

