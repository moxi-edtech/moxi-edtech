BEGIN;

-- RAA Sprint 2: contrato único para operações transacionais.
-- A função apenas resolve o estado; não cria, move ou apaga matrículas.
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
  p_escola_id uuid,
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_regime jsonb;
  v_config record;
  v_statuses jsonb := '[]'::jsonb;
  v_status text;
  v_disciplina_id uuid;
  v_has_pending boolean := false;
  v_has_reprovado boolean := false;
  v_has_recurso boolean := false;
  v_has_indisciplina boolean := false;
  v_presenca numeric;
  v_frequencia_min numeric := 75;
  v_decision text;
  v_destino text;
  v_motivo text;
  v_etapa_destino jsonb := NULL;
  v_nivel text;
  v_classe integer;
  v_ano integer;
  v_modulo integer;
  v_exame boolean := false;
BEGIN
  SELECT m.id, m.escola_id, m.turma_id, m.aluno_id
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id IS NOT NULL;

  IF v_matricula.id IS NULL THEN
    RETURN jsonb_build_object('decision', 'pendente', 'destino', 'aguardar_dados',
      'motivo', 'dados_pendentes', 'disciplina_ids_pendentes', '[]'::jsonb);
  END IF;

  SELECT cp.permitir_inscricao_condicional, cp.permitir_progressao_com_recurso
    INTO v_config
  FROM public.configuracoes_pedagogicas cp
  WHERE cp.escola_id = p_escola_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_POLICY_NOT_CONFIGURED: política de progressão não configurada';
  END IF;

  v_regime := public.resolve_regime_academico(v_matricula.turma_id);
  v_nivel := v_regime->>'nivel_ensino';
  v_classe := (v_regime->>'classe_num')::integer;
  v_ano := (v_regime->>'ano_numero')::integer;
  v_modulo := (v_regime->>'modulo_numero')::integer;
  v_exame := coalesce((v_regime->>'eh_classe_exame')::boolean, false);

  FOR v_disciplina_id IN
    SELECT DISTINCT td.avaliacao_disciplina_id
    FROM public.turma_disciplinas td
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_matricula.turma_id
      AND td.avaliacao_disciplina_id IS NOT NULL
  LOOP
    SELECT coalesce(public.resolve_estado_resultado(p_matricula_id, v_disciplina_id)->>'status', 'pendente_dados')
      INTO v_status;

    IF v_status NOT IN ('aprovado', 'recurso', 'reprovado', 'reprovado_por_faltas',
                        'reprovado_por_indisciplina', 'pendente_dados', 'pendente_formula') THEN
      RAISE EXCEPTION 'ACADEMIC_RESULT_INVALID: estado académico inválido (%)', v_status;
    END IF;

    v_statuses := v_statuses || jsonb_build_array(jsonb_build_object(
      'disciplina_id', v_disciplina_id, 'status', v_status
    ));
    v_has_pending := v_has_pending OR v_status IN ('pendente_dados', 'pendente_formula');
    v_has_reprovado := v_has_reprovado OR v_status = 'reprovado';
    v_has_recurso := v_has_recurso OR v_status = 'recurso';
    v_has_indisciplina := v_has_indisciplina OR v_status = 'reprovado_por_indisciplina';
  END LOOP;

  SELECT CASE WHEN sum(coalesce(fsp.aulas_previstas, 0)) > 0
    THEN round((sum(coalesce(fsp.aulas_previstas, 0)) - sum(coalesce(fsp.faltas, 0))) * 100.0 /
      sum(coalesce(fsp.aulas_previstas, 0)), 2)
    ELSE NULL END,
    coalesce(max(fsp.frequencia_min_percent), 75)
    INTO v_presenca, v_frequencia_min
  FROM public.frequencia_status_periodo fsp
  WHERE fsp.escola_id = p_escola_id
    AND fsp.matricula_id = p_matricula_id;

  IF jsonb_array_length(v_statuses) = 0 OR v_has_pending THEN
    v_decision := 'pendente'; v_destino := 'aguardar_dados'; v_motivo := 'dados_pendentes';
  ELSIF v_has_indisciplina THEN
    v_decision := 'retido_por_indisciplina'; v_destino := 'mesma_etapa'; v_motivo := 'indisciplina_grave';
    v_etapa_destino := v_regime;
  ELSIF coalesce(v_presenca < v_frequencia_min, false) THEN
    v_decision := 'retido_por_faltas'; v_destino := 'mesma_etapa'; v_motivo := 'faltas';
    v_etapa_destino := v_regime;
  ELSIF v_has_reprovado THEN
    v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'aproveitamento';
    v_etapa_destino := v_regime;
  ELSIF v_has_recurso THEN
    IF v_config.permitir_inscricao_condicional AND v_config.permitir_progressao_com_recurso
       AND NOT v_exame THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'recurso';
    ELSE
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'recurso';
      v_etapa_destino := v_regime;
    END IF;
  ELSIF (v_nivel = 'primario' AND v_classe = 6)
     OR (v_nivel = 'secundario' AND v_classe = 12)
     OR (v_nivel = 'eja' AND (v_modulo = 3 OR v_ano = 2))
     OR v_exame THEN
    v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias';
  ELSE
    v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias';
    v_etapa_destino := jsonb_build_object(
      'nivel_ensino', v_nivel,
      'classe_num', CASE WHEN v_nivel IN ('primario', 'secundario') THEN v_classe + 1 ELSE v_classe END,
      'ano_numero', CASE WHEN v_nivel = 'eja' THEN v_ano + 1 ELSE v_ano END,
      'modulo_numero', CASE WHEN v_nivel = 'eja' THEN v_modulo + 1 ELSE v_modulo END
    );
  END IF;

  RETURN jsonb_build_object(
    'decision', v_decision,
    'destino', v_destino,
    'motivo', v_motivo,
    'disciplina_ids_pendentes', coalesce((
      SELECT jsonb_agg(item->>'disciplina_id')
      FROM jsonb_array_elements(v_statuses) item
      WHERE item->>'status' <> 'aprovado'
    ), '[]'::jsonb),
    'disciplinas', v_statuses,
    'frequencia', jsonb_build_object('percentual_presenca', v_presenca, 'frequencia_min_percent', v_frequencia_min),
    'regime', v_regime,
    'etapa_destino', v_etapa_destino
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid) TO authenticated;

COMMIT;
