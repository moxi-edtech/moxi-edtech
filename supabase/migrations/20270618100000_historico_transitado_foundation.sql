BEGIN;

ALTER TABLE public.historico_anos
  ADD COLUMN IF NOT EXISTS status_final text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.historico_anos
SET status_final = COALESCE(status_final, resultado_final)
WHERE status_final IS NULL;

ALTER TABLE public.historico_disciplinas
  ADD COLUMN IF NOT EXISTS disciplina_nome text,
  ADD COLUMN IF NOT EXISTS nota_final numeric(6,2),
  ADD COLUMN IF NOT EXISTS status_final text,
  ADD COLUMN IF NOT EXISTS notas_detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.historico_disciplinas hd
SET disciplina_nome = COALESCE(hd.disciplina_nome, dc.nome),
    nota_final = COALESCE(hd.nota_final, hd.media_final),
    status_final = COALESCE(hd.status_final, hd.resultado),
    notas_detalhe = COALESCE(hd.notas_detalhe, '{}'::jsonb)
FROM public.disciplinas_catalogo dc
WHERE dc.id = hd.disciplina_id
  AND (
    hd.disciplina_nome IS NULL
    OR hd.nota_final IS NULL
    OR hd.status_final IS NULL
    OR hd.notas_detalhe IS NULL
  );

CREATE OR REPLACE FUNCTION public.sync_historico_anos_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_final IS NULL THEN
    NEW.status_final := NEW.resultado_final;
  END IF;

  IF NEW.resultado_final IS NULL THEN
    NEW.resultado_final := NEW.status_final;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_historico_anos_compat ON public.historico_anos;
CREATE TRIGGER trg_sync_historico_anos_compat
BEFORE INSERT OR UPDATE ON public.historico_anos
FOR EACH ROW
EXECUTE FUNCTION public.sync_historico_anos_compat();

CREATE OR REPLACE FUNCTION public.sync_historico_disciplinas_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nota_final IS NULL THEN
    NEW.nota_final := NEW.media_final;
  END IF;

  IF NEW.media_final IS NULL THEN
    NEW.media_final := NEW.nota_final;
  END IF;

  IF NEW.status_final IS NULL THEN
    NEW.status_final := NEW.resultado;
  END IF;

  IF NEW.resultado IS NULL THEN
    NEW.resultado := NEW.status_final;
  END IF;

  IF NEW.disciplina_nome IS NULL AND NEW.disciplina_id IS NOT NULL THEN
    SELECT dc.nome
    INTO NEW.disciplina_nome
    FROM public.disciplinas_catalogo dc
    WHERE dc.id = NEW.disciplina_id;
  END IF;

  IF NEW.notas_detalhe IS NULL THEN
    NEW.notas_detalhe := '{}'::jsonb;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_historico_disciplinas_compat ON public.historico_disciplinas;
CREATE TRIGGER trg_sync_historico_disciplinas_compat
BEFORE INSERT OR UPDATE ON public.historico_disciplinas
FOR EACH ROW
EXECUTE FUNCTION public.sync_historico_disciplinas_compat();

CREATE TABLE IF NOT EXISTS public.historico_transitado_anos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  classe_id uuid NOT NULL REFERENCES public.classes(id),
  classe_nome text NOT NULL,
  curso_id uuid REFERENCES public.cursos(id),
  curso_nome text,
  ano_letivo integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT ux_historico_transitado_anos UNIQUE (escola_id, aluno_id, classe_id, ano_letivo)
);

CREATE TABLE IF NOT EXISTS public.historico_transitado_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historico_transitado_ano_id uuid NOT NULL REFERENCES public.historico_transitado_anos(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id),
  disciplina_nome text NOT NULL,
  ordem integer,
  nota_final numeric(6,2) NOT NULL CHECK (nota_final >= 0 AND nota_final <= 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_historico_transitado_notas UNIQUE (historico_transitado_ano_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_historico_transitado_anos_escola_aluno
  ON public.historico_transitado_anos (escola_id, aluno_id, ano_letivo DESC);

CREATE INDEX IF NOT EXISTS idx_historico_transitado_notas_ano
  ON public.historico_transitado_notas (historico_transitado_ano_id, ordem, disciplina_nome);

ALTER TABLE public.historico_transitado_anos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_transitado_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historico_transitado_anos_select ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_select
ON public.historico_transitado_anos
FOR SELECT
TO authenticated
USING (public.is_staff_escola(escola_id) OR public.is_super_admin());

DROP POLICY IF EXISTS historico_transitado_anos_insert ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_insert
ON public.historico_transitado_anos
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff_escola(escola_id) OR public.is_super_admin());

DROP POLICY IF EXISTS historico_transitado_anos_update ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_update
ON public.historico_transitado_anos
FOR UPDATE
TO authenticated
USING (public.is_staff_escola(escola_id) OR public.is_super_admin())
WITH CHECK (public.is_staff_escola(escola_id) OR public.is_super_admin());

DROP POLICY IF EXISTS historico_transitado_anos_delete ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_delete
ON public.historico_transitado_anos
FOR DELETE
TO authenticated
USING (public.is_staff_escola(escola_id) OR public.is_super_admin());

DROP POLICY IF EXISTS historico_transitado_notas_select ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_select
ON public.historico_transitado_notas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND (public.is_staff_escola(hta.escola_id) OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_insert ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_insert
ON public.historico_transitado_notas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND (public.is_staff_escola(hta.escola_id) OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_update ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_update
ON public.historico_transitado_notas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND (public.is_staff_escola(hta.escola_id) OR public.is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND (public.is_staff_escola(hta.escola_id) OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_delete ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_delete
ON public.historico_transitado_notas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND (public.is_staff_escola(hta.escola_id) OR public.is_super_admin())
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_transitado_anos TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_transitado_notas TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_historico_transitado(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_classe_id uuid,
  p_ano_letivo integer,
  p_notas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_classe record;
  v_ano_record public.historico_transitado_anos%ROWTYPE;
  v_nota jsonb;
  v_disciplina_id uuid;
  v_disciplina_nome text;
  v_nota_final numeric(6,2);
  v_ordem integer;
  v_total_notas integer := 0;
BEGIN
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']
  )
  INTO v_has_permission;

  IF NOT COALESCE(v_has_permission, false) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_ano_letivo < 1900 OR p_ano_letivo > 2100 THEN
    RAISE EXCEPTION 'DATA: ano letivo inválido.';
  END IF;

  IF jsonb_typeof(p_notas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_notas) = 0 THEN
    RAISE EXCEPTION 'DATA: pelo menos uma nota é obrigatória.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = p_aluno_id
      AND a.escola_id = v_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: aluno não encontrado para esta escola.';
  END IF;

  SELECT
    cl.id,
    cl.nome AS classe_nome,
    cl.curso_id,
    cu.nome AS curso_nome
  INTO v_classe
  FROM public.classes cl
  LEFT JOIN public.cursos cu
    ON cu.id = cl.curso_id
  WHERE cl.id = p_classe_id
    AND cl.escola_id = v_escola_id;

  IF v_classe.id IS NULL THEN
    RAISE EXCEPTION 'DATA: classe inválida para esta escola.';
  END IF;

  INSERT INTO public.historico_transitado_anos (
    escola_id,
    aluno_id,
    classe_id,
    classe_nome,
    curso_id,
    curso_nome,
    ano_letivo,
    created_by,
    updated_by
  )
  VALUES (
    v_escola_id,
    p_aluno_id,
    v_classe.id,
    v_classe.classe_nome,
    v_classe.curso_id,
    v_classe.curso_nome,
    p_ano_letivo,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (escola_id, aluno_id, classe_id, ano_letivo) DO UPDATE
  SET classe_nome = EXCLUDED.classe_nome,
      curso_id = EXCLUDED.curso_id,
      curso_nome = EXCLUDED.curso_nome,
      updated_at = now(),
      updated_by = auth.uid()
  RETURNING * INTO v_ano_record;

  DELETE FROM public.historico_transitado_notas
  WHERE historico_transitado_ano_id = v_ano_record.id;

  FOR v_nota IN
    SELECT value
    FROM jsonb_array_elements(p_notas)
  LOOP
    v_disciplina_id := NULLIF(TRIM(v_nota->>'disciplina_id'), '')::uuid;
    v_disciplina_nome := NULLIF(TRIM(v_nota->>'disciplina_nome'), '');
    v_nota_final := NULLIF(TRIM(v_nota->>'nota_final'), '')::numeric;
    v_ordem := NULLIF(TRIM(v_nota->>'ordem'), '')::integer;

    IF v_disciplina_id IS NULL OR v_disciplina_nome IS NULL THEN
      RAISE EXCEPTION 'DATA: disciplina inválida no payload.';
    END IF;

    IF v_nota_final IS NULL OR v_nota_final < 0 OR v_nota_final > 20 THEN
      RAISE EXCEPTION 'DATA: nota final inválida para a disciplina %.', v_disciplina_nome;
    END IF;

    INSERT INTO public.historico_transitado_notas (
      historico_transitado_ano_id,
      disciplina_id,
      disciplina_nome,
      ordem,
      nota_final
    )
    VALUES (
      v_ano_record.id,
      v_disciplina_id,
      v_disciplina_nome,
      v_ordem,
      v_nota_final
    );

    v_total_notas := v_total_notas + 1;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    auth.uid(),
    'HISTORICO_TRANSITADO_UPSERT',
    'historico_transitado_anos',
    v_ano_record.id::text,
    'secretaria',
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'classe_id', v_classe.id,
      'classe_nome', v_classe.classe_nome,
      'ano_letivo', p_ano_letivo,
      'total_notas', v_total_notas
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'historico_transitado_ano_id', v_ano_record.id,
    'classe_nome', v_classe.classe_nome,
    'ano_letivo', p_ano_letivo,
    'total_notas', v_total_notas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado(uuid, uuid, uuid, integer, jsonb) TO authenticated;

COMMIT;
