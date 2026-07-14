BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_reclassificar_aluno_turma(
  p_matricula_id uuid,
  p_turma_destino_id uuid,
  p_reprecificar_abertas boolean DEFAULT true,
  p_reprecificar_pagas boolean DEFAULT false,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_turma_destino record;
  v_turma_origem_id uuid;
  v_tabela_id uuid;
  v_valor_novo numeric;
  v_matriculas_atualizadas int := 0;
  v_mensalidades_turma_atualizadas int := 0;
  v_mensalidades_abertas_reprecificadas int := 0;
  v_mensalidades_pagas_reprecificadas int := 0;
  v_pagamentos_reprecificados int := 0;
  v_lancamentos_reprecificados int := 0;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'Somente Super Admin pode reclassificar aluno.';
  END IF;

  SELECT
    m.id,
    m.escola_id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.status
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula não encontrada.';
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.nome,
    t.curso_id,
    t.classe_id,
    t.ano_letivo
    INTO v_turma_destino
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id;

  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'Turma destino não encontrada.';
  END IF;

  IF v_turma_destino.escola_id IS DISTINCT FROM v_matricula.escola_id THEN
    RAISE EXCEPTION 'Turma destino pertence a outra escola.';
  END IF;

  IF v_turma_destino.ano_letivo IS NOT NULL
     AND v_matricula.ano_letivo IS NOT NULL
     AND v_turma_destino.ano_letivo::int IS DISTINCT FROM v_matricula.ano_letivo::int THEN
    RAISE EXCEPTION 'Turma destino pertence a outro ano letivo.';
  END IF;

  SELECT ft.id, ft.valor_mensalidade
    INTO v_tabela_id, v_valor_novo
  FROM public.financeiro_tabelas ft
  WHERE ft.escola_id = v_matricula.escola_id
    AND ft.ano_letivo = v_matricula.ano_letivo
    AND ft.curso_id = v_turma_destino.curso_id
    AND ft.classe_id = v_turma_destino.classe_id
  ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma_destino.curso_id
      AND ft.classe_id IS NULL
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id = v_turma_destino.classe_id
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id IS NULL
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF (p_reprecificar_abertas OR p_reprecificar_pagas) AND v_valor_novo IS NULL THEN
    RAISE EXCEPTION 'Tabela de propina não encontrada para a turma destino.';
  END IF;

  v_turma_origem_id := v_matricula.turma_id;

  UPDATE public.matriculas m
  SET turma_id = p_turma_destino_id,
      updated_at = now()
  WHERE m.id = p_matricula_id
    AND m.turma_id IS DISTINCT FROM p_turma_destino_id;
  GET DIAGNOSTICS v_matriculas_atualizadas = ROW_COUNT;

  UPDATE public.mensalidades mn
  SET turma_id = p_turma_destino_id,
      updated_at = now()
  WHERE mn.matricula_id = p_matricula_id
    AND mn.escola_id = v_matricula.escola_id
    AND mn.turma_id IS DISTINCT FROM p_turma_destino_id;
  GET DIAGNOSTICS v_mensalidades_turma_atualizadas = ROW_COUNT;

  IF p_reprecificar_abertas THEN
    UPDATE public.mensalidades mn
    SET valor = v_valor_novo,
        valor_previsto = v_valor_novo,
        tabela_id = v_tabela_id,
        status = 'pendente',
        updated_at = now()
    WHERE mn.matricula_id = p_matricula_id
      AND mn.escola_id = v_matricula.escola_id
      AND mn.status IN ('pendente', 'pago_parcial', 'atrasado', 'parcial', 'isento')
      AND coalesce(mn.valor_pago_total, 0) = 0;
    GET DIAGNOSTICS v_mensalidades_abertas_reprecificadas = ROW_COUNT;
  END IF;

  IF p_reprecificar_pagas THEN
    WITH mensalidades_pagas AS (
      UPDATE public.mensalidades mn
      SET valor = v_valor_novo,
          valor_previsto = v_valor_novo,
          valor_pago_total = v_valor_novo,
          tabela_id = v_tabela_id,
          updated_at = now()
      WHERE mn.matricula_id = p_matricula_id
        AND mn.escola_id = v_matricula.escola_id
        AND mn.status = 'pago'
      RETURNING mn.id
    ),
    pagamentos_atualizados AS (
      UPDATE public.pagamentos p
      SET valor_pago = v_valor_novo,
          updated_at = now(),
          meta = coalesce(p.meta, '{}'::jsonb) || jsonb_build_object(
            'correcao_valor_propina', 'reclassificacao_turma',
            'valor_corrigido', v_valor_novo,
            'turma_destino_id', p_turma_destino_id,
            'corrigido_por', 'super_admin_tool',
            'corrigido_em', now()
          )
      FROM mensalidades_pagas mp
      WHERE p.mensalidade_id = mp.id
        AND p.status IN ('settled', 'concluido', 'pago')
      RETURNING p.id
    )
    SELECT
      (SELECT count(*) FROM mensalidades_pagas),
      (SELECT count(*) FROM pagamentos_atualizados)
      INTO v_mensalidades_pagas_reprecificadas, v_pagamentos_reprecificados;
  END IF;

  IF p_reprecificar_abertas OR p_reprecificar_pagas THEN
    UPDATE public.financeiro_lancamentos fl
    SET valor_original = v_valor_novo,
        updated_at = now()
    WHERE fl.matricula_id = p_matricula_id
      AND fl.origem::text = 'mensalidade'
      AND (
        (p_reprecificar_pagas AND fl.status::text IN ('pago', 'concluido', 'settled'))
        OR (p_reprecificar_abertas AND fl.status::text IN ('pendente', 'pago_parcial', 'atrasado', 'parcial'))
      );
    GET DIAGNOSTICS v_lancamentos_reprecificados = ROW_COUNT;
  END IF;

  INSERT INTO public.audit_logs (escola_id, user_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'SUPER_ADMIN_RECLASSIFICAR_ALUNO_TURMA',
    'matriculas',
    p_matricula_id::text,
    'super_admin',
    jsonb_build_object(
      'aluno_id', v_matricula.aluno_id,
      'turma_origem_id', v_turma_origem_id,
      'turma_destino_id', p_turma_destino_id,
      'turma_destino_nome', v_turma_destino.nome,
      'tabela_id', v_tabela_id,
      'valor_novo', v_valor_novo,
      'reprecificar_abertas', p_reprecificar_abertas,
      'reprecificar_pagas', p_reprecificar_pagas,
      'motivo', p_motivo,
      'matriculas_atualizadas', v_matriculas_atualizadas,
      'mensalidades_turma_atualizadas', v_mensalidades_turma_atualizadas,
      'mensalidades_abertas_reprecificadas', v_mensalidades_abertas_reprecificadas,
      'mensalidades_pagas_reprecificadas', v_mensalidades_pagas_reprecificadas,
      'pagamentos_reprecificados', v_pagamentos_reprecificados,
      'lancamentos_reprecificados', v_lancamentos_reprecificados
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', p_matricula_id,
    'aluno_id', v_matricula.aluno_id,
    'turma_origem_id', v_turma_origem_id,
    'turma_destino_id', p_turma_destino_id,
    'turma_destino_nome', v_turma_destino.nome,
    'tabela_id', v_tabela_id,
    'valor_novo', v_valor_novo,
    'matriculas_atualizadas', v_matriculas_atualizadas,
    'mensalidades_turma_atualizadas', v_mensalidades_turma_atualizadas,
    'mensalidades_abertas_reprecificadas', v_mensalidades_abertas_reprecificadas,
    'mensalidades_pagas_reprecificadas', v_mensalidades_pagas_reprecificadas,
    'pagamentos_reprecificados', v_pagamentos_reprecificados,
    'lancamentos_reprecificados', v_lancamentos_reprecificados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_reclassificar_aluno_turma(uuid, uuid, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_reclassificar_aluno_turma(uuid, uuid, boolean, boolean, text) TO authenticated;

COMMIT;
