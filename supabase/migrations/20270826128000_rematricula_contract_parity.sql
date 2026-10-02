BEGIN;

-- REM-GR-001/002 — paridade do contrato de rematrícula.
-- 1) Somente dívida vencida bloqueia: data_vencimento < CURRENT_DATE.
-- 2) O lote usa o mesmo guard RAA do portal/balcão para inscrição condicional.
-- 3) Progressão anual preserva a origem como concluída/reprovada, nunca
--    "transferido" por uma transição normal.

CREATE OR REPLACE FUNCTION public.prevent_rematricula_grant_with_origin_debt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_overdue_count integer;
  v_matricula_origem_id uuid;
BEGIN
  IF NEW.servico_codigo = 'SERV_REMATRICULA'
     AND NEW.status = 'granted'
     AND OLD.status IS DISTINCT FROM 'granted' THEN
    v_matricula_origem_id := coalesce(
      nullif(NEW.contexto->>'origem_matricula_id', '')::uuid,
      OLD.matricula_id
    );

    SELECT count(*)
      INTO v_overdue_count
    FROM public.mensalidades m
    WHERE m.escola_id = NEW.escola_id
      AND m.aluno_id = NEW.aluno_id
      AND m.matricula_id = v_matricula_origem_id
      AND greatest(
        coalesce(m.valor_previsto, m.valor, 0) - coalesce(m.valor_pago_total, 0),
        0
      ) > 0
      AND lower(coalesce(m.status, '')) NOT IN ('pago', 'isento', 'cancelado')
      AND m.data_vencimento < CURRENT_DATE;

    IF v_overdue_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
        DETAIL = 'A matrícula de origem possui mensalidades vencidas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
      IF v_decision NOT IN (
           'transitou',
           'inscricao_condicional',
           'retido',
           'retido_por_faltas',
           'retido_por_indisciplina'
         )
         OR v_decision IS NULL
         OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
         OR (
           v_decision = 'inscricao_condicional'
           AND lower(coalesce(v_raa->>'destino', '')) <> 'proxima_etapa'
         ) THEN
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
        AND lower(coalesce(me.status, '')) NOT IN ('pago', 'isento', 'cancelado')
        AND me.data_vencimento < CURRENT_DATE;
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
      SET status = CASE WHEN v_retido THEN 'reprovado' ELSE 'concluido' END,
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

CREATE OR REPLACE FUNCTION public.aluno_iniciar_rematricula(
  p_matricula_id uuid,
  p_servicos_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_actor_email text;
  v_mat record;
  v_aluno record;
  v_raa jsonb;
  v_ano_destino integer;
  v_curso_destino_id uuid;
  v_classe_origem_id uuid;
  v_classe_destino_id uuid;
  v_classe_origem_numero integer;
  v_classe_destino_numero integer;
  v_servico_rematricula record;
  v_valor_confirmacao numeric(12,2);
  v_pricing_origin text := 'fallback';
  v_tabela_preco_id uuid;
  v_candidatura_id uuid;
  v_pedido_id uuid;
  v_intent_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(12,2) := 0;
  v_extra_count integer := 0;
  v_item record;
BEGIN
  IF v_uid IS NULL OR v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: não autenticado';
  END IF;

  SELECT m.id, m.escola_id, m.aluno_id, m.ano_letivo, m.turma_id, m.status
    INTO v_mat
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(m.status)
      IN ('ativo', 'concluido', 'reprovado', 'transferido')
  FOR UPDATE;

  IF v_mat.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula de origem não encontrada';
  END IF;

  SELECT u.email INTO v_actor_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT a.nome, a.bi_numero, a.telefone, a.responsavel_nome, a.responsavel_contato
    INTO v_aluno
  FROM public.alunos a
  WHERE a.id = v_mat.aluno_id
    AND a.escola_id = v_escola_id
    AND (
      a.profile_id = v_uid
      OR a.usuario_auth_id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.aluno_encarregados ae
        JOIN public.encarregados e
          ON e.id = ae.encarregado_id
         AND e.escola_id = ae.escola_id
        WHERE ae.escola_id = v_escola_id
          AND ae.aluno_id = v_mat.aluno_id
          AND lower(trim(e.email)) = lower(trim(COALESCE(v_actor_email, '')))
      )
    );

  IF v_aluno.nome IS NULL THEN
    RAISE EXCEPTION 'AUTH: aluno não autorizado';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(v_escola_id, v_mat.id);
  IF lower(coalesce(v_raa->>'decision', '')) NOT IN ('transitou', 'inscricao_condicional')
     OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
     OR (
       lower(coalesce(v_raa->>'decision', '')) = 'inscricao_condicional'
       AND lower(coalesce(v_raa->>'destino', '')) <> 'proxima_etapa'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_ACADEMIC_BLOCKED',
      DETAIL = format(
        'O RAA não autoriza a efetivação da rematrícula; decisão=%s destino=%s bloqueada=%s.',
        nullif(lower(coalesce(v_raa->>'decision', '')), ''),
        nullif(lower(coalesce(v_raa->>'destino', '')), ''),
        coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
      );
  END IF;

  SELECT r.ano_letivo INTO v_ano_destino
  FROM public.rematricula_janelas r
  WHERE r.escola_id = v_escola_id
    AND r.ativa = true
    AND r.ano_letivo > v_mat.ano_letivo
    AND r.data_inicio <= now()
    AND r.data_fim >= now()
  ORDER BY r.ano_letivo ASC, r.data_inicio DESC
  LIMIT 1;

  IF v_ano_destino IS NULL THEN
    RAISE EXCEPTION 'DATA: janela de rematrícula não está aberta';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mensalidades men
    WHERE men.escola_id = v_escola_id
      AND men.aluno_id = v_mat.aluno_id
      AND (men.matricula_id = v_mat.id OR men.ano_referencia = v_mat.ano_letivo)
      AND greatest(
        coalesce(men.valor_previsto, men.valor, 0) - coalesce(men.valor_pago_total, 0),
        0
      ) > 0
      AND lower(coalesce(men.status, '')) NOT IN ('pago', 'isento', 'cancelado')
      AND men.data_vencimento < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
      DETAIL = 'Existem saldos vencidos na matrícula de origem.';
  END IF;

  SELECT t.curso_id,
         t.classe_id,
         COALESCE(
           c.numero,
           NULLIF(substring(COALESCE(c.nome, '') FROM '([0-9]{1,2})'), '')::integer,
           (v_raa->'regime'->>'classe_num')::integer
         )
    INTO v_curso_destino_id, v_classe_origem_id, v_classe_origem_numero
  FROM public.turmas t
  LEFT JOIN public.classes c
    ON c.id = t.classe_id
   AND c.escola_id = v_escola_id
  WHERE t.id = v_mat.turma_id
    AND t.escola_id = v_escola_id;

  IF v_curso_destino_id IS NULL OR v_classe_origem_numero IS NULL THEN
    RAISE EXCEPTION 'ACADEMICO: curso ou classe de origem não configurado';
  END IF;

  v_classe_destino_numero := v_classe_origem_numero + 1;

  SELECT c.id INTO v_classe_destino_id
  FROM public.classes c
  WHERE c.escola_id = v_escola_id
    AND c.curso_id = v_curso_destino_id
    AND COALESCE(
      c.numero,
      NULLIF(substring(COALESCE(c.nome, '') FROM '([0-9]{1,2})'), '')::integer
    ) = v_classe_destino_numero
  ORDER BY c.created_at DESC, c.id
  LIMIT 1;

  IF v_classe_destino_id IS NULL THEN
    RAISE EXCEPTION 'ACADEMICO: classe destino % não configurada para o curso', v_classe_destino_numero;
  END IF;

  SELECT * INTO v_servico_rematricula
  FROM public.servicos_escola
  WHERE escola_id = v_escola_id
    AND codigo = 'SERV_REMATRICULA'
    AND ativo = true;

  IF v_servico_rematricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: serviço de rematrícula não configurado';
  END IF;

  SELECT ft.id,
         ft.valor_confirmacao,
         CASE
           WHEN ft.curso_id = v_curso_destino_id AND ft.classe_id = v_classe_destino_id THEN 'classe_curso'
           WHEN ft.classe_id = v_classe_destino_id THEN 'classe'
           WHEN ft.curso_id = v_curso_destino_id THEN 'curso'
           ELSE 'geral'
         END
    INTO v_tabela_preco_id, v_valor_confirmacao, v_pricing_origin
  FROM public.financeiro_tabelas ft
  WHERE ft.escola_id = v_escola_id
    AND ft.valor_confirmacao IS NOT NULL
    AND (
      (ft.curso_id = v_curso_destino_id AND ft.classe_id = v_classe_destino_id)
      OR (ft.curso_id IS NULL AND ft.classe_id = v_classe_destino_id)
      OR (ft.curso_id = v_curso_destino_id AND ft.classe_id IS NULL)
      OR (ft.curso_id IS NULL AND ft.classe_id IS NULL)
    )
  ORDER BY
    CASE
      WHEN ft.curso_id = v_curso_destino_id AND ft.classe_id = v_classe_destino_id THEN 1
      WHEN ft.curso_id IS NULL AND ft.classe_id = v_classe_destino_id THEN 2
      WHEN ft.curso_id = v_curso_destino_id AND ft.classe_id IS NULL THEN 3
      ELSE 4
    END,
    CASE WHEN ft.ano_letivo = v_ano_destino THEN 0 ELSE 1 END,
    ft.ano_letivo DESC,
    ft.updated_at DESC NULLS LAST,
    ft.created_at DESC
  LIMIT 1;

  IF v_valor_confirmacao IS NULL THEN
    v_valor_confirmacao := COALESCE(v_servico_rematricula.valor_base, 0);
    v_pricing_origin := 'servico_global';
  END IF;

  IF v_valor_confirmacao <= 0 THEN
    RAISE EXCEPTION 'DATA: taxa de rematrícula não configurada para a classe destino';
  END IF;

  v_items := jsonb_build_array(jsonb_build_object(
    'id', v_servico_rematricula.id,
    'codigo', v_servico_rematricula.codigo,
    'nome', v_servico_rematricula.nome,
    'descricao', v_servico_rematricula.descricao,
    'valor', v_valor_confirmacao,
    'quantidade', 1,
    'tipo', 'rematricula',
    'pricing_origin', v_pricing_origin,
    'tabela_preco_id', v_tabela_preco_id,
    'curso_destino_id', v_curso_destino_id,
    'classe_destino_id', v_classe_destino_id,
    'classe_destino_numero', v_classe_destino_numero
  ));
  v_total := v_valor_confirmacao;

  IF COALESCE(array_length(p_servicos_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_extra_count
    FROM public.servicos_escola s
    WHERE s.escola_id = v_escola_id
      AND s.id = ANY(p_servicos_ids)
      AND s.codigo <> 'SERV_REMATRICULA'
      AND s.ativo = true
      AND s.valor_base > 0;

    IF v_extra_count <> (SELECT count(*) FROM unnest(p_servicos_ids)) THEN
      RAISE EXCEPTION 'DATA: um dos serviços selecionados não está disponível';
    END IF;

    FOR v_item IN
      SELECT s.id, s.codigo, s.nome, s.descricao, s.valor_base
      FROM public.servicos_escola s
      WHERE s.escola_id = v_escola_id
        AND s.id = ANY(p_servicos_ids)
      ORDER BY s.nome ASC, s.id ASC
    LOOP
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'id', v_item.id,
        'codigo', v_item.codigo,
        'nome', v_item.nome,
        'descricao', v_item.descricao,
        'valor', v_item.valor_base,
        'quantidade', 1,
        'tipo', 'servico'
      ));
      v_total := v_total + v_item.valor_base;
    END LOOP;
  END IF;

  SELECT c.id INTO v_candidatura_id
  FROM public.candidaturas c
  WHERE c.escola_id = v_escola_id
    AND c.aluno_id = v_mat.aluno_id
    AND c.ano_letivo = v_ano_destino
    AND c.source = 'PORTAL_ALUNO_REMATRICULA'
    AND c.status <> 'rejeitada'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_candidatura_id IS NULL THEN
    INSERT INTO public.candidaturas (
      escola_id, aluno_id, curso_id, ano_letivo, status, nome_candidato, source, dados_candidato
    ) VALUES (
      v_escola_id, v_mat.aluno_id, v_curso_destino_id, v_ano_destino, 'submetida', v_aluno.nome,
      'PORTAL_ALUNO_REMATRICULA',
      jsonb_build_object(
        'nome_completo', v_aluno.nome,
        'bi_numero', v_aluno.bi_numero,
        'telefone', v_aluno.telefone,
        'responsavel_nome', v_aluno.responsavel_nome,
        'responsavel_contato', v_aluno.responsavel_contato,
        'tipo', 'rematricula',
        'matricula_origem_id', v_mat.id,
        'curso_destino_id', v_curso_destino_id,
        'classe_destino_id', v_classe_destino_id,
        'classe_destino_numero', v_classe_destino_numero,
        'raa_decision', v_raa->>'decision',
        'raa_destino', v_raa->>'destino',
        'raa_disciplina_ids_pendentes', coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb),
        'pricing_origin', v_pricing_origin,
        'tabela_preco_id', v_tabela_preco_id,
        'itens_pagamento', v_items,
        'valor_total', v_total
      )
    ) RETURNING id INTO v_candidatura_id;
  END IF;

  SELECT sp.id INTO v_pedido_id
  FROM public.servico_pedidos sp
  WHERE sp.escola_id = v_escola_id
    AND sp.aluno_id = v_mat.aluno_id
    AND sp.servico_codigo = 'SERV_REMATRICULA'
    AND sp.contexto->>'candidatura_id' = v_candidatura_id::text
    AND sp.status IN ('pending_payment', 'granted')
  ORDER BY sp.created_at DESC
  LIMIT 1;

  IF v_pedido_id IS NOT NULL THEN
    SELECT pi.id INTO v_intent_id
    FROM public.pagamento_intents pi
    WHERE pi.servico_pedido_id = v_pedido_id
      AND pi.status NOT IN ('failed', 'rejected', 'cancelled', 'canceled')
    ORDER BY pi.created_at DESC
    LIMIT 1;
  END IF;

  IF v_pedido_id IS NULL THEN
    INSERT INTO public.servico_pedidos (
      escola_id, aluno_id, matricula_id, servico_escola_id, status,
      servico_codigo, servico_nome, valor_cobrado, contexto, created_by
    ) VALUES (
      v_escola_id, v_mat.aluno_id, v_mat.id, v_servico_rematricula.id, 'pending_payment',
      v_servico_rematricula.codigo, v_servico_rematricula.nome, v_total,
      jsonb_build_object(
        'origem', 'portal_rematricula',
        'candidatura_id', v_candidatura_id,
        'ano_letivo', v_ano_destino,
        'matricula_origem_id', v_mat.id,
        'curso_destino_id', v_curso_destino_id,
        'classe_destino_id', v_classe_destino_id,
        'classe_destino_numero', v_classe_destino_numero,
        'raa_decision', v_raa->>'decision',
        'raa_destino', v_raa->>'destino',
        'raa_disciplina_ids_pendentes', coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb),
        'pricing_origin', v_pricing_origin,
        'tabela_preco_id', v_tabela_preco_id,
        'valor_confirmacao', v_valor_confirmacao,
        'itens_pagamento', v_items,
        'valor_total', v_total
      ), v_uid
    ) RETURNING id INTO v_pedido_id;
  END IF;

  IF v_intent_id IS NULL THEN
    INSERT INTO public.pagamento_intents (
      escola_id, aluno_id, servico_pedido_id, amount, status, method, reference, meta, created_by
    ) VALUES (
      v_escola_id, v_mat.aluno_id, v_pedido_id, v_total, 'draft', 'transfer',
      'REMAT-' || v_ano_destino || '-' || upper(substr(v_pedido_id::text, 1, 8)),
      jsonb_build_object(
        'origem', 'portal_rematricula',
        'candidatura_id', v_candidatura_id,
        'matricula_id', v_mat.id,
        'ano_letivo', v_ano_destino,
        'curso_destino_id', v_curso_destino_id,
        'classe_destino_id', v_classe_destino_id,
        'classe_destino_numero', v_classe_destino_numero,
        'raa_decision', v_raa->>'decision',
        'raa_destino', v_raa->>'destino',
        'raa_disciplina_ids_pendentes', coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb),
        'pricing_origin', v_pricing_origin,
        'tabela_preco_id', v_tabela_preco_id,
        'valor_confirmacao', v_valor_confirmacao,
        'itens_pagamento', v_items,
        'valor_total', v_total
      ), v_uid
    ) RETURNING id INTO v_intent_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'candidatura_id', v_candidatura_id,
    'pedido_id', v_pedido_id,
    'pagamento_intent_id', v_intent_id,
    'next_ano', v_ano_destino,
    'status', CASE
      WHEN EXISTS (
        SELECT 1 FROM public.pagamento_intents
        WHERE id = v_intent_id AND status = 'settled'
      ) THEN 'settled'
      ELSE 'pending_payment'
    END,
    'curso_destino_id', v_curso_destino_id,
    'classe_destino_id', v_classe_destino_id,
    'classe_destino_numero', v_classe_destino_numero,
    'raa_decision', v_raa->>'decision',
    'raa_destino', v_raa->>'destino',
    'raa_disciplina_ids_pendentes', coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb),
    'pricing_origin', v_pricing_origin,
    'tabela_preco_id', v_tabela_preco_id,
    'valor_confirmacao', v_valor_confirmacao,
    'itens_pagamento', v_items,
    'valor_total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) TO authenticated;

COMMIT;
