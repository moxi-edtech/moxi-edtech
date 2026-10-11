BEGIN;

-- Normaliza privilégios porque ambientes Supabase podem ter default privileges
-- mais amplos que um Postgres limpo. O lifecycle é read-only para utilizadores;
-- apenas service_role/triggers internos podem materializar ou atualizar estado.
REVOKE ALL ON TABLE public.dependencias_academicas_transicao
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.dependencias_academicas_transicao_eventos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.dependencias_academicas_transicao TO authenticated;
GRANT SELECT ON TABLE public.dependencias_academicas_transicao_eventos TO authenticated;
GRANT ALL ON TABLE public.dependencias_academicas_transicao TO service_role;
GRANT ALL ON TABLE public.dependencias_academicas_transicao_eventos TO service_role;

-- Follow-up de 20270826124000 já aplicado em produção.
-- Preserva o lifecycle original e endurece somente:
-- 1) reconstrução por snapshot RAA do pedido de rematrícula;
-- 2) backfill idempotente de destinos já existentes;
-- 3) resultado negativo continua operacionalmente aberto.

CREATE OR REPLACE FUNCTION public.sync_dependencias_academicas_transicao(
  p_escola_id uuid,
  p_matricula_origem_id uuid,
  p_matricula_destino_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_origem record;
  v_destino_id uuid := p_matricula_destino_id;
  v_raa jsonb;
  v_disciplina_id uuid;
  v_td_id uuid;
  v_result jsonb;
  v_result_status text;
  v_lifecycle_status text;
  v_is_pending boolean;
  v_exame_sessao_id uuid;
  v_fonte text;
  v_resolved boolean;
  v_total integer := 0;
  v_abertas integer := 0;
  v_resolvidas integer := 0;
BEGIN
  SELECT m.id, m.escola_id, m.aluno_id, m.turma_id
    INTO v_origem
  FROM public.matriculas m
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id;

  IF v_origem.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ORIGIN_NOT_FOUND');
  END IF;

  IF v_destino_id IS NULL THEN
    SELECT m.id INTO v_destino_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.aluno_id = v_origem.aluno_id
      AND m.origem_transicao_matricula_id = p_matricula_origem_id
    ORDER BY m.created_at DESC NULLS LAST, m.id DESC
    LIMIT 1;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.id = v_destino_id
        AND m.escola_id = p_escola_id
        AND m.aluno_id = v_origem.aluno_id
        AND m.origem_transicao_matricula_id = p_matricula_origem_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'DESTINATION_MISMATCH');
    END IF;
  END IF;

  IF v_destino_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'status', 'no_destination', 'total', 0);
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(
    p_escola_id,
    p_matricula_origem_id
  );

  FOR v_disciplina_id IN
    SELECT DISTINCT q.disciplina_id
    FROM (
      -- Dependências já materializadas nunca desaparecem só porque o RAA
      -- deixou de listar a disciplina depois do fecho da matrícula de origem.
      SELECT d.disciplina_id
      FROM public.dependencias_academicas_transicao d
      WHERE d.escola_id = p_escola_id
        AND d.matricula_origem_id = p_matricula_origem_id

      UNION ALL

      -- Estado corrente do RAA.
      SELECT value::uuid
      FROM jsonb_array_elements_text(
        coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb)
      )

      UNION ALL

      -- Snapshot auditável capturado no pedido de rematrícula. Este fallback
      -- é essencial no backfill: a origem pode já estar encerrada quando a
      -- migration for aplicada.
      SELECT snapshot.value::uuid
      FROM public.servico_pedidos sp
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(sp.contexto->'raa_disciplina_ids_pendentes') = 'array'
            THEN sp.contexto->'raa_disciplina_ids_pendentes'
          ELSE '[]'::jsonb
        END
      ) snapshot(value)
      WHERE sp.escola_id = p_escola_id
        AND sp.aluno_id = v_origem.aluno_id
        AND sp.servico_codigo = 'SERV_REMATRICULA'
        AND (
          sp.matricula_id = p_matricula_origem_id
          OR sp.contexto->>'origem_matricula_id' = p_matricula_origem_id::text
        )
    ) q
  LOOP
    SELECT td.id INTO v_td_id
    FROM public.turma_disciplinas td
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_origem.turma_id
      AND td.avaliacao_disciplina_id = v_disciplina_id
    ORDER BY td.id
    LIMIT 1;

    v_result := public.resolve_estado_resultado(
      p_matricula_origem_id,
      v_disciplina_id
    );
    v_result_status := lower(coalesce(v_result->>'status', 'pendente_dados'));
    v_exame_sessao_id := NULLIF(v_result->>'exame_sessao_id', '')::uuid;
    v_fonte := 'raa';

    IF v_exame_sessao_id IS NOT NULL THEN
      SELECT es.tipo INTO v_fonte
      FROM public.exame_sessoes es
      WHERE es.id = v_exame_sessao_id
        AND es.escola_id = p_escola_id;
      v_fonte := coalesce(v_fonte, 'raa');
    END IF;

    SELECT (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb)
        ) p(value)
        WHERE p.value = v_disciplina_id::text
      )
      OR EXISTS (
        SELECT 1
        FROM public.servico_pedidos sp
        CROSS JOIN LATERAL jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(sp.contexto->'raa_disciplina_ids_pendentes') = 'array'
              THEN sp.contexto->'raa_disciplina_ids_pendentes'
            ELSE '[]'::jsonb
          END
        ) snapshot(value)
        WHERE sp.escola_id = p_escola_id
          AND sp.aluno_id = v_origem.aluno_id
          AND sp.servico_codigo = 'SERV_REMATRICULA'
          AND (
            sp.matricula_id = p_matricula_origem_id
            OR sp.contexto->>'origem_matricula_id' = p_matricula_origem_id::text
          )
          AND snapshot.value = v_disciplina_id::text
      )
    ) INTO v_is_pending;

    v_resolved := false;
    IF v_exame_sessao_id IS NOT NULL AND v_result_status = 'aprovado' THEN
      v_lifecycle_status := 'resolvida_aprovada';
      v_resolved := true;
    ELSIF v_exame_sessao_id IS NOT NULL
       AND v_result_status IN ('reprovado','reprovado_por_faltas','reprovado_por_indisciplina') THEN
      v_lifecycle_status := 'resolvida_reprovada';
      v_resolved := true;
    ELSIF v_result_status = 'aprovado' AND NOT v_is_pending THEN
      v_lifecycle_status := 'resolvida_aprovada';
      v_resolved := true;
    ELSIF v_result_status IN ('reprovado','reprovado_por_faltas','reprovado_por_indisciplina')
       AND NOT v_is_pending THEN
      v_lifecycle_status := 'resolvida_reprovada';
      v_resolved := true;
    ELSIF v_result_status = 'recurso' OR v_is_pending THEN
      v_lifecycle_status := 'em_recurso';
    ELSE
      v_lifecycle_status := 'pendente';
    END IF;

    INSERT INTO public.dependencias_academicas_transicao (
      escola_id,
      aluno_id,
      matricula_origem_id,
      matricula_destino_id,
      disciplina_id,
      turma_disciplina_origem_id,
      status,
      raa_decision_origem,
      raa_motivo_origem,
      resultado_status,
      resultado_nota,
      resultado_motivo,
      fonte_resolucao,
      exame_sessao_id,
      resultado_snapshot,
      resolvido_em,
      ultima_sincronizacao_em,
      updated_at
    ) VALUES (
      p_escola_id,
      v_origem.aluno_id,
      p_matricula_origem_id,
      v_destino_id,
      v_disciplina_id,
      v_td_id,
      v_lifecycle_status,
      v_raa->>'decision',
      v_raa->>'motivo',
      v_result_status,
      NULLIF(v_result->>'nota', '')::numeric,
      v_result->>'motivo',
      v_fonte,
      v_exame_sessao_id,
      coalesce(v_result, '{}'::jsonb),
      CASE WHEN v_resolved THEN now() ELSE NULL END,
      now(),
      now()
    )
    ON CONFLICT (escola_id, matricula_origem_id, disciplina_id)
    DO UPDATE SET
      matricula_destino_id = EXCLUDED.matricula_destino_id,
      turma_disciplina_origem_id = EXCLUDED.turma_disciplina_origem_id,
      status = EXCLUDED.status,
      raa_decision_origem = EXCLUDED.raa_decision_origem,
      raa_motivo_origem = EXCLUDED.raa_motivo_origem,
      resultado_status = EXCLUDED.resultado_status,
      resultado_nota = EXCLUDED.resultado_nota,
      resultado_motivo = EXCLUDED.resultado_motivo,
      fonte_resolucao = EXCLUDED.fonte_resolucao,
      exame_sessao_id = EXCLUDED.exame_sessao_id,
      resultado_snapshot = EXCLUDED.resultado_snapshot,
      resolvido_em = CASE
        WHEN EXCLUDED.status IN ('resolvida_aprovada','resolvida_reprovada') THEN
          CASE
            WHEN public.dependencias_academicas_transicao.status IS DISTINCT FROM EXCLUDED.status
              OR public.dependencias_academicas_transicao.resolvido_em IS NULL
            THEN now()
            ELSE public.dependencias_academicas_transicao.resolvido_em
          END
        ELSE NULL
      END,
      ultima_sincronizacao_em = now(),
      updated_at = now();
  END LOOP;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status IN ('pendente','em_recurso','resolvida_reprovada'))::integer,
    count(*) FILTER (WHERE status = 'resolvida_aprovada')::integer
  INTO v_total, v_abertas, v_resolvidas
  FROM public.dependencias_academicas_transicao d
  WHERE d.escola_id = p_escola_id
    AND d.matricula_origem_id = p_matricula_origem_id;

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_origem_id', p_matricula_origem_id,
    'matricula_destino_id', v_destino_id,
    'total', v_total,
    'abertas', v_abertas,
    'regularizadas', v_resolvidas,
    'resolvidas', v_resolvidas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_dependencias_academicas_transicao(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_dependencias_academicas_transicao(uuid, uuid, uuid)
  TO service_role;

-- Backfill idempotente das transições já existentes. O sync usa o RAA atual,
-- dependências materializadas e o snapshot do pedido, por isso não inventa
-- disciplinas nem depende de uma ação manual para tornar a fila visível.
DO $backfill$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT m.escola_id, m.id AS matricula_destino_id, m.origem_transicao_matricula_id
    FROM public.matriculas m
    WHERE m.origem_transicao_matricula_id IS NOT NULL
    ORDER BY m.escola_id, m.id
  LOOP
    PERFORM public.sync_dependencias_academicas_transicao(
      v_row.escola_id,
      v_row.origem_transicao_matricula_id,
      v_row.matricula_destino_id
    );
  END LOOP;
END;
$backfill$;

COMMIT;
