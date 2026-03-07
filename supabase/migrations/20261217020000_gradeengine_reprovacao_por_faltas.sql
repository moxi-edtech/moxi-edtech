BEGIN;

CREATE OR REPLACE FUNCTION public.gradeengine_calcular_situacao(
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_missing_count bigint := 0;
  v_has_reprovacao boolean := false;
  v_abaixo_minimo boolean := false;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  IF NOT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria', 'admin', 'admin_escola', 'staff_admin']) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT id, escola_id
    INTO v_matricula
  FROM public.matriculas
  WHERE id = p_matricula_id
    AND escola_id = v_escola_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula não encontrada.';
  END IF;

  -- 0. Regra legal de faltas: reprovação automática
  SELECT COALESCE(bool_or(fsp.abaixo_minimo), false)
    INTO v_abaixo_minimo
  FROM public.frequencia_status_periodo fsp
  WHERE fsp.escola_id = v_escola_id
    AND fsp.matricula_id = p_matricula_id;

  IF v_abaixo_minimo THEN
    RETURN jsonb_build_object(
      'situacao_final', 'reprovado_por_faltas',
      'motivos', jsonb_build_array('Frequência abaixo do mínimo legal.')
    );
  END IF;

  -- 1. Verificar disciplinas oficiais sem notas lançadas (ignorando isentos)
  SELECT COALESCE(SUM(missing_count), 0)
  INTO v_missing_count
  FROM public.vw_boletim_por_matricula
  WHERE matricula_id = p_matricula_id
    AND conta_para_media_med IS TRUE;

  IF v_missing_count > 0 THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Existem disciplinas oficiais sem notas lançadas ou pautas abertas.')
    );
  END IF;

  -- 2. Calcular aprovação sobre trimestres NÃO ISENTOS
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'situacao_final', 'incompleto',
      'motivos', jsonb_build_array('Não existem notas ou isenções para todos os trimestres.')
    );
  END IF;

  -- 3. Calcular reprovação
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT disciplina_id,
             AVG(nota_final) FILTER (WHERE nota_final IS NOT NULL) AS media_final
      FROM public.vw_boletim_por_matricula
      WHERE matricula_id = p_matricula_id
        AND conta_para_media_med IS TRUE
      GROUP BY disciplina_id
    ) s
    WHERE s.media_final < 10
  )
  INTO v_has_reprovacao;

  RETURN jsonb_build_object(
    'situacao_final', CASE WHEN v_has_reprovacao THEN 'reprovado' ELSE 'aprovado' END,
    'motivos', jsonb_build_array()
  );
END;
$$;

COMMIT;
