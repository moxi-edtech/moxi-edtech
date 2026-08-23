BEGIN;

-- Deve executar depois do alinhamento de origens históricas de 2027-08-22.

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
  IF COALESCE(v_raa->>'decision', 'pendente') IN ('pendente', 'recurso', 'concluiu')
     OR COALESCE((v_raa->>'efetivacao_matricula_bloqueada')::boolean, false) THEN
    RAISE EXCEPTION 'ACADEMICO: situação académica não autoriza rematrícula';
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
      AND men.status IN ('pendente', 'atrasado', 'pago_parcial')
  ) THEN
    RAISE EXCEPTION 'FINANCEIRO: possui pendências financeiras';
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

  v_classe_destino_numero := CASE
    WHEN v_raa->>'destino' = 'mesma_etapa' THEN v_classe_origem_numero
    WHEN v_raa->>'destino' = 'proxima_etapa' THEN v_classe_origem_numero + 1
    ELSE NULL
  END;

  IF v_classe_destino_numero IS NULL THEN
    RAISE EXCEPTION 'ACADEMICO: classe destino não resolvida pelo RAA';
  END IF;

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
