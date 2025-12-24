-- Pesquisa Global (Feature 5) e Dossiê (Feature 23)
-- 1) Coluna gerada para texto de busca + índice GIN
ALTER TABLE public.alunos
ADD COLUMN IF NOT EXISTS search_text text
  GENERATED ALWAYS AS (
    coalesce(nome_completo, nome, '') || ' '
    || coalesce(numero_processo, '') || ' '
    || coalesce(bi_numero, '') || ' '
    || coalesce(encarregado_nome, '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_alunos_search_gin
  ON public.alunos USING GIN (to_tsvector('simple', search_text));

-- 2) RPC de super-busca por escola (autocomplete)
CREATE OR REPLACE FUNCTION public.search_alunos_global(
  p_escola_id uuid,
  p_query text,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  nome text,
  processo text,
  turma text,
  status text,
  aluno_status text,
  turma_id uuid,
  aluno_bi text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_query text := coalesce(trim(p_query), '');
  v_tsquery tsquery := NULL;
BEGIN
  -- Normaliza consulta para prefix matching (token*:*)
  IF v_query <> '' THEN
    v_query := replace(v_query, '''', ' ');
    v_tsquery := to_tsquery(
      'simple',
      regexp_replace(v_query, '\\s+', ' & ', 'g') || ':*'
    );
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    coalesce(a.nome_completo, a.nome) AS nome,
    a.numero_processo AS processo,
    coalesce(t.nome, 'Sem turma') AS turma,
    coalesce(m.status, 'sem_matricula') AS status,
    a.status AS aluno_status,
    t.id AS turma_id,
    a.bi_numero AS aluno_bi
  FROM public.alunos a
  LEFT JOIN LATERAL (
    SELECT m.id, m.turma_id, m.status, m.data_matricula
    FROM public.matriculas m
    WHERE m.aluno_id = a.id
      AND m.escola_id = p_escola_id
    ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC
    LIMIT 1
  ) m ON TRUE
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  WHERE a.escola_id = p_escola_id
    AND a.deleted_at IS NULL
    AND (
      v_tsquery IS NULL
      OR to_tsvector('simple', a.search_text) @@ v_tsquery
      OR a.numero_processo ILIKE '%' || v_query || '%'
      OR a.bi_numero ILIKE '%' || v_query || '%'
      OR a.nome ILIKE '%' || v_query || '%'
    )
  ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit, 10), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_alunos_global(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_alunos_global(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_alunos_global(uuid, text, int) TO service_role;

-- 3) RPC de Dossiê consolidado (acadêmico + financeiro)
CREATE OR REPLACE FUNCTION public.get_aluno_dossier(
  p_escola_id uuid,
  p_aluno_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_aluno jsonb;
  v_matriculas jsonb;
  v_financeiro jsonb;
BEGIN
  -- Perfil do aluno dentro da escola
  SELECT to_jsonb(a.*) INTO v_aluno
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.escola_id = p_escola_id;

  IF v_aluno IS NULL THEN
    RETURN NULL;
  END IF;

  -- Histórico de matrículas (mais recente primeiro)
  SELECT jsonb_agg(row_to_json(m.*) ORDER BY m.ano_letivo DESC, m.data_matricula DESC)
    INTO v_matriculas
  FROM (
    SELECT
      m.id,
      m.ano_letivo,
      m.status,
      m.data_matricula,
      m.numero_matricula,
      t.id AS turma_id,
      t.nome AS turma,
      t.turno,
      c.nome AS classe,
      t.ano_letivo AS turma_ano_letivo
    FROM public.matriculas m
    LEFT JOIN public.turmas t ON t.id = m.turma_id
    LEFT JOIN public.classes c ON c.id = t.classe_id
    WHERE m.aluno_id = p_aluno_id
      AND m.escola_id = p_escola_id
    ORDER BY m.ano_letivo DESC, m.data_matricula DESC NULLS LAST
  ) m;

  -- Resumo financeiro simples (mensalidades)
  SELECT jsonb_build_object(
    'total_previsto', coalesce(SUM(valor_previsto), 0),
    'total_pago', coalesce(SUM(valor_pago_total), 0),
    'total_em_atraso', coalesce(SUM(CASE WHEN status <> 'pago' AND data_vencimento < CURRENT_DATE THEN (valor_previsto - valor_pago_total) ELSE 0 END), 0),
    'mensalidades', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'mes', mes_referencia,
      'ano', ano_referencia,
      'valor', valor_previsto,
      'pago', valor_pago_total,
      'status', status,
      'vencimento', data_vencimento,
      'pago_em', data_pagamento_efetiva
    ) ORDER BY ano_referencia DESC, mes_referencia DESC), '[]'::jsonb)
  )
  INTO v_financeiro
  FROM public.mensalidades
  WHERE aluno_id = p_aluno_id
    AND escola_id = p_escola_id;

  RETURN jsonb_build_object(
    'perfil', v_aluno,
    'historico', coalesce(v_matriculas, '[]'::jsonb),
    'financeiro', coalesce(v_financeiro, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_aluno_dossier(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_aluno_dossier(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_aluno_dossier(uuid, uuid) TO service_role;
