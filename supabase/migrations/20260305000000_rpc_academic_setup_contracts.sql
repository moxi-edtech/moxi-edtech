BEGIN;

CREATE OR REPLACE FUNCTION public.get_setup_state(
  p_escola_id uuid,
  p_ano_letivo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_ano_ativo boolean := false;
  v_periodos_count integer := 0;
  v_periodos_overlap boolean := false;
  v_periodos_peso_total integer := 0;
  v_periodos_trava_invalid boolean := false;
  v_periodos_ok boolean := false;
  v_avaliacao_ok boolean := false;
  v_curriculo_draft_ok boolean := false;
  v_curriculo_published_ok boolean := false;
  v_turmas_count integer := 0;
  v_turmas_sem_disciplinas integer := 0;
  v_turmas_ok boolean := false;
  v_blockers jsonb := '[]'::jsonb;
  v_stage text := 'SETUP_EMPTY';
  v_next_action jsonb;
  v_config_href text := format('/escola/%s/admin/configuracoes/academico-completo', p_escola_id);
  v_avaliacao_href text := format('/escola/%s/admin/configuracoes/avaliacao-frequencia', p_escola_id);
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, ativo
    INTO v_ano_letivo_id, v_ano_ativo
    FROM public.anos_letivos
   WHERE escola_id = p_escola_id
     AND ano = p_ano_letivo
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_ano_letivo_id IS NOT NULL THEN
    SELECT count(*)::int
      INTO v_periodos_count
      FROM public.periodos_letivos
     WHERE escola_id = p_escola_id
       AND ano_letivo_id = v_ano_letivo_id;

    SELECT EXISTS (
      SELECT 1
        FROM public.periodos_letivos p1
        JOIN public.periodos_letivos p2
          ON p1.id < p2.id
         AND p1.ano_letivo_id = v_ano_letivo_id
         AND daterange(p1.data_inicio, p1.data_fim, '[]') && daterange(p2.data_inicio, p2.data_fim, '[]')
    )
      INTO v_periodos_overlap;

    SELECT COALESCE(SUM(peso), 0)
      INTO v_periodos_peso_total
      FROM public.periodos_letivos
     WHERE escola_id = p_escola_id
       AND ano_letivo_id = v_ano_letivo_id
       AND peso IS NOT NULL;

    SELECT EXISTS (
      SELECT 1
        FROM public.periodos_letivos pl
       WHERE pl.escola_id = p_escola_id
         AND pl.ano_letivo_id = v_ano_letivo_id
         AND pl.trava_notas_em IS NOT NULL
         AND pl.trava_notas_em::date < pl.data_fim
    )
      INTO v_periodos_trava_invalid;

    v_periodos_ok := v_periodos_count > 0
      AND NOT v_periodos_overlap
      AND (v_periodos_peso_total IN (0, 100))
      AND NOT v_periodos_trava_invalid;

    SELECT EXISTS (
      SELECT 1
        FROM public.configuracoes_escola
       WHERE escola_id = p_escola_id
         AND modelo_avaliacao IS NOT NULL
    )
      INTO v_avaliacao_ok;

    SELECT EXISTS (
      SELECT 1
        FROM public.curso_curriculos
       WHERE escola_id = p_escola_id
         AND ano_letivo_id = v_ano_letivo_id
         AND status = 'draft'
    )
      INTO v_curriculo_draft_ok;

    SELECT EXISTS (
      SELECT 1
        FROM public.curso_curriculos
       WHERE escola_id = p_escola_id
         AND ano_letivo_id = v_ano_letivo_id
         AND status = 'published'
    )
      INTO v_curriculo_published_ok;

    SELECT count(*)::int
      INTO v_turmas_count
      FROM public.turmas
     WHERE escola_id = p_escola_id
       AND ano_letivo = p_ano_letivo;

    SELECT count(*)::int
      INTO v_turmas_sem_disciplinas
      FROM public.turmas t
     WHERE t.escola_id = p_escola_id
       AND t.ano_letivo = p_ano_letivo
       AND NOT EXISTS (
        SELECT 1
          FROM public.turma_disciplinas td
         WHERE td.escola_id = t.escola_id
           AND td.turma_id = t.id
       );

    v_turmas_ok := v_turmas_count > 0 AND v_turmas_sem_disciplinas = 0;
  END IF;

  IF v_ano_letivo_id IS NULL OR v_ano_ativo IS NOT TRUE THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_ACTIVE_ANO_LETIVO',
      'severity', 'P0',
      'title', 'Ano letivo ativo não encontrado',
      'detail', 'Defina um ano letivo ativo para continuar.',
      'fix_cta', jsonb_build_object('label', 'Configurar ano letivo', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND v_periodos_count = 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PERIODOS_INVALID',
      'severity', 'P0',
      'title', 'Períodos letivos ausentes',
      'detail', 'Crie os períodos do ano letivo antes de avançar.',
      'fix_cta', jsonb_build_object('label', 'Configurar períodos', 'href', v_config_href)
    ));
  END IF;

  IF v_periodos_overlap THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PERIODOS_OVERLAP',
      'severity', 'P0',
      'title', 'Períodos sobrepostos',
      'detail', 'Revise as datas para evitar conflitos.',
      'fix_cta', jsonb_build_object('label', 'Revisar períodos', 'href', v_config_href)
    ));
  END IF;

  IF v_periodos_peso_total NOT IN (0, 100) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PESOS_NOT_100',
      'severity', 'P0',
      'title', 'Pesos dos períodos incoerentes',
      'detail', 'A soma dos pesos deve fechar 100%.',
      'fix_cta', jsonb_build_object('label', 'Revisar pesos', 'href', v_config_href)
    ));
  END IF;

  IF v_periodos_trava_invalid THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'PERIODOS_INVALID',
      'severity', 'P0',
      'title', 'Trava de notas inválida',
      'detail', 'A trava deve ser igual ou posterior ao fim do período.',
      'fix_cta', jsonb_build_object('label', 'Revisar travas', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND NOT v_avaliacao_ok THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_AVALIACAO_MODEL',
      'severity', 'P1',
      'title', 'Modelo de avaliação pendente',
      'detail', 'Defina o modelo de avaliação e frequência.',
      'fix_cta', jsonb_build_object('label', 'Configurar avaliação', 'href', v_avaliacao_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND NOT v_curriculo_draft_ok THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_CURRICULO_DRAFT',
      'severity', 'P1',
      'title', 'Currículo rascunho ausente',
      'detail', 'Aplique um preset para criar o currículo.',
      'fix_cta', jsonb_build_object('label', 'Aplicar preset', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND NOT v_curriculo_published_ok THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_CURRICULO_PUBLISHED',
      'severity', 'P0',
      'title', 'Currículo publicado ausente',
      'detail', 'Publique o currículo antes de gerar turmas.',
      'fix_cta', jsonb_build_object('label', 'Publicar currículo', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND v_turmas_count = 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'NO_TURMAS',
      'severity', 'P0',
      'title', 'Nenhuma turma gerada',
      'detail', 'Gere turmas a partir do currículo publicado.',
      'fix_cta', jsonb_build_object('label', 'Gerar turmas', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND v_turmas_sem_disciplinas > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'TURMAS_MISSING_DISCIPLINAS',
      'severity', 'P0',
      'title', 'Turmas sem disciplinas',
      'detail', 'Republique o currículo para reconstruir disciplinas.',
      'fix_cta', jsonb_build_object('label', 'Reconstruir disciplinas', 'href', v_config_href)
    ));
  END IF;

  IF v_ano_letivo_id IS NOT NULL AND v_ano_ativo THEN
    v_stage := 'SETUP_TEMPORAL_OK';
  END IF;
  IF v_periodos_ok AND v_avaliacao_ok THEN
    v_stage := 'SETUP_AVALIACAO_OK';
  END IF;
  IF v_curriculo_draft_ok THEN
    v_stage := 'SETUP_CURRICULO_DRAFT_OK';
  END IF;
  IF v_curriculo_published_ok THEN
    v_stage := 'SETUP_CURRICULO_PUBLISHED_OK';
  END IF;
  IF v_turmas_ok THEN
    v_stage := 'SETUP_TURMAS_OK';
  END IF;
  IF v_ano_ativo AND v_periodos_ok AND v_avaliacao_ok AND v_curriculo_published_ok AND v_turmas_ok THEN
    v_stage := 'SETUP_READY';
  END IF;

  v_next_action := jsonb_build_object(
    'key',
      CASE
        WHEN v_ano_letivo_id IS NULL OR v_ano_ativo IS NOT TRUE THEN 'CONFIGURE_ANO_LETIVO'
        WHEN NOT v_periodos_ok THEN 'CONFIGURE_PERIODOS'
        WHEN NOT v_avaliacao_ok THEN 'CONFIGURE_AVALIACAO'
        WHEN NOT v_curriculo_draft_ok THEN 'APPLY_PRESET'
        WHEN NOT v_curriculo_published_ok THEN 'PUBLISH_CURRICULO'
        WHEN NOT v_turmas_ok THEN 'GENERATE_TURMAS'
        ELSE 'RUN_VALIDATION'
      END,
    'label',
      CASE
        WHEN v_ano_letivo_id IS NULL OR v_ano_ativo IS NOT TRUE THEN 'Configurar ano letivo'
        WHEN NOT v_periodos_ok THEN 'Configurar períodos'
        WHEN NOT v_avaliacao_ok THEN 'Configurar avaliação'
        WHEN NOT v_curriculo_draft_ok THEN 'Aplicar preset curricular'
        WHEN NOT v_curriculo_published_ok THEN 'Publicar currículo'
        WHEN NOT v_turmas_ok THEN 'Gerar turmas'
        ELSE 'Rodar validações'
      END,
    'href',
      CASE
        WHEN v_ano_letivo_id IS NULL OR v_ano_ativo IS NOT TRUE THEN v_config_href
        WHEN NOT v_periodos_ok THEN v_config_href
        WHEN NOT v_avaliacao_ok THEN v_avaliacao_href
        WHEN NOT v_curriculo_draft_ok THEN v_config_href
        WHEN NOT v_curriculo_published_ok THEN v_config_href
        WHEN NOT v_turmas_ok THEN v_config_href
        ELSE v_config_href
      END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'escola_id', p_escola_id,
    'ano_letivo', p_ano_letivo,
    'stage', v_stage,
    'badges', jsonb_build_object(
      'ano_letivo_ok', v_ano_letivo_id IS NOT NULL AND v_ano_ativo,
      'periodos_ok', v_periodos_ok,
      'avaliacao_ok', v_avaliacao_ok,
      'curriculo_draft_ok', v_curriculo_draft_ok,
      'curriculo_published_ok', v_curriculo_published_ok,
      'turmas_ok', v_turmas_ok
    ),
    'blockers', v_blockers,
    'next_action', v_next_action
  );
END;
$$;

ALTER FUNCTION public.get_setup_state(uuid, integer) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_setup_state(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_config_impact(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_changes jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursos integer := 0;
  v_classes integer := 0;
  v_disciplinas integer := 0;
  v_turmas integer := 0;
  v_alunos integer := 0;
  v_professores integer := 0;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::int INTO v_cursos FROM public.cursos WHERE escola_id = p_escola_id;
  SELECT count(*)::int INTO v_classes FROM public.classes WHERE escola_id = p_escola_id;
  SELECT count(DISTINCT disciplina_id)::int INTO v_disciplinas FROM public.curso_matriz WHERE escola_id = p_escola_id;
  SELECT count(*)::int INTO v_turmas FROM public.turmas WHERE escola_id = p_escola_id AND ano_letivo = p_ano_letivo;
  SELECT count(*)::int INTO v_alunos FROM public.matriculas WHERE escola_id = p_escola_id AND ano_letivo = p_ano_letivo;
  SELECT count(*)::int INTO v_professores FROM public.professores WHERE escola_id = p_escola_id;

  RETURN jsonb_build_object(
    'ok', true,
    'escola_id', p_escola_id,
    'ano_letivo', p_ano_letivo,
    'counts', jsonb_build_object(
      'cursos_afetados', v_cursos,
      'classes_afetadas', v_classes,
      'disciplinas_afetadas', v_disciplinas,
      'turmas_afetadas', v_turmas,
      'alunos_afetados', v_alunos,
      'professores_afetados', v_professores
    ),
    'risk_flags', '[]'::jsonb,
    'preview_diff', '[]'::jsonb
  );
END;
$$;

ALTER FUNCTION public.get_config_impact(uuid, integer, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_config_impact(uuid, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.preview_apply_changes(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_changes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_preview_id uuid := gen_random_uuid();
  v_periodos jsonb := '[]'::jsonb;
  v_avaliacao jsonb := null;
  v_curriculo_status text := 'none';
  v_curriculo_disciplinas jsonb := '[]'::jsonb;
  v_turmas jsonb := '[]'::jsonb;
  v_validations jsonb := '[]'::jsonb;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id
    INTO v_ano_letivo_id
    FROM public.anos_letivos
   WHERE escola_id = p_escola_id
     AND ano = p_ano_letivo
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    v_validations := v_validations || jsonb_build_array(jsonb_build_object(
      'code', 'NO_ACTIVE_ANO_LETIVO',
      'severity', 'P0',
      'message', 'Ano letivo não encontrado para o preview.'
    ));
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'numero', numero,
      'tipo', tipo,
      'data_inicio', data_inicio,
      'data_fim', data_fim,
      'trava_notas_em', trava_notas_em
    )), '[]'::jsonb)
      INTO v_periodos
      FROM public.periodos_letivos
     WHERE escola_id = p_escola_id
       AND ano_letivo_id = v_ano_letivo_id;

    SELECT jsonb_build_object(
      'modelo_avaliacao', modelo_avaliacao,
      'avaliacao_config', avaliacao_config,
      'frequencia_modelo', frequencia_modelo,
      'frequencia_min_percent', frequencia_min_percent
    )
      INTO v_avaliacao
      FROM public.configuracoes_escola
     WHERE escola_id = p_escola_id;

    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.curso_curriculos
           WHERE escola_id = p_escola_id
             AND ano_letivo_id = v_ano_letivo_id
             AND status = 'published'
        ) THEN 'published'
        WHEN EXISTS (
          SELECT 1 FROM public.curso_curriculos
           WHERE escola_id = p_escola_id
             AND ano_letivo_id = v_ano_letivo_id
             AND status = 'draft'
        ) THEN 'draft'
        ELSE 'none'
      END
      INTO v_curriculo_status;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'nome', nome,
      'turno', turno,
      'curso_id', curso_id,
      'classe_id', classe_id
    )), '[]'::jsonb)
      INTO v_turmas
      FROM public.turmas
     WHERE escola_id = p_escola_id
       AND ano_letivo = p_ano_letivo;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'preview_id', v_preview_id,
    'school', jsonb_build_object('escola_id', p_escola_id, 'ano_letivo', p_ano_letivo),
    'simulated', jsonb_build_object(
      'periodos', v_periodos,
      'avaliacao_modelo', v_avaliacao,
      'curriculo', jsonb_build_object(
        'status', v_curriculo_status,
        'disciplinas', v_curriculo_disciplinas
      ),
      'turmas', v_turmas
    ),
    'validations', v_validations,
    'sample_outputs', jsonb_build_object()
  );
END;
$$;

ALTER FUNCTION public.preview_apply_changes(uuid, integer, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.preview_apply_changes(uuid, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.config_commit(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_changes jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_commit_id uuid := gen_random_uuid();
  v_audit_id bigint;
  v_setup_state jsonb;
BEGIN
  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin_escola', 'secretaria', 'admin']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
      'commit_id', details->>'commit_id',
      'audit_log_id', id
    )
    INTO v_existing
    FROM public.audit_logs
   WHERE escola_id = p_escola_id
     AND action = 'CONFIG_COMMIT'
     AND details->>'idempotency_key' = p_idempotency_key
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    v_setup_state := public.get_setup_state(p_escola_id, p_ano_letivo);
    RETURN jsonb_build_object(
      'ok', true,
      'commit_id', v_existing->>'commit_id',
      'applied', '[]'::jsonb,
      'audit_log_id', v_existing->>'audit_log_id',
      'setup_state_after', v_setup_state
    );
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,
    actor_id,
    action,
    entity,
    portal,
    details
  ) VALUES (
    p_escola_id,
    auth.uid(),
    'CONFIG_COMMIT',
    'configuracoes_escola',
    'admin',
    jsonb_build_object(
      'commit_id', v_commit_id,
      'idempotency_key', p_idempotency_key,
      'changes', p_changes,
      'status', 'skeleton'
    )
  ) RETURNING id INTO v_audit_id;

  v_setup_state := public.get_setup_state(p_escola_id, p_ano_letivo);

  RETURN jsonb_build_object(
    'ok', true,
    'commit_id', v_commit_id,
    'applied', '[]'::jsonb,
    'audit_log_id', v_audit_id,
    'setup_state_after', v_setup_state
  );
END;
$$;

ALTER FUNCTION public.config_commit(uuid, integer, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.config_commit(uuid, integer, jsonb, text) TO authenticated;

COMMIT;
