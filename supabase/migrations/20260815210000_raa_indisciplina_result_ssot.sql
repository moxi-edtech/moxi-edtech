-- RAA Sprint 4 — indisciplina no resultado canónico.
-- Pendente de aprovação humana: alteração de contrato SQL.

BEGIN;

-- Mantém o contrato público e permite acrescentar a regra disciplinar num wrapper
-- sem duplicar a implementação já validada da MFD de exame.
ALTER FUNCTION public.resolve_estado_resultado(uuid, uuid)
  RENAME TO resolve_estado_resultado_academico_base;

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
  v_base jsonb;
  v_escola_id uuid;
  v_ano_letivo_id uuid;
  v_indisciplina_count integer := 0;
BEGIN
  v_base := public.resolve_estado_resultado_academico_base(p_matricula_id, p_disciplina_id);

  SELECT m.escola_id, al.id
  INTO v_escola_id, v_ano_letivo_id
  FROM public.matriculas m
  LEFT JOIN public.anos_letivos al
    ON al.escola_id = m.escola_id
   AND al.ano = m.ano_letivo
  WHERE m.id = p_matricula_id;

  IF v_escola_id IS NULL OR v_ano_letivo_id IS NULL THEN
    RETURN v_base;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_indisciplina_count
  FROM public.raa_indisciplina_eventos e
  WHERE e.escola_id = v_escola_id
    AND e.ano_letivo_id = v_ano_letivo_id
    AND e.matricula_id = p_matricula_id
    AND e.estado IN ('registado', 'em_analise')
    AND e.impacta_resultado = true;

  IF v_indisciplina_count > 0
     AND v_base->>'status' IN ('aprovado', 'reprovado') THEN
    RETURN v_base || jsonb_build_object(
      'status', 'reprovado_por_indisciplina',
      'positivo', false,
      'cor', 'vermelho',
      'motivo', 'indisciplina_grave',
      'indisciplina_eventos_ativos', v_indisciplina_count
    );
  END IF;

  RETURN v_base || jsonb_build_object('indisciplina_eventos_ativos', v_indisciplina_count);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_estado_resultado(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_estado_resultado(uuid, uuid) TO authenticated;

COMMIT;
