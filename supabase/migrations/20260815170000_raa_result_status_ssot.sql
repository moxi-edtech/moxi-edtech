BEGIN;

-- RAA SSOT: expõe escala, corte e cor regulamentar num único contrato.
-- Para classes de exame sem resultado final calculado, o contrato devolve
-- pendente_formula e nunca inventa positivo/negativo a partir da MT.
CREATE OR REPLACE FUNCTION public.resolve_estado_resultado(
  p_matricula_id uuid,
  p_disciplina_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
  v_turma_id uuid;
  v_regime jsonb;
  v_nota numeric;
  v_corte numeric;
  v_escala text;
BEGIN
  SELECT m.escola_id, m.turma_id
  INTO v_escola_id, v_turma_id
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.aluno_id IS NOT NULL;

  IF v_escola_id IS NULL OR v_turma_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'motivo', 'matricula_nao_encontrada'
    );
  END IF;

  v_regime := public.resolve_regime_academico(v_turma_id);
  v_escala := COALESCE(v_regime->>'escala', 'quantitativa_secundario');
  v_corte := CASE WHEN v_escala = 'quantitativa_primario' THEN 5 ELSE 10 END;

  SELECT MAX(v.nota_final)
  INTO v_nota
  FROM public.vw_boletim_por_matricula v
  WHERE v.escola_id = v_escola_id
    AND v.matricula_id = p_matricula_id
    AND v.disciplina_id = p_disciplina_id;

  IF v_nota IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'pendente_dados',
      'positivo', NULL,
      'cor', NULL,
      'nota', NULL,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'motivo', 'nota_nao_disponivel'
    );
  END IF;

  IF COALESCE((v_regime->>'eh_classe_exame')::boolean, false) THEN
    RETURN jsonb_build_object(
      'status', 'pendente_formula',
      'positivo', NULL,
      'cor', NULL,
      'nota', v_nota,
      'corte', v_corte,
      'escala', v_escala,
      'regime', v_regime,
      'motivo', 'classe_exame_aguarda_mfd'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_nota >= v_corte THEN 'aprovado' ELSE 'reprovado' END,
    'positivo', (v_nota >= v_corte),
    'cor', CASE WHEN v_nota >= v_corte THEN 'azul' ELSE 'vermelho' END,
    'nota', v_nota,
    'corte', v_corte,
    'escala', v_escala,
    'regime', v_regime,
    'motivo', 'nota_resolvida'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_estado_resultado(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_estado_resultado(uuid, uuid) TO authenticated;

COMMIT;
