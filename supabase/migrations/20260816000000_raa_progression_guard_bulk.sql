BEGIN;

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
  v_origem record;
  v_dest_session uuid;
  v_dest_ano int;
  v_origem_ano int;
  v_exame_fim date;
  v_bloquear_inadimplentes boolean := false;
  v_raa jsonb;
  v_decision text;
  v_existing_id uuid;
  v_new_id uuid;
  v_dest_numero int;
  v_origem_numero int;
  v_expected_numero int;
  v_balance numeric;
  v_inserted jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = p_origem_turma_id AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma de origem não pertence à escola';
  END IF;

  SELECT t.session_id, t.ano_letivo INTO v_dest_session, v_dest_ano
  FROM public.turmas t
  WHERE t.id = p_destino_turma_id AND t.escola_id = p_escola_id;
  SELECT t.ano_letivo INTO v_origem_ano
  FROM public.turmas t
  WHERE t.id = p_origem_turma_id AND t.escola_id = p_escola_id;
  IF v_dest_session IS NULL OR v_dest_ano IS NULL THEN
    RAISE EXCEPTION 'Turma de destino inválida ou sem sessão vinculada';
  END IF;

  SELECT MAX(data_fim) INTO v_exame_fim
  FROM public.calendario_eventos
  WHERE escola_id = p_escola_id
    AND tipo = 'EXAME_NACIONAL'
    AND ano_letivo_id IN (
      SELECT al.id FROM public.anos_letivos al
      WHERE al.escola_id = p_escola_id AND al.ano = v_origem_ano
    );
  IF v_exame_fim IS NOT NULL AND CURRENT_DATE <= v_exame_fim THEN
    RAISE EXCEPTION 'BLOQUEIO: A transição de ano não é permitida antes do término dos Exames Nacionais (%s).',
      to_char(v_exame_fim, 'DD/MM/YYYY');
  END IF;

  SELECT COALESCE(cf.bloquear_inadimplentes, false) INTO v_bloquear_inadimplentes
  FROM public.configuracoes_financeiro cf
  WHERE cf.escola_id = p_escola_id;

  v_dest_numero := public.turma_classe_numero(p_destino_turma_id);

  FOR v_origem IN
    SELECT m.*
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_origem_turma_id
      AND lower(coalesce(m.status, '')) IN ('ativo','ativa','active','pendente','aprovado','aprovada')
    ORDER BY m.id
  LOOP
    BEGIN
      SELECT m.id INTO v_existing_id
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.aluno_id = v_origem.aluno_id
        AND m.session_id = v_dest_session
        AND lower(coalesce(m.status, '')) IN ('ativo','ativa','active');
      IF v_existing_id IS NOT NULL THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id, 'motivos', jsonb_build_array('ja_ativo')
        ));
        CONTINUE;
      END IF;

      IF v_bloquear_inadimplentes AND EXISTS (
        SELECT 1 FROM public.mensalidades ms
        WHERE ms.escola_id = p_escola_id AND ms.aluno_id = v_origem.aluno_id
          AND ms.ano_referencia = v_origem.ano_letivo
          AND ms.status IN ('pendente','pago_parcial')
          AND ms.data_vencimento < CURRENT_DATE
      ) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id, 'motivos', jsonb_build_array('inadimplencia')
        ));
        CONTINUE;
      END IF;

      v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_origem.id);
      v_decision := v_raa->>'decision';
      IF v_decision IN ('pendente','recurso','concluiu') OR v_decision IS NULL THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id,
          'motivos', jsonb_build_array('raa_' || coalesce(v_decision, 'invalida')), 'raa', v_raa
        ));
        CONTINUE;
      END IF;

      v_origem_numero := public.turma_classe_numero(v_origem.turma_id);
      v_expected_numero := CASE
        WHEN v_decision IN ('retido','retido_por_faltas','retido_por_indisciplina') THEN v_origem_numero
        ELSE v_origem_numero + 1
      END;
      IF v_dest_numero IS NOT NULL AND v_origem_numero IS NOT NULL AND v_dest_numero <> v_expected_numero THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id,
          'motivos', jsonb_build_array('turma_destino_incompativel'), 'raa', v_raa
        ));
        CONTINUE;
      END IF;

      SELECT COALESCE(SUM(
        CASE WHEN me.status IN ('pago','isento','cancelado') THEN 0
             ELSE GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0) END
      ), 0) INTO v_balance
      FROM public.mensalidades me
      WHERE me.escola_id = p_escola_id AND me.aluno_id = v_origem.aluno_id AND me.matricula_id = v_origem.id;
      IF v_balance > 0 THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id, 'motivos', jsonb_build_array('saldo_devedor')
        ));
        CONTINUE;
      END IF;

      INSERT INTO public.matriculas (
        id, escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
        ativo, numero_matricula, created_at, data_matricula, origem_transicao_matricula_id
      ) VALUES (
        gen_random_uuid(), p_escola_id, v_origem.aluno_id, p_destino_turma_id,
        v_dest_session, v_dest_ano, 'ativo', true,
        public.next_matricula_number(p_escola_id)::text, now(), CURRENT_DATE, v_origem.id
      ) RETURNING id INTO v_new_id;

      UPDATE public.matriculas SET status = 'transferido', ativo = false, updated_at = now()
      WHERE id = v_origem.id;
      v_inserted := v_inserted || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_new_id, 'aluno_id', v_origem.aluno_id, 'raa_decision', v_decision
      ));
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'RAA_PROGRESSION_POLICY_NOT_CONFIGURED:%' OR SQLERRM LIKE 'ACADEMIC_RESULT_INVALID:%' THEN
        RAISE;
      END IF;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'matricula_id', v_origem.id, 'aluno_id', v_origem.aluno_id, 'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_skipped, v_errors;
END;
$$;

REVOKE ALL ON FUNCTION public.rematricula_em_massa(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rematricula_em_massa(uuid, uuid, uuid) TO authenticated;

COMMIT;
