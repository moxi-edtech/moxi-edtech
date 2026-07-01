BEGIN;

CREATE OR REPLACE FUNCTION public.get_school_operational_readiness(
  p_escola_id uuid,
  p_ano_letivo integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_escola record;
  v_ano_letivo_id uuid;
  v_ano_letivo integer;
  v_ano_ativo boolean := false;
  v_periodos_count integer := 0;
  v_periodos_overlap boolean := false;
  v_periodos_peso_total integer := 0;
  v_periodos_trava_invalid boolean := false;
  v_periodos_ok boolean := false;
  v_avaliacao_ok boolean := false;
  v_cursos_count integer := 0;
  v_cursos_ok boolean := false;
  v_curriculo_published_ok boolean := false;
  v_turmas_count integer := 0;
  v_turmas_sem_disciplinas integer := 0;
  v_turmas_ok boolean := false;
  v_iban_ok boolean := false;
  v_precos_count integer := 0;
  v_precos_ok boolean := false;
  v_financeiro_config_ok boolean := false;
  v_admin_count integer := 0;
  v_admin_ok boolean := false;
  v_professores_count integer := 0;
  v_professores_ok boolean := false;
  v_professor_consistency_high integer := 0;
  v_professor_consistency_ok boolean := false;
  v_horario_required_disciplinas integer := 0;
  v_horario_required_turmas integer := 0;
  v_slots_count integer := 0;
  v_slots_ok boolean := false;
  v_turmas_publicadas integer := 0;
  v_horarios_publicados_ok boolean := false;
  v_school_status_ok boolean := false;
  v_onboarding_setup_ok boolean := false;
  v_aluno_portal_ok boolean := false;
  v_admin_portal_ok boolean := false;
  v_professor_portal_ok boolean := false;
  v_academico_ok boolean := false;
  v_financeiro_ok boolean := false;
  v_equipe_ok boolean := false;
  v_horarios_ok boolean := false;
  v_portais_ok boolean := false;
  v_operational_ok boolean := false;
  v_matriculas_count integer := 0;
  v_blockers jsonb := '[]'::jsonb;
BEGIN
  SELECT
    e.id,
    e.status,
    e.onboarding_finalizado,
    e.needs_academic_setup,
    e.aluno_portal_enabled,
    e.dados_pagamento
  INTO v_escola
  FROM public.escolas e
  WHERE e.id = p_escola_id
  LIMIT 1;

  IF v_escola.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'school_not_found');
  END IF;

  IF p_ano_letivo IS NOT NULL THEN
    SELECT id, ano, ativo
      INTO v_ano_letivo_id, v_ano_letivo, v_ano_ativo
    FROM public.anos_letivos
    WHERE escola_id = p_escola_id
      AND ano = p_ano_letivo
    ORDER BY created_at DESC
    LIMIT 1;
  ELSE
    SELECT id, ano, ativo
      INTO v_ano_letivo_id, v_ano_letivo, v_ano_ativo
    FROM public.anos_letivos
    WHERE escola_id = p_escola_id
      AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  v_school_status_ok := coalesce(v_escola.status, '') NOT IN ('suspensa', 'excluida');
  v_onboarding_setup_ok := coalesce(v_escola.onboarding_finalizado, false) AND coalesce(v_escola.needs_academic_setup, true) = false;
  v_aluno_portal_ok := coalesce(v_escola.aluno_portal_enabled, false);
  v_iban_ok := nullif(trim(coalesce(v_escola.dados_pagamento->>'iban', '')), '') IS NOT NULL;

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
       AND p1.escola_id = p_escola_id
       AND p2.escola_id = p_escola_id
       AND p1.ano_letivo_id = v_ano_letivo_id
       AND p2.ano_letivo_id = v_ano_letivo_id
       AND daterange(p1.data_inicio, p1.data_fim, '[]') && daterange(p2.data_inicio, p2.data_fim, '[]')
    ) INTO v_periodos_overlap;

    SELECT COALESCE(SUM(peso), 0)::int
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
    ) INTO v_periodos_trava_invalid;

    v_periodos_ok := v_periodos_count > 0
      AND NOT v_periodos_overlap
      AND (v_periodos_peso_total IN (0, 100))
      AND NOT v_periodos_trava_invalid;

    SELECT EXISTS (
      SELECT 1
      FROM public.configuracoes_escola
      WHERE escola_id = p_escola_id
        AND modelo_avaliacao IS NOT NULL
    ) INTO v_avaliacao_ok;

    SELECT count(*)::int
      INTO v_cursos_count
    FROM public.cursos
    WHERE escola_id = p_escola_id;

    v_cursos_ok := v_cursos_count > 0;

    SELECT EXISTS (
      SELECT 1
      FROM public.curso_curriculos
      WHERE escola_id = p_escola_id
        AND ano_letivo_id = v_ano_letivo_id
        AND status = 'published'
    ) INTO v_curriculo_published_ok;

    SELECT count(*)::int
      INTO v_turmas_count
    FROM public.turmas
    WHERE escola_id = p_escola_id
      AND ano_letivo = v_ano_letivo;

    SELECT count(*)::int
      INTO v_turmas_sem_disciplinas
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.ano_letivo = v_ano_letivo
      AND NOT EXISTS (
        SELECT 1
        FROM public.turma_disciplinas td
        WHERE td.escola_id = t.escola_id
          AND td.turma_id = t.id
      );

    v_turmas_ok := v_turmas_count > 0 AND v_turmas_sem_disciplinas = 0;

    SELECT count(*)::int
      INTO v_precos_count
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = p_escola_id
      AND ft.ano_letivo = v_ano_letivo
      AND ft.dia_vencimento BETWEEN 1 AND 31
      AND (ft.valor_matricula IS NOT NULL OR ft.valor_mensalidade IS NOT NULL);

    v_precos_ok := v_precos_count > 0;

    SELECT count(*)::int
      INTO v_horario_required_disciplinas
    FROM public.turma_disciplinas td
    JOIN public.turmas t
      ON t.id = td.turma_id
     AND t.escola_id = td.escola_id
    LEFT JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id
    WHERE td.escola_id = p_escola_id
      AND t.ano_letivo = v_ano_letivo
      AND coalesce(td.entra_no_horario, cm.entra_no_horario, true) = true
      AND coalesce(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0) > 0;

    SELECT count(DISTINCT td.turma_id)::int
      INTO v_horario_required_turmas
    FROM public.turma_disciplinas td
    JOIN public.turmas t
      ON t.id = td.turma_id
     AND t.escola_id = td.escola_id
    LEFT JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id
    WHERE td.escola_id = p_escola_id
      AND t.ano_letivo = v_ano_letivo
      AND coalesce(td.entra_no_horario, cm.entra_no_horario, true) = true
      AND coalesce(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0) > 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.configuracoes_financeiro cf
    WHERE cf.escola_id = p_escola_id
      AND cf.dia_vencimento_padrao BETWEEN 1 AND 31
  ) INTO v_financeiro_config_ok;

  SELECT count(*)::int
    INTO v_admin_count
  FROM public.escola_users eu
  WHERE eu.escola_id = p_escola_id
    AND coalesce(eu.papel, eu.role, '') IN ('admin_escola', 'admin', 'staff_admin', 'admin_financeiro');

  v_admin_ok := v_admin_count > 0;

  SELECT count(*)::int
    INTO v_professores_count
  FROM public.professores p
  WHERE p.escola_id = p_escola_id;

  v_professores_ok := v_professores_count > 0;

  SELECT count(*)::int
    INTO v_matriculas_count
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id;

  SELECT COALESCE(sum(total)::int, 0)
    INTO v_professor_consistency_high
  FROM public.check_professor_operational_consistency(p_escola_id, 20)
  WHERE severity = 'high';

  v_professor_consistency_ok := v_professores_ok AND v_professor_consistency_high = 0;

  SELECT count(*)::int
    INTO v_slots_count
  FROM public.horario_slots hs
  WHERE hs.escola_id = p_escola_id;

  v_slots_ok := v_horario_required_disciplinas = 0 OR v_slots_count > 0;

  IF v_horario_required_turmas > 0 THEN
    SELECT count(DISTINCT hv.turma_id)::int
      INTO v_turmas_publicadas
    FROM public.horario_versoes hv
    WHERE hv.escola_id = p_escola_id
      AND hv.status = 'publicada'
      AND hv.turma_id IN (
        SELECT DISTINCT td.turma_id
        FROM public.turma_disciplinas td
        JOIN public.turmas t
          ON t.id = td.turma_id
         AND t.escola_id = td.escola_id
        LEFT JOIN public.curso_matriz cm
          ON cm.id = td.curso_matriz_id
        WHERE td.escola_id = p_escola_id
          AND t.ano_letivo = v_ano_letivo
          AND coalesce(td.entra_no_horario, cm.entra_no_horario, true) = true
          AND coalesce(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0) > 0
      )
      AND EXISTS (
        SELECT 1
        FROM public.quadro_horarios qh
        WHERE qh.escola_id = hv.escola_id
          AND qh.versao_id = hv.id
      );
  END IF;

  v_horarios_publicados_ok := v_horario_required_turmas = 0 OR v_turmas_publicadas = v_horario_required_turmas;

  v_admin_portal_ok := v_school_status_ok AND v_admin_ok AND v_onboarding_setup_ok;
  v_professor_portal_ok := v_school_status_ok AND v_professor_consistency_ok;

  v_academico_ok := v_ano_letivo_id IS NOT NULL
    AND v_ano_ativo
    AND v_periodos_ok
    AND v_avaliacao_ok
    AND v_cursos_ok
    AND v_curriculo_published_ok
    AND v_turmas_ok;

  v_financeiro_ok := v_iban_ok AND v_precos_ok AND v_financeiro_config_ok;
  v_equipe_ok := v_admin_ok AND v_professores_ok AND v_professor_consistency_ok;
  v_horarios_ok := v_slots_ok AND v_horarios_publicados_ok;
  v_portais_ok := v_admin_portal_ok AND v_professor_portal_ok AND v_aluno_portal_ok;

  v_operational_ok := v_school_status_ok
    AND v_onboarding_setup_ok
    AND v_academico_ok
    AND v_financeiro_ok
    AND v_equipe_ok
    AND v_horarios_ok
    AND v_portais_ok;

  IF NOT v_school_status_ok THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'SCHOOL_STATUS_BLOCKED',
      'area', 'lifecycle',
      'severity', 'critical',
      'title', 'Escola suspensa ou excluída',
      'detail', 'A escola precisa estar ativa para operar todos os portais.'
    ));
  END IF;

  IF NOT v_onboarding_setup_ok THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'ONBOARDING_NOT_FINISHED',
      'area', 'lifecycle',
      'severity', 'critical',
      'title', 'Setup escolar ainda não finalizado',
      'detail', 'O wizard académico/financeiro do portal escolar ainda não foi concluído.'
    ));
  END IF;

  IF NOT v_academico_ok THEN
    IF v_ano_letivo_id IS NULL OR NOT v_ano_ativo THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_YEAR_MISSING',
        'area', 'academico',
        'severity', 'critical',
        'title', 'Ano letivo ativo ausente',
        'detail', 'Defina um ano letivo ativo antes de considerar a escola operacional.'
      ));
    END IF;

    IF NOT v_periodos_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_PERIODS_INVALID',
        'area', 'academico',
        'severity', 'critical',
        'title', 'Períodos letivos inválidos',
        'detail', 'Revise períodos, pesos e travas de notas do ano ativo.'
      ));
    END IF;

    IF NOT v_avaliacao_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_EVALUATION_MISSING',
        'area', 'academico',
        'severity', 'high',
        'title', 'Modelo de avaliação não configurado',
        'detail', 'Avaliação e frequência precisam estar configuradas.'
      ));
    END IF;

    IF NOT v_cursos_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_COURSES_MISSING',
        'area', 'academico',
        'severity', 'high',
        'title', 'Estrutura de cursos ausente',
        'detail', 'A escola precisa ter cursos/estrutura académica cadastrados.'
      ));
    END IF;

    IF NOT v_curriculo_published_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_CURRICULUM_UNPUBLISHED',
        'area', 'academico',
        'severity', 'critical',
        'title', 'Currículo não publicado',
        'detail', 'O currículo precisa estar publicado para a operação académica.'
      ));
    END IF;

    IF NOT v_turmas_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'ACADEMIC_TURMAS_INVALID',
        'area', 'academico',
        'severity', 'critical',
        'title', 'Turmas não operacionais',
        'detail', 'Gere turmas válidas e garanta disciplinas vinculadas.'
      ));
    END IF;
  END IF;

  IF NOT v_financeiro_ok THEN
    IF NOT v_iban_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'FINANCE_IBAN_MISSING',
        'area', 'financeiro',
        'severity', 'high',
        'title', 'IBAN não configurado',
        'detail', 'A escola precisa de IBAN configurado para o setup financeiro.'
      ));
    END IF;

    IF NOT v_precos_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'FINANCE_PRICING_MISSING',
        'area', 'financeiro',
        'severity', 'critical',
        'title', 'Tabela de preços/mensalidades ausente',
        'detail', 'Cadastre preços e vencimento para o ano letivo ativo.'
      ));
    END IF;

    IF NOT v_financeiro_config_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'FINANCE_CONFIG_MISSING',
        'area', 'financeiro',
        'severity', 'high',
        'title', 'Configurações financeiras incompletas',
        'detail', 'Defina vencimento padrão e parâmetros financeiros globais.'
      ));
    END IF;
  END IF;

  IF NOT v_equipe_ok THEN
    IF NOT v_admin_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'TEAM_ADMIN_MISSING',
        'area', 'equipe',
        'severity', 'critical',
        'title', 'Nenhum admin escolar vinculado',
        'detail', 'É necessário pelo menos um utilizador administrativo vinculado à escola.'
      ));
    END IF;

    IF NOT v_professores_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'TEAM_TEACHERS_MISSING',
        'area', 'equipe',
        'severity', 'high',
        'title', 'Nenhum professor cadastrado',
        'detail', 'Cadastre pelo menos um professor para liberar a operação docente.'
      ));
    END IF;

    IF v_professor_consistency_high > 0 THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'TEAM_TEACHER_CONSISTENCY',
        'area', 'equipe',
        'severity', 'high',
        'title', 'Inconsistências operacionais de professores',
        'detail', 'Existem vínculos/alocações docentes inconsistentes que impedem a operação.'
      ));
    END IF;
  END IF;

  IF NOT v_horarios_ok THEN
    IF NOT v_slots_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'HORARIOS_SLOTS_MISSING',
        'area', 'horarios',
        'severity', 'high',
        'title', 'Slots de horário ausentes',
        'detail', 'Cadastre os slots necessários antes de publicar o quadro.'
      ));
    END IF;

    IF NOT v_horarios_publicados_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'HORARIOS_PUBLISH_MISSING',
        'area', 'horarios',
        'severity', 'high',
        'title', 'Quadro horário não publicado',
        'detail', 'As turmas que exigem horário ainda não têm uma versão publicada do quadro.'
      ));
    END IF;
  END IF;

  IF NOT v_portais_ok THEN
    IF NOT v_aluno_portal_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'PORTAL_ALUNO_DISABLED',
        'area', 'portais',
        'severity', 'medium',
        'title', 'Portal do aluno desativado',
        'detail', 'Ative o portal do aluno para concluir o readiness dos portais.'
      ));
    END IF;

    IF NOT v_professor_portal_ok THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'PORTAL_PROFESSOR_BLOCKED',
        'area', 'portais',
        'severity', 'high',
        'title', 'Portal do professor indisponível',
        'detail', 'O portal do professor depende de docentes válidos e consistentes.'
      ));
    END IF;
  END IF;

  IF v_matriculas_count = 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'STUDENTS_MISSING',
      'area', 'alunos',
      'severity', 'medium',
      'title', 'Nenhum aluno matriculado',
      'detail', 'A escola não possui alunos cadastrados ou matriculados. Importe os alunos para iniciar as operações.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'escola_id', p_escola_id,
    'ano_letivo', v_ano_letivo,
    'summary', jsonb_build_object(
      'school_status_ok', v_school_status_ok,
      'onboarding_setup_ok', v_onboarding_setup_ok,
      'academico_ok', v_academico_ok,
      'financeiro_ok', v_financeiro_ok,
      'equipe_ok', v_equipe_ok,
      'horarios_ok', v_horarios_ok,
      'portais_ok', v_portais_ok,
      'operational_ok', v_operational_ok
    ),
    'badges', jsonb_build_object(
      'ano_letivo_ok', v_ano_letivo_id IS NOT NULL AND v_ano_ativo,
      'periodos_ok', v_periodos_ok,
      'avaliacao_ok', v_avaliacao_ok,
      'cursos_ok', v_cursos_ok,
      'curriculo_published_ok', v_curriculo_published_ok,
      'turmas_ok', v_turmas_ok,
      'iban_ok', v_iban_ok,
      'precos_ok', v_precos_ok,
      'financeiro_config_ok', v_financeiro_config_ok,
      'admin_ok', v_admin_ok,
      'professores_ok', v_professores_ok,
      'professor_consistency_ok', v_professor_consistency_ok,
      'slots_ok', v_slots_ok,
      'horarios_publicados_ok', v_horarios_publicados_ok,
      'aluno_portal_ok', v_aluno_portal_ok,
      'admin_portal_ok', v_admin_portal_ok,
      'professor_portal_ok', v_professor_portal_ok
    ),
    'metrics', jsonb_build_object(
      'periodos_count', v_periodos_count,
      'cursos_count', v_cursos_count,
      'turmas_count', v_turmas_count,
      'turmas_sem_disciplinas', v_turmas_sem_disciplinas,
      'precos_count', v_precos_count,
      'admin_count', v_admin_count,
      'professores_count', v_professores_count,
      'professor_consistency_high', v_professor_consistency_high,
      'horario_required_disciplinas', v_horario_required_disciplinas,
      'horario_required_turmas', v_horario_required_turmas,
      'slots_count', v_slots_count,
      'turmas_publicadas', v_turmas_publicadas
    ),
    'blockers', v_blockers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_operational_readiness(uuid, integer) TO authenticated, service_role;

COMMIT;
