BEGIN;

-- =================================================================
-- RPC para Conciliação Automática de Transações Importadas (`auto_match`)
--
-- OBJETIVO:
-- 1. Encapsular a lógica de "matching" automático do extrato bancário
--    com alunos e mensalidades pendentes.
-- 2. Garantir que a operação seja atômica e auditada.
-- 3. Melhorar a performance para grandes volumes de dados.
-- =================================================================

CREATE OR REPLACE FUNCTION public.conciliar_transacoes_auto_match(
  p_escola_id uuid,
  p_import_id uuid DEFAULT NULL -- Se NULL, processa todas as pendentes da escola
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_transacao record;
  v_matched_count int := 0;
  v_total_processed int := 0;
  v_aluno_match_details jsonb;
  v_match_confianca int;
  v_mensalidades_pendentes jsonb;
  v_aluno_by_ref record;
BEGIN
  -- Iterar sobre todas as transações importadas pendentes
  FOR v_transacao IN
    SELECT *
    FROM public.financeiro_transacoes_importadas
    WHERE escola_id = p_escola_id
      AND status = 'pendente'
      AND (p_import_id IS NULL OR import_id = p_import_id)
  LOOP
    v_total_processed := v_total_processed + 1;
    v_aluno_match_details := NULL;
    v_match_confianca := 0;
    v_mensalidades_pendentes := '[]'::jsonb;

    -- Tentar encontrar aluno por referencia (BI ou Telefone)
    IF v_transacao.referencia IS NOT NULL AND v_transacao.referencia <> '' THEN
      SELECT
        a.id,
        a.nome,
        a.bi_numero,
        a.telefone_responsavel,
        t.nome AS turma_nome
      INTO v_aluno_by_ref
      FROM public.alunos a
      LEFT JOIN public.matriculas m ON a.id = m.aluno_id AND m.escola_id = p_escola_id AND m.status IN ('ativa', 'ativo')
      LEFT JOIN public.turmas t ON m.turma_id = t.id
      WHERE a.escola_id = p_escola_id
        AND (a.bi_numero = v_transacao.referencia OR a.telefone_responsavel = v_transacao.referencia)
      LIMIT 1;

      IF v_aluno_by_ref.id IS NOT NULL THEN
        v_match_confianca := 90; -- Alta confiança

        -- Buscar mensalidades pendentes para este aluno
        SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'mes', mes_referencia,
          'ano', ano_referencia,
          'valor', valor
        )) INTO v_mensalidades_pendentes
        FROM public.mensalidades
        WHERE aluno_id = v_aluno_by_ref.id
          AND escola_id = p_escola_id
          AND status = 'pendente'
        ORDER BY data_vencimento ASC;

        v_aluno_match_details := jsonb_build_object(
          'alunoId', v_aluno_by_ref.id,
          'alunoNome', v_aluno_by_ref.nome,
          'turma', v_aluno_by_ref.turma_nome,
          'mensalidadesPendentes', v_mensalidades_pendentes
        );

        -- Se houver match de valor exato com mensalidade pendente, aumenta confiança
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_mensalidades_pendentes) AS mensalidade WHERE (mensalidade->>'valor')::numeric = v_transacao.valor) THEN
          v_match_confianca := 95;
        END IF;

        v_matched_count := v_matched_count + 1;
      END IF;
    END IF;

    -- Atualizar transação importada com os detalhes do match
    UPDATE public.financeiro_transacoes_importadas
    SET
      aluno_match_details = v_aluno_match_details,
      match_confianca = v_match_confianca,
      updated_at = NOW()
    WHERE id = v_transacao.id;

  END LOOP;

  -- Auditoria da operação de auto-match
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'CONCILIACAO_AUTO_MATCH',
    'financeiro_transacoes_importadas',
    p_import_id::text, -- Associado ao lote de importação
    'financeiro',
    jsonb_build_object(
      'total_processado', v_total_processed,
      'total_matched', v_matched_count,
      'import_id', p_import_id
    )
  );

  RETURN jsonb_build_object('ok', TRUE, 'matched_count', v_matched_count, 'total_processed', v_total_processed);
END;
$$;

ALTER FUNCTION public.conciliar_transacoes_auto_match(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.conciliar_transacoes_auto_match(uuid, uuid) TO authenticated;

COMMIT;
