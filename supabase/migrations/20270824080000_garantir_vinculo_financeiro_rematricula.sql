-- Garante, para uma única matrícula, o vínculo financeiro do ano lectivo.
-- É idempotente e não move turma/classe nem cria uma nova matrícula.
CREATE OR REPLACE FUNCTION public.garantir_vinculo_financeiro_rematricula(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_ano_letivo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public
AS $$
DECLARE
  v_matricula record;
  v_ano record;
  v_carnet jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  SELECT m.id, m.turma_id, m.session_id, m.ano_letivo, al.id AS ano_id, al.ano, al.data_inicio
    INTO v_matricula
  FROM public.matriculas m
  JOIN public.anos_letivos al ON al.id = p_ano_letivo_id AND al.escola_id = p_escola_id
  JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = p_escola_id
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.session_id = al.id
    AND m.ano_letivo = al.ano
    AND t.ano_letivo_id = al.id
  FOR UPDATE OF m;

  IF v_matricula.id IS NULL OR v_matricula.data_inicio IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'MATRICULA_TURMA_ANO_INVALIDOS');
  END IF;

  UPDATE public.matriculas
     SET data_inicio_financeiro = v_matricula.data_inicio,
         updated_at = now()
   WHERE id = v_matricula.id
     AND escola_id = p_escola_id
     AND data_inicio_financeiro IS DISTINCT FROM v_matricula.data_inicio;

  SELECT financeiro.gerar_carnet_anual(v_matricula.id) INTO v_carnet;
  IF coalesce((v_carnet->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', coalesce(v_carnet->>'erro', 'CARNET_NOT_GENERATED'));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', v_matricula.id,
    'inicio_financeiro', v_matricula.data_inicio,
    'mensalidades_geradas', coalesce((v_carnet->>'mensalidades')::integer, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.garantir_vinculo_financeiro_rematricula(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garantir_vinculo_financeiro_rematricula(uuid, uuid, uuid) TO authenticated;
