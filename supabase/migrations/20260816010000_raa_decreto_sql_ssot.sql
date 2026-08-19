BEGIN;

-- RAA Sprint 2: SSOT jurídico transacional.
-- A função genérica anterior é preservada como fallback nomeado. O wrapper
-- jurídico só decide quando dispõe de todas as notas finais necessárias.
ALTER FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid)
  RENAME TO resolve_raa_progression_for_matricula_generic;

CREATE OR REPLACE FUNCTION public.resolve_raa_decreto_for_matricula(
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
  v_nivel text;
  v_classe integer;
  v_ano integer;
  v_modulo integer;
  v_regime_codigo text;
  v_statuses jsonb := '[]'::jsonb;
  v_ids_negativos jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_negativas integer := 0;
  v_notas_completas boolean := true;
  v_lp boolean := false;
  v_math boolean := false;
  v_especificas integer := 0;
  v_proibida boolean := false;
  v_decision text;
  v_destino text;
  v_motivo text;
  v_base_legal text;
  v_bloqueada boolean := false;
  v_terminal boolean := false;
  v_disciplina record;
  v_result jsonb;
  v_nota numeric;
  v_nome text;
  v_nome_norm text;
  v_classificacao text;
  v_area text;
BEGIN
  SELECT m.id, m.turma_id, m.escola_id
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id IS NOT NULL;

  IF v_matricula.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_regime := public.resolve_regime_academico(v_matricula.turma_id);
  v_nivel := v_regime->>'nivel_ensino';
  v_classe := NULLIF(v_regime->>'classe_num', '')::integer;
  v_ano := NULLIF(v_regime->>'ano_numero', '')::integer;
  v_modulo := NULLIF(v_regime->>'modulo_numero', '')::integer;

  IF v_nivel = 'eja' THEN
    v_regime_codigo := CASE
      WHEN v_modulo = 1 THEN 'eja_modulo_1'
      WHEN v_modulo = 2 THEN 'eja_modulo_2'
      WHEN v_modulo = 3 THEN 'eja_modulo_3'
      WHEN v_ano = 1 THEN 'eja_ano_1'
      WHEN v_ano = 2 THEN 'eja_ano_2'
    END;
  ELSIF v_classe BETWEEN 6 AND 12 THEN
    v_regime_codigo := 'classe_' || v_classe;
  END IF;

  IF v_regime_codigo IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_disciplina IN
    SELECT DISTINCT
      td.avaliacao_disciplina_id AS disciplina_id,
      COALESCE(dc.nome, '') AS nome,
      COALESCE(td.classificacao, cm.classificacao, '') AS classificacao,
      COALESCE(dc.area, '') AS area
    FROM public.turma_disciplinas td
    LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
      AND cm.escola_id = p_escola_id
    LEFT JOIN public.disciplinas_catalogo dc ON dc.id = td.avaliacao_disciplina_id
      AND dc.escola_id = p_escola_id
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = v_matricula.turma_id
      AND td.avaliacao_disciplina_id IS NOT NULL
  LOOP
    v_total := v_total + 1;
    v_result := public.resolve_estado_resultado(p_matricula_id, v_disciplina.disciplina_id);
    v_nota := NULLIF(v_result->>'nota', '')::numeric;
    v_nome := v_disciplina.nome;
    v_nome_norm := lower(public.immutable_unaccent(v_nome));
    v_classificacao := lower(v_disciplina.classificacao);
    v_area := lower(v_disciplina.area);

    IF v_nota IS NULL THEN
      v_notas_completas := false;
    ELSE
      IF v_regime_codigo NOT IN ('eja_modulo_1', 'eja_modulo_2', 'eja_modulo_3') AND v_nota < 10 THEN
        v_negativas := v_negativas + 1;
        v_ids_negativos := v_ids_negativos || jsonb_build_array(v_disciplina.disciplina_id);
        IF v_nota < 3 AND v_regime_codigo IN ('classe_6', 'eja_modulo_3') THEN
          v_proibida := true;
        END IF;
        IF v_nota < 6 AND v_regime_codigo IN ('classe_9', 'classe_12', 'eja_ano_2') THEN
          v_proibida := true;
        END IF;
        v_lp := v_lp OR v_nome_norm LIKE '%lingua portuguesa%' OR v_nome_norm = 'portugues';
        v_math := v_math OR v_nome_norm LIKE '%matemat%';
        v_especificas := v_especificas + CASE WHEN v_classificacao = 'especifica' OR v_area LIKE '%especific%' THEN 1 ELSE 0 END;
      END IF;
    END IF;

    v_statuses := v_statuses || jsonb_build_array(jsonb_build_object(
      'disciplina_id', v_disciplina.disciplina_id,
      'status', COALESCE(v_result->>'status', 'pendente_dados'),
      'nota_final', v_nota
    ));
  END LOOP;

  IF v_total = 0 OR NOT v_notas_completas THEN
    RETURN NULL;
  END IF;

  v_terminal := v_regime_codigo IN ('classe_6', 'classe_9', 'classe_12', 'eja_modulo_3', 'eja_ano_2');

  IF v_regime_codigo IN ('classe_7', 'classe_8', 'eja_ano_1') THEN
    v_proibida := v_proibida OR (v_lp AND v_math) OR v_negativas > 2;
    IF v_negativas = 0 THEN
      v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias'; v_base_legal := 'Arts. 23.º/1 e 26.º/4.';
    ELSIF NOT v_proibida THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Arts. 23.º/2-5 e 26.º/5-7.';
      v_bloqueada := v_regime_codigo IN ('classe_8', 'eja_ano_1');
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Arts. 23.º/2 e 26.º/5.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo IN ('classe_10', 'classe_11') THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_especificas >= 2);
    IF v_negativas = 0 THEN
      v_decision := 'transitou'; v_destino := 'proxima_etapa'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/9.';
    ELSIF NOT v_proibida THEN
      v_decision := 'inscricao_condicional'; v_destino := 'proxima_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 23.º/9-13.';
      v_bloqueada := v_regime_codigo = 'classe_11';
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 23.º/10.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'classe_6' THEN
    v_proibida := v_proibida OR v_negativas <> 2 OR (v_lp AND v_math);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/6.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/1-5.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/5.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'eja_modulo_3' THEN
    v_proibida := v_proibida OR v_negativas <> 1;
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 26.º/1.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/6.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/6.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo IN ('classe_9', 'eja_ano_2') THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_math);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Arts. 23.º/14 e 26.º/8.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/7.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/7.'; v_bloqueada := true;
    END IF;
  ELSIF v_regime_codigo = 'classe_12' THEN
    v_proibida := v_proibida OR v_negativas > 3 OR (v_lp AND v_math AND v_especificas >= 1) OR (v_lp AND v_especificas >= 2) OR (v_math AND v_especificas >= 2);
    IF v_negativas = 0 THEN
      v_decision := 'concluiu'; v_destino := 'conclusao'; v_motivo := 'sem_pendencias'; v_base_legal := 'Art. 23.º/14.';
    ELSIF NOT v_proibida THEN
      v_decision := 'recurso'; v_destino := 'mesma_etapa'; v_motivo := 'negativas_faixa_legal'; v_base_legal := 'Art. 33.º/8.'; v_bloqueada := true;
    ELSE
      v_decision := 'retido'; v_destino := 'mesma_etapa'; v_motivo := 'combinacao_proibida'; v_base_legal := 'Art. 33.º/8/a-c.'; v_bloqueada := true;
    END IF;
  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'decision', v_decision,
    'destino', v_destino,
    'motivo', v_motivo,
    'base_legal', v_base_legal,
    'efetivacao_matricula_bloqueada', v_bloqueada,
    'disciplina_ids_pendentes', v_ids_negativos,
    'disciplinas', v_statuses,
    'regime', v_regime,
    'etapa_destino', CASE WHEN v_destino = 'proxima_etapa' THEN jsonb_build_object('nivel_ensino', v_nivel, 'classe_num', CASE WHEN v_classe IS NOT NULL THEN v_classe + 1 ELSE v_classe END, 'ano_numero', CASE WHEN v_ano IS NOT NULL THEN v_ano + 1 ELSE v_ano END, 'modulo_numero', CASE WHEN v_modulo IS NOT NULL THEN v_modulo + 1 ELSE v_modulo END) ELSE v_regime END
  );
END;
$$;

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
  v_legal jsonb;
BEGIN
  v_legal := public.resolve_raa_decreto_for_matricula(p_escola_id, p_matricula_id);
  IF v_legal IS NOT NULL THEN
    RETURN v_legal;
  END IF;
  RETURN public.resolve_raa_progression_for_matricula_generic(p_escola_id, p_matricula_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_raa_decreto_for_matricula(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_raa_decreto_for_matricula(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid) TO authenticated;

COMMIT;
