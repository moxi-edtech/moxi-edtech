BEGIN;

-- Reserva académica: define o destino sem ativar a matrícula e sem misturar
-- dívida com resultado. A dívida continua obrigatória na confirmação final.
CREATE OR REPLACE FUNCTION public.preparar_aluno_para_rematricula(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid,
  p_turma_destino_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_source public.matriculas%ROWTYPE;
  v_source_turma public.turmas%ROWTYPE;
  v_target_turma public.turmas%ROWTYPE;
  v_target public.matriculas%ROWTYPE;
  v_to_year integer;
  v_source_number integer;
  v_target_number integer;
  v_expected_number integer;
  v_occupancy integer;
  v_new_id uuid;
  v_raa jsonb;
  v_decision text;
  v_retido boolean;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT * INTO v_source
  FROM public.matriculas
  WHERE escola_id = p_escola_id
    AND aluno_id = p_aluno_id
    AND session_id = p_from_session_id
    AND public.canonicalize_matricula_status_text(status) IN ('ativo', 'concluido', 'reprovado', 'transferido')
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1
  FOR UPDATE;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula de origem fechada não encontrada';
  END IF;

  SELECT ano INTO v_to_year
  FROM public.anos_letivos
  WHERE id = p_to_session_id
    AND escola_id = p_escola_id
    AND ativo = true;
  IF v_to_year IS NULL OR coalesce(v_source.ano_letivo, 0) >= v_to_year THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino inválido';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_source.id);
  v_decision := v_raa->>'decision';
  IF v_decision IN ('pendente', 'recurso', 'concluiu')
     OR v_decision IS NULL
     OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false) THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_BLOCKED: decisão % não autoriza reserva de rematrícula', v_decision;
  END IF;
  v_retido := v_decision IN ('retido', 'retido_por_faltas', 'retido_por_indisciplina');

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = v_source.turma_id
    AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem não encontrada';
  END IF;
  v_source_number := public.turma_classe_numero(v_source_turma.id);
  v_expected_number := CASE WHEN v_retido THEN v_source_number ELSE v_source_number + 1 END;
  IF v_source_number IS NULL THEN
    RAISE EXCEPTION 'DATA: classe da turma de origem não pôde ser determinada';
  END IF;

  IF p_turma_destino_id IS NULL THEN
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year
      AND t.curso_id IS NOT DISTINCT FROM v_source_turma.curso_id
      AND public.turma_classe_numero(t.id) = v_expected_number
      AND t.turno IS NOT DISTINCT FROM v_source_turma.turno
      AND t.letra IS NOT DISTINCT FROM v_source_turma.letra
    ORDER BY t.id
    LIMIT 1;
  ELSE
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.id = p_turma_destino_id
      AND t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year;
  END IF;
  IF v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino não encontrada no ano letivo';
  END IF;
  IF v_target_turma.curso_id IS DISTINCT FROM v_source_turma.curso_id THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro curso';
  END IF;
  v_target_number := public.turma_classe_numero(v_target_turma.id);
  IF v_target_number IS NULL OR v_target_number IS DISTINCT FROM v_expected_number THEN
    RAISE EXCEPTION 'DATA: turma destino incompatível com a decisão RAA %', v_decision;
  END IF;

  SELECT m.* INTO v_target
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_to_session_id
    AND m.ano_letivo = v_to_year
  ORDER BY CASE WHEN public.canonicalize_matricula_status_text(m.status) = 'ativo' THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST,
           m.id DESC
  LIMIT 1
  FOR UPDATE;
  IF public.canonicalize_matricula_status_text(v_source.status) = 'transferido'
     AND v_target.id IS NULL THEN
    RAISE EXCEPTION 'CONFLICT: origem transferida sem matrícula destino existente';
  END IF;
  IF v_target.id IS NOT NULL THEN
    IF public.canonicalize_matricula_status_text(v_target.status) = 'ativo' THEN
      IF v_target.turma_id IS DISTINCT FROM v_target_turma.id THEN
        RAISE EXCEPTION 'CONFLICT: matrícula ativa já existe noutra turma do ano destino';
      END IF;
    ELSIF v_target.turma_id IS DISTINCT FROM v_target_turma.id THEN
      SELECT count(*)::integer INTO v_occupancy
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = v_target_turma.id
        AND m.session_id = p_to_session_id
        AND m.id <> v_target.id
        AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
      IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
        RAISE EXCEPTION 'DATA: turma de destino sem vagas';
      END IF;
      UPDATE public.matriculas
      SET turma_id = v_target_turma.id,
          origem_transicao_matricula_id = v_source.id,
          updated_at = now()
      WHERE id = v_target.id;
      v_target.turma_id := v_target_turma.id;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'reused', true,
      'matricula_id', v_target.id,
      'turma_id', v_target.turma_id,
      'status', v_target.status,
      'reservada', public.canonicalize_matricula_status_text(v_target.status) <> 'ativo',
      'raa', v_raa
    );
  END IF;

  SELECT count(*)::integer INTO v_occupancy
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = v_target_turma.id
    AND m.session_id = p_to_session_id
    AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
  IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: turma de destino sem vagas';
  END IF;

  INSERT INTO public.matriculas (
    escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
    ativo, numero_matricula, data_matricula, data_inicio_financeiro,
    created_at, updated_at, origem_transicao_matricula_id
  ) VALUES (
    p_escola_id, p_aluno_id, v_target_turma.id, p_to_session_id, v_to_year, 'pendente',
    false, NULL, CURRENT_DATE, NULL, now(), now(), v_source.id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ALUNO_PROMOCAO_RESERVA_REMATRICULA', 'matriculas', v_new_id::text,
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'matricula_origem_id', v_source.id,
      'ano_letivo_destino_id', p_to_session_id,
      'turma_destino_id', v_target_turma.id,
      'raa_decision', v_decision,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'reservada', true,
    'status', 'pendente',
    'matricula_id', v_new_id,
    'turma_id', v_target_turma.id,
    'raa', v_raa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_aluno_para_rematricula(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparar_aluno_para_rematricula(uuid, uuid, uuid, uuid, uuid) TO authenticated;

-- Rematrícula em massa é uma confirmação administrativa: valida RAA, turma,
-- dívida da origem e capacidade antes de ativar/reutilizar o destino.
CREATE OR REPLACE FUNCTION public.rematricula_em_massa(
  p_escola_id uuid,
  p_origem_turma_id uuid,
  p_destino_turma_id uuid
)
RETURNS TABLE(inserted jsonb, skipped jsonb, errors jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := public.safe_auth_uid();
  v_source record;
  v_source_turma public.turmas%ROWTYPE;
  v_target_turma public.turmas%ROWTYPE;
  v_target public.matriculas%ROWTYPE;
  v_dest_session uuid;
  v_dest_ano integer;
  v_source_ano integer;
  v_exame_fim date;
  v_source_number integer;
  v_target_number integer;
  v_expected_number integer;
  v_occupancy integer;
  v_balance numeric;
  v_raa jsonb;
  v_decision text;
  v_retido boolean;
  v_target_id uuid;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = p_origem_turma_id
    AND escola_id = p_escola_id;
  SELECT * INTO v_target_turma
  FROM public.turmas
  WHERE id = p_destino_turma_id
    AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL OR v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem ou destino inválida';
  END IF;
  IF v_target_turma.session_id IS NULL OR v_target_turma.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino sem ano letivo válido';
  END IF;
  IF v_target_turma.curso_id IS DISTINCT FROM v_source_turma.curso_id THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro curso';
  END IF;

  v_dest_session := v_target_turma.session_id;
  v_dest_ano := v_target_turma.ano_letivo;
  v_source_ano := v_source_turma.ano_letivo;
  IF v_source_ano IS NULL OR v_source_ano >= v_dest_ano THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino deve ser posterior ao de origem';
  END IF;
  v_source_number := public.turma_classe_numero(v_source_turma.id);
  v_target_number := public.turma_classe_numero(v_target_turma.id);
  IF v_source_number IS NULL OR v_target_number IS NULL THEN
    RAISE EXCEPTION 'DATA: classe da turma de origem ou destino não pôde ser determinada';
  END IF;

  SELECT max(ce.data_fim) INTO v_exame_fim
  FROM public.calendario_eventos ce
  JOIN public.anos_letivos al ON al.id = ce.ano_letivo_id AND al.escola_id = ce.escola_id
  WHERE ce.escola_id = p_escola_id
    AND ce.tipo = 'EXAME_NACIONAL'
    AND al.ano = v_source_ano;
  IF v_exame_fim IS NOT NULL AND CURRENT_DATE <= v_exame_fim THEN
    RAISE EXCEPTION 'BLOQUEIO: a transição não é permitida antes do término dos Exames Nacionais (%)',
      to_char(v_exame_fim, 'DD/MM/YYYY');
  END IF;

  FOR v_source IN
    SELECT m.*
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_origem_turma_id
      AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'concluido', 'reprovado', 'transferido')
    ORDER BY m.id
    FOR UPDATE
  LOOP
    BEGIN
      SELECT m.* INTO v_target
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.aluno_id = v_source.aluno_id
        AND m.session_id = v_dest_session
        AND m.ano_letivo = v_dest_ano
      ORDER BY CASE WHEN public.canonicalize_matricula_status_text(m.status) = 'ativo' THEN 0 ELSE 1 END,
               m.created_at DESC NULLS LAST,
               m.id DESC
      LIMIT 1
      FOR UPDATE;

      IF v_target.id IS NOT NULL
         AND public.canonicalize_matricula_status_text(v_target.status) = 'ativo' THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('ja_ativo')
        ));
        CONTINUE;
      END IF;
      IF public.canonicalize_matricula_status_text(v_source.status) = 'transferido'
         AND v_target.id IS NULL THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('origem_transferida_sem_reserva')
        ));
        CONTINUE;
      END IF;

      v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_source.id);
      v_decision := v_raa->>'decision';
      IF v_decision IN ('pendente', 'recurso', 'concluiu')
         OR v_decision IS NULL
         OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('raa_' || coalesce(v_decision, 'invalida')),
          'raa', v_raa
        ));
        CONTINUE;
      END IF;

      v_retido := v_decision IN ('retido', 'retido_por_faltas', 'retido_por_indisciplina');
      v_expected_number := CASE WHEN v_retido THEN v_source_number ELSE v_source_number + 1 END;
      IF v_target_number IS DISTINCT FROM v_expected_number THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('turma_destino_incompativel'),
          'raa', v_raa
        ));
        CONTINUE;
      END IF;

      SELECT coalesce(sum(
        greatest(coalesce(me.valor_previsto, me.valor, 0) - coalesce(me.valor_pago_total, 0), 0)
      ), 0)
      INTO v_balance
      FROM public.mensalidades me
      WHERE me.escola_id = p_escola_id
        AND me.aluno_id = v_source.aluno_id
        AND (me.matricula_id = v_source.id OR me.ano_referencia = v_source.ano_letivo)
        AND lower(coalesce(me.status, '')) NOT IN ('pago', 'isento', 'cancelado');
      IF v_balance > 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('saldo_devedor'),
          'divida_total', v_balance
        ));
        CONTINUE;
      END IF;

      SELECT count(*)::integer INTO v_occupancy
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = p_destino_turma_id
        AND m.session_id = v_dest_session
        AND m.id IS DISTINCT FROM v_target.id
        AND public.canonicalize_matricula_status_text(m.status) IN ('ativo', 'pendente');
      IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_source.id,
          'aluno_id', v_source.aluno_id,
          'motivos', jsonb_build_array('turma_sem_vagas')
        ));
        CONTINUE;
      END IF;

      IF v_target.id IS NULL THEN
        INSERT INTO public.matriculas (
          id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
          status, ativo, created_at, updated_at, data_matricula,
          origem_transicao_matricula_id
        ) VALUES (
          gen_random_uuid(), p_escola_id, v_source.aluno_id, p_destino_turma_id,
          v_dest_session, v_dest_ano, 'pendente', false, now(), now(), CURRENT_DATE,
          v_source.id
        ) RETURNING id INTO v_target_id;
      ELSE
        v_target_id := v_target.id;
        UPDATE public.matriculas
        SET turma_id = p_destino_turma_id,
            session_id = v_dest_session,
            ano_letivo = v_dest_ano,
            origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, v_source.id),
            updated_at = now()
        WHERE id = v_target_id;
      END IF;

      PERFORM public.confirmar_matricula_core(v_source.aluno_id, v_dest_ano, p_destino_turma_id, v_target_id);
      UPDATE public.matriculas
      SET status = 'ativo',
          ativo = true,
          turma_id = p_destino_turma_id,
          session_id = v_dest_session,
          ano_letivo = v_dest_ano,
          data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
          updated_at = now()
      WHERE id = v_target_id;

      UPDATE public.matriculas
      SET status = 'transferido',
          ativo = false,
          motivo_fecho = 'Rematrícula em massa confirmada no ano letivo destino',
          data_fecho = coalesce(data_fecho, now()),
          updated_at = now()
      WHERE id = v_source.id
        AND id <> v_target_id;

      INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
      VALUES (
        p_escola_id,
        v_actor_id,
        'REMATRICULA_EM_MASSA_CONFIRMADA',
        'matriculas',
        v_target_id::text,
        jsonb_build_object(
          'aluno_id', v_source.aluno_id,
          'matricula_origem_id', v_source.id,
          'turma_destino_id', p_destino_turma_id,
          'raa_decision', v_decision,
          'at', now()
        ),
        'secretaria'
      );

      v_inserted := v_inserted || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_target_id,
        'aluno_id', v_source.aluno_id,
        'raa_decision', v_decision
      ));
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_source.id,
        'aluno_id', v_source.aluno_id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_skipped, v_errors;
END;
$$;

REVOKE ALL ON FUNCTION public.rematricula_em_massa(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rematricula_em_massa(uuid, uuid, uuid) TO authenticated;

-- A função de balcão já trata a ativação; endurecemos os três guards que não
-- podem ficar apenas na API: origem encerrada, RAA condicional e dívida antiga.
DO $$
DECLARE
  v_definition text;
  v_after_source text;
  v_after_raa text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'finalizar_rematricula_balcao'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_escola_id uuid, p_aluno_id uuid, p_matricula_origem_id uuid, p_ano_letivo_id uuid, p_destino_turma_id uuid, p_pedido_id uuid';
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'DATA: finalizar_rematricula_balcao não encontrada';
  END IF;

  v_after_source := regexp_replace(
    v_definition,
    $pattern$IF lower\(coalesce\(v_origem\.status, ''\)\) NOT IN \('ativo', 'ativa', 'active', 'pendente', 'aprovado', 'aprovada'\) THEN$pattern$,
    $replacement$IF public.canonicalize_matricula_status_text(v_origem.status) NOT IN ('ativo', 'concluido', 'reprovado') THEN$replacement$,
    1,
    1
  );
  IF v_after_source = v_definition THEN
    RAISE EXCEPTION 'DATA: guard de origem do balcão não encontrado';
  END IF;

  v_after_raa := regexp_replace(
    v_after_source,
    $pattern$IF v_decision IN \('pendente', 'recurso', 'concluiu'\) OR v_decision IS NULL THEN$pattern$,
    $replacement$IF v_decision IN ('pendente', 'recurso', 'concluiu')
     OR v_decision IS NULL
     OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false) THEN$replacement$,
    1,
    1
  );
  IF v_after_raa = v_after_source THEN
    RAISE EXCEPTION 'DATA: guard RAA do balcão não encontrado';
  END IF;

  v_updated := regexp_replace(
    v_after_raa,
    $pattern$IF lower\(coalesce\(v_destino\.status, ''\)\) NOT IN \('ativo', 'ativa', 'active'\)$pattern$,
    $replacement$IF EXISTS (
    SELECT 1
    FROM public.mensalidades me
    WHERE me.escola_id = p_escola_id
      AND me.aluno_id = p_aluno_id
      AND (me.matricula_id = v_origem.id OR me.ano_referencia = v_origem.ano_letivo)
      AND lower(coalesce(me.status, '')) NOT IN ('pago', 'isento', 'cancelado')
      AND greatest(coalesce(me.valor_previsto, me.valor, 0) - coalesce(me.valor_pago_total, 0), 0) > 0
  ) THEN
    RAISE EXCEPTION 'FINANCEIRO: possui pendências financeiras da matrícula de origem';
  END IF;

  IF lower(coalesce(v_destino.status, '')) NOT IN ('ativo', 'ativa', 'active')$replacement$,
    1,
    1
  );
  IF v_updated = v_after_raa THEN
    RAISE EXCEPTION 'DATA: ponto de inserção do guard financeiro do balcão não encontrado';
  END IF;

  EXECUTE v_updated;
END;
$$;

COMMIT;
