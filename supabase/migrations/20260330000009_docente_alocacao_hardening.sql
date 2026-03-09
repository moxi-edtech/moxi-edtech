-- 1) Unicidade multi-tenant explícita em turma_disciplinas_professores
ALTER TABLE public.turma_disciplinas_professores
  DROP CONSTRAINT IF EXISTS uq_tdp_unique;

ALTER TABLE public.turma_disciplinas_professores
  ADD CONSTRAINT uq_tdp_unique_escola
  UNIQUE (escola_id, turma_id, disciplina_id);

-- 2) Guardrail de alocação docente no quadro_horarios
CREATE OR REPLACE FUNCTION public.trg_validate_quadro_docente_alocacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.professor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.turma_disciplinas td
    WHERE td.escola_id = NEW.escola_id
      AND td.turma_id = NEW.turma_id
      AND td.curso_matriz_id = NEW.disciplina_id
      AND td.professor_id = NEW.professor_id
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = NEW.escola_id
      AND tdp.turma_id = NEW.turma_id
      AND tdp.disciplina_id = NEW.disciplina_id
      AND tdp.professor_id = NEW.professor_id
  ) THEN
    RAISE EXCEPTION 'DOCENTE_NAO_ALOCADO: professor % não está alocado à disciplina % na turma %',
      NEW.professor_id, NEW.disciplina_id, NEW.turma_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quadro_docente_alocacao ON public.quadro_horarios;
CREATE TRIGGER trg_validate_quadro_docente_alocacao
BEFORE INSERT OR UPDATE ON public.quadro_horarios
FOR EACH ROW EXECUTE FUNCTION public.trg_validate_quadro_docente_alocacao();

-- 3) RLS de notas: escrita direta apenas admin/secretaria
DROP POLICY IF EXISTS notas_insert ON public.notas;
DROP POLICY IF EXISTS notas_update ON public.notas;
DROP POLICY IF EXISTS notas_delete ON public.notas;

CREATE POLICY notas_insert_admin_secretaria ON public.notas
FOR INSERT TO authenticated
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin','staff_admin'])
);

CREATE POLICY notas_update_admin_secretaria ON public.notas
FOR UPDATE TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin','staff_admin'])
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin','staff_admin'])
);

CREATE POLICY notas_delete_admin_secretaria ON public.notas
FOR DELETE TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','admin','staff_admin'])
);

DROP POLICY IF EXISTS tenant_all_access ON public.notas;

CREATE POLICY notas_select_tenant ON public.notas
FOR SELECT TO authenticated
USING (
  escola_id = public.current_tenant_escola_id()
  AND (
    public.user_has_role_in_school(escola_id, ARRAY['admin_escola','secretaria','professor','admin','staff_admin','admin_financeiro','secretaria_financeiro'])
    OR EXISTS (
      SELECT 1
      FROM (public.matriculas m
        JOIN public.alunos a ON a.id = m.aluno_id)
      WHERE m.id = notas.matricula_id
        AND a.escola_id = notas.escola_id
        AND (a.usuario_auth_id = auth.uid() OR a.profile_id = auth.uid())
    )
  )
);

-- 4) RPC com p_is_isento: validação de alocação docente
CREATE OR REPLACE FUNCTION public.lancar_notas_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_turma_disciplina_id uuid,
  p_trimestre integer,
  p_tipo_avaliacao text,
  p_notas jsonb,
  p_is_isento boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_avaliacao_id uuid;
  v_is_professor_assigned boolean := false;
  v_ano_letivo int;
  v_is_admin boolean := false;
  v_portal text := 'professor';
  v_actor_papel text := null;
  v_actor_role text := null;
  v_ano_letivo_id uuid;
  v_periodo_letivo_id uuid;
  nota_record jsonb;
  v_matricula_id uuid;
  v_rows_to_upsert jsonb[] := '{}';
  v_inserted_count bigint;
  v_updated_count bigint;
BEGIN
  SELECT eu.papel INTO v_actor_papel
  FROM public.escola_users eu
  WHERE eu.user_id = v_actor_id
    AND eu.escola_id = p_escola_id
  LIMIT 1;

  SELECT pr.role INTO v_actor_role
  FROM public.profiles pr
  WHERE pr.user_id = v_actor_id
  ORDER BY pr.created_at DESC
  LIMIT 1;

  SELECT p.id INTO v_professor_id
  FROM public.professores p
  WHERE p.profile_id = v_actor_id
    AND p.escola_id = p_escola_id;

  IF v_professor_id IS NULL THEN
    SELECT true INTO v_is_admin
    FROM public.escola_users eu
    WHERE eu.user_id = v_actor_id
      AND eu.escola_id = p_escola_id
      AND eu.papel IN ('admin_escola', 'admin', 'staff_admin', 'secretaria')
    LIMIT 1;

    IF NOT v_is_admin THEN
      SELECT true INTO v_is_admin
      FROM public.profiles pr
      WHERE pr.user_id = v_actor_id
        AND pr.role IN ('admin', 'super_admin', 'global_admin')
      LIMIT 1;
    END IF;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'AUTH: Professor não encontrado para este usuário.';
    END IF;
  END IF;

  IF v_is_admin THEN
    v_portal := 'secretaria';
  END IF;

  SELECT t.id, t.escola_id, t.curso_id, t.classe_id, t.ano_letivo
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'DATA: Turma não encontrada.'; END IF;
  v_ano_letivo := v_turma.ano_letivo;

  SELECT td.id, td.professor_id, td.curso_matriz_id
  INTO v_turma_disciplina
  FROM public.turma_disciplinas td
  WHERE td.id = p_turma_disciplina_id AND td.escola_id = p_escola_id;
  IF v_turma_disciplina.id IS NULL THEN RAISE EXCEPTION 'DATA: Disciplina da turma não encontrada.'; END IF;

  SELECT al.id INTO v_ano_letivo_id
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ano = v_ano_letivo
  LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    SELECT al.id INTO v_ano_letivo_id
    FROM public.anos_letivos al
    WHERE al.escola_id = p_escola_id
      AND al.ativo = true
    LIMIT 1;
  END IF;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Ano letivo não encontrado.';
  END IF;

  SELECT pl.id INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  WHERE pl.escola_id = p_escola_id
    AND pl.ano_letivo_id = v_ano_letivo_id
    AND pl.tipo = 'TRIMESTRE'
    AND pl.numero = p_trimestre
  LIMIT 1;

  IF v_periodo_letivo_id IS NULL THEN
    RAISE EXCEPTION 'DATA: Período letivo não encontrado.';
  END IF;

  IF NOT v_is_admin THEN
    v_is_professor_assigned := v_turma_disciplina.professor_id = v_professor_id;
    IF NOT v_is_professor_assigned THEN
      SELECT true INTO v_is_professor_assigned
      FROM public.turma_disciplinas_professores
      WHERE escola_id = p_escola_id
        AND turma_id = p_turma_id
        AND disciplina_id = p_disciplina_id
        AND professor_id = v_professor_id;
      IF NOT v_is_professor_assigned THEN
        RAISE EXCEPTION 'AUTH: Professor não atribuído a esta disciplina/turma.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.avaliacoes (
    escola_id,
    turma_disciplina_id,
    periodo_letivo_id,
    ano_letivo,
    trimestre,
    nome,
    tipo,
    peso,
    nota_max
  )
  VALUES (
    p_escola_id,
    p_turma_disciplina_id,
    v_periodo_letivo_id,
    v_ano_letivo,
    p_trimestre,
    p_tipo_avaliacao,
    p_tipo_avaliacao,
    1,
    20
  )
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo)
  DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_avaliacao_id;

  FOR nota_record IN SELECT * FROM jsonb_array_elements(p_notas) LOOP
    SELECT m.id INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = (nota_record->>'aluno_id')::uuid
      AND m.ano_letivo = v_ano_letivo;

    IF v_matricula_id IS NOT NULL THEN
      v_rows_to_upsert := array_append(v_rows_to_upsert, jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', (nota_record->>'valor')::numeric,
        'is_isento', COALESCE(p_is_isento, false)
      ));
    END IF;
  END LOOP;

  WITH upserted AS (
    INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor, is_isento)
    SELECT 
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric,
      (value->>'is_isento')::boolean
    FROM unnest(v_rows_to_upsert) as value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id) DO UPDATE 
      SET valor = EXCLUDED.valor,
          is_isento = EXCLUDED.is_isento,
          updated_at = now()
    RETURNING xmax
  )
  SELECT
    count(*) FILTER (WHERE xmax = 0),
    count(*) FILTER (WHERE xmax::text::int > 0)
  INTO v_inserted_count, v_updated_count
  FROM upserted;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'NOTA_LANCADA_BATCH',
    'notas',
    v_avaliacao_id::text,
    v_portal,
    jsonb_build_object(
      'is_isento', p_is_isento,
      'trimestre', p_trimestre,
      'tipo', p_tipo_avaliacao,
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'inserted', v_inserted_count,
      'updated', v_updated_count,
      'actor_role', v_actor_role,
      'actor_papel', v_actor_papel,
      'is_admin', v_is_admin
    )
  );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted_count, 'updated', v_updated_count);
END;
$$;
