BEGIN;

-- Gracefulness / rematrícula estrita.
-- Regra canónica: uma nova rematrícula só pode concluir quando o RAA autoriza
-- a etapa seguinte. Isso inclui progressão regular (transitou) e inscrição
-- condicional efetivável (inscricao_condicional + destino=proxima_etapa +
-- efetivacao_matricula_bloqueada=false). Notas/dados pendentes, recurso,
-- retenção, conclusão de ciclo e inscrição condicional bloqueada não podem ser
-- convertidos em rematrícula por fallback administrativo.
--
-- A dívida continua protegida em profundidade por
-- trg_prevent_rematricula_grant_with_origin_debt: ao conceder o pedido,
-- qualquer saldo aberto da matrícula de origem aborta toda a transação.
--
-- Mantemos os guards de autorização e search_path introduzidos em BAL-GR-001.
CREATE OR REPLACE FUNCTION public.finalizar_rematricula_balcao(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_matricula_origem_id uuid,
  p_ano_letivo_id uuid,
  p_destino_turma_id uuid,
  p_pedido_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_ano_destino int;
  v_turma record;
  v_origem record;
  v_destino record;
  v_ocupacao int;
  v_criada boolean := false;
  v_classe_origem record;
  v_classe_destino record;
  v_numero_origem int;
  v_numero_destino int;
  v_numero_matricula bigint;
  v_raa jsonb;
  v_decision text;
  v_decisao_origem text;
  v_actor_id uuid := public.safe_auth_uid();
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  -- service_role continua autorizado para operações internas confiáveis. Para
  -- qualquer sessão humana, a identidade e o vínculo/papel na escola são
  -- obrigatórios. user_has_role_in_school() é auth.uid()-scoped e trata os
  -- papéis compostos (secretaria_financeiro/admin_financeiro) canonicamente.
  IF v_jwt_role IS DISTINCT FROM 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: utilizador autenticado é obrigatório'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY[
        'secretaria',
        'secretaria_financeiro',
        'admin_financeiro',
        'admin',
        'admin_escola',
        'staff_admin'
      ]::text[]
    ) THEN
      RAISE EXCEPTION 'AUTH_FORBIDDEN: sem permissão para concluir rematrícula nesta escola'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT al.ano INTO v_ano_destino
  FROM public.anos_letivos al
  WHERE al.id = p_ano_letivo_id
    AND al.escola_id = p_escola_id
    AND al.ativo = true;
  IF v_ano_destino IS NULL THEN RAISE EXCEPTION 'Ano letivo destino inválido'; END IF;

  SELECT t.id, t.session_id, t.ano_letivo, t.capacidade_maxima, t.status_fecho
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id
    AND t.escola_id = p_escola_id
    AND t.session_id = p_ano_letivo_id
    AND t.ano_letivo = v_ano_destino;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'Turma destino não pertence ao ano letivo seleccionado'; END IF;
  IF lower(coalesce(v_turma.status_fecho, 'aberto')) NOT IN ('aberto', 'open', '') THEN RAISE EXCEPTION 'Turma destino está fechada'; END IF;

  SELECT m.* INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
  FOR UPDATE;
  IF v_origem.id IS NULL THEN RAISE EXCEPTION 'Matrícula de origem não encontrada'; END IF;
  IF v_origem.ano_letivo IS NULL OR v_origem.ano_letivo >= v_ano_destino THEN RAISE EXCEPTION 'Matrícula de origem não é de um ano anterior'; END IF;

  SELECT m.* INTO v_destino
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_ano_letivo_id
    AND m.ano_letivo = v_ano_destino
  ORDER BY CASE WHEN lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active') THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF lower(coalesce(v_origem.status, '')) NOT IN (
    'ativo', 'ativa', 'active', 'pendente', 'aprovado', 'aprovada',
    'transferido', 'concluido', 'concluida'
  ) THEN
    RAISE EXCEPTION 'Matrícula de origem não está elegível para rematrícula';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_origem.id);
  v_decision := lower(coalesce(v_raa->>'decision', ''));

  IF v_decision NOT IN ('transitou', 'inscricao_condicional')
     OR coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
     OR (
       v_decision = 'inscricao_condicional'
       AND lower(coalesce(v_raa->>'destino', '')) <> 'proxima_etapa'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_ACADEMIC_BLOCKED',
      DETAIL = format(
        'O RAA não autoriza a efetivação da rematrícula; decisão=%s destino=%s bloqueada=%s.',
        nullif(v_decision, ''),
        nullif(lower(coalesce(v_raa->>'destino', '')), ''),
        coalesce((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false)
      );
  END IF;

  v_decisao_origem := v_decision;

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_origem
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = v_origem.turma_id AND t.escola_id = p_escola_id;
  v_numero_origem := COALESCE(v_classe_origem.numero,
    NULLIF((regexp_match(COALESCE(v_classe_origem.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_destino.id IS NULL THEN
    SELECT count(*)::int INTO v_ocupacao
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_destino_turma_id
      AND m.session_id = p_ano_letivo_id
      AND lower(coalesce(m.status, '')) IN ('ativo', 'ativa', 'active');
    IF v_turma.capacidade_maxima IS NOT NULL AND v_ocupacao >= v_turma.capacidade_maxima THEN RAISE EXCEPTION 'Turma destino sem vagas'; END IF;

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, session_id, ano_letivo,
      status, ativo, created_at, data_matricula, data_inicio_financeiro,
      origem_transicao_matricula_id
    ) VALUES (
      gen_random_uuid(), p_escola_id, p_aluno_id, p_destino_turma_id,
      p_ano_letivo_id, v_ano_destino, 'pendente', false, now(), CURRENT_DATE,
      CURRENT_DATE, p_matricula_origem_id
    ) RETURNING * INTO v_destino;
    v_criada := true;
  ELSE
    UPDATE public.matriculas
       SET turma_id = p_destino_turma_id,
           session_id = p_ano_letivo_id,
           ano_letivo = v_ano_destino,
           data_inicio_financeiro = coalesce(data_inicio_financeiro, CURRENT_DATE),
           origem_transicao_matricula_id = coalesce(origem_transicao_matricula_id, p_matricula_origem_id)
     WHERE id = v_destino.id;
    SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;
  END IF;

  SELECT c.id, c.numero, c.nome, t.curso_id
    INTO v_classe_destino
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id;
  v_numero_destino := COALESCE(v_classe_destino.numero,
    NULLIF((regexp_match(COALESCE(v_classe_destino.nome, ''), '(\d{1,2})'))[1], '')::int);

  IF v_numero_origem IS NOT NULL AND v_numero_destino IS NOT NULL THEN
    IF v_numero_origem = 12 THEN RAISE EXCEPTION 'Aluno da 12ª classe não tem classe seguinte para rematrícula'; END IF;
    IF v_numero_destino <> v_numero_origem + 1 THEN
      RAISE EXCEPTION 'Turma destino inválida: aluno aprovado deve seguir para a classe imediatamente seguinte';
    END IF;
  END IF;
  IF v_classe_origem.curso_id IS NOT NULL AND v_classe_destino.curso_id IS NOT NULL AND v_classe_origem.curso_id <> v_classe_destino.curso_id THEN
    RAISE EXCEPTION 'Turma destino pertence a outro curso';
  END IF;

  IF lower(coalesce(v_destino.status, '')) NOT IN ('ativo', 'ativa', 'active')
     OR v_destino.numero_matricula IS NULL OR btrim(v_destino.numero_matricula::text) = '' THEN
    v_numero_matricula := public.confirmar_matricula_core(p_aluno_id, v_ano_destino, p_destino_turma_id, v_destino.id);
  END IF;

  UPDATE public.matriculas
     SET status = 'ativo', ativo = true, turma_id = p_destino_turma_id,
         session_id = p_ano_letivo_id, ano_letivo = v_ano_destino, updated_at = now()
   WHERE id = v_destino.id;
  SELECT * INTO v_destino FROM public.matriculas WHERE id = v_destino.id;

  UPDATE public.matriculas
     SET status = 'concluido', ativo = false,
         motivo_fecho = coalesce(motivo_fecho, 'Resultado académico concluído; rematrícula confirmada no ano letivo destino'),
         data_fecho = coalesce(data_fecho, now()), updated_at = now()
   WHERE id = p_matricula_origem_id AND id <> v_destino.id;

  UPDATE public.servico_pedidos
     SET status = 'granted', matricula_id = v_destino.id,
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'matricula_destino_id', v_destino.id,
           'ano_letivo_id', p_ano_letivo_id,
           'destino_turma_id', p_destino_turma_id,
           'matricula_criada', v_criada,
           'decisao_academica', v_decisao_origem
         )
   WHERE id = p_pedido_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de rematrícula não encontrado'; END IF;

  RETURN jsonb_build_object(
    'ok', true, 'matricula_id', v_destino.id,
    'numero_matricula', v_destino.numero_matricula,
    'turma_id', p_destino_turma_id, 'ano_letivo_id', p_ano_letivo_id,
    'matricula_criada', v_criada, 'raa', v_raa,
    'decisao_academica', v_decisao_origem
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_rematricula_balcao(uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizar_rematricula_balcao(uuid, uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;


-- Portal do Aluno: a mesma regra precisa existir dentro da RPC executável por
-- authenticated. A API é apenas UX/defesa em profundidade; chamada direta ao
-- Data API não pode contornar a decisão RAA, o bloqueio condicional ou a dívida.
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
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'REMATRICULA_DEBT_REQUIRED',
      DETAIL = 'Existem saldos em aberto na matrícula de origem.';
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

REVOKE ALL ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.aluno_iniciar_rematricula(uuid, uuid[]) TO authenticated;

COMMIT;
