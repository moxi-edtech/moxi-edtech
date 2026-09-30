BEGIN;

-- A promoção académica prepara a vaga, mas não conclui a matrícula.
-- A matrícula só passa a ativo quando o fluxo de rematrícula confirma
-- a taxa da classe destino (ou a isenção/gratuidade).
CREATE OR REPLACE FUNCTION public.preparar_aluno_para_rematricula(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid,
  p_turma_destino_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_source public.matriculas%ROWTYPE;
  v_source_turma public.turmas%ROWTYPE;
  v_target_turma public.turmas%ROWTYPE;
  v_target public.matriculas%ROWTYPE;
  v_existing_id uuid;
  v_balance numeric;
  v_to_year integer;
  v_source_number integer;
  v_target_number integer;
  v_occupancy integer;
  v_new_id uuid;
  v_raa jsonb;
  v_decision text;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissao negada';
  END IF;

  SELECT * INTO v_source
  FROM public.matriculas
  WHERE escola_id = p_escola_id
    AND aluno_id = p_aluno_id
    AND session_id = p_from_session_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matricula de origem nao encontrada';
  END IF;

  SELECT ano INTO v_to_year
  FROM public.anos_letivos
  WHERE id = p_to_session_id
    AND escola_id = p_escola_id
    AND ativo = true;
  IF v_to_year IS NULL THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino invalido';
  END IF;
  IF coalesce(v_source.ano_letivo, 0) >= v_to_year THEN
    RAISE EXCEPTION 'DATA: matricula de origem nao e de um ano anterior';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, v_source.id);
  v_decision := v_raa->>'decision';
  IF v_decision NOT IN ('transitou', 'inscricao_condicional') THEN
    RAISE EXCEPTION 'RAA_PROGRESSION_BLOCKED: decisao % nao autoriza promocao para a etapa seguinte', v_decision;
  END IF;

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = v_source.turma_id
    AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem nao encontrada';
  END IF;
  v_source_number := public.turma_classe_numero(v_source_turma.id);

  IF p_turma_destino_id IS NULL THEN
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year
      AND t.curso_id = v_source_turma.curso_id
      AND public.turma_classe_numero(t.id) = v_source_number + 1
      AND t.turno IS NOT DISTINCT FROM v_source_turma.turno
      AND t.letra IS NOT DISTINCT FROM v_source_turma.letra
    ORDER BY t.id
    LIMIT 1;
  ELSE
    SELECT t.* INTO v_target_turma
    FROM public.turmas t
    WHERE t.id = p_turma_destino_id
      AND t.escola_id = p_escola_id
      AND t.session_id = p_to_session_id
      AND t.ano_letivo = v_to_year;
  END IF;
  IF v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino nao encontrada no ano letivo';
  END IF;
  IF v_target_turma.curso_id IS DISTINCT FROM v_source_turma.curso_id THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro curso';
  END IF;
  v_target_number := public.turma_classe_numero(v_target_turma.id);
  IF v_target_number IS DISTINCT FROM v_source_number + 1 THEN
    RAISE EXCEPTION 'DATA: turma destino deve ser a classe imediatamente seguinte';
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0)
  ), 0)
  INTO v_balance
  FROM public.mensalidades me
  WHERE me.escola_id = p_escola_id
    AND me.aluno_id = p_aluno_id
    AND me.matricula_id = v_source.id
    AND lower(coalesce(me.status, '')) NOT IN ('pago', 'isento', 'cancelado');
  IF v_balance > 0 THEN
    RAISE EXCEPTION 'FINANCE: aluno ainda possui saldo devedor da matricula de origem de %', v_balance;
  END IF;

  SELECT m.* INTO v_target
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_to_session_id
    AND m.ano_letivo = v_to_year
  ORDER BY CASE WHEN lower(coalesce(m.status, '')) IN ('ativo','ativa','active') THEN 0 ELSE 1 END,
           m.created_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;
  IF v_target.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reused', true,
      'matricula_id', v_target.id,
      'turma_id', v_target.turma_id,
      'status', v_target.status,
      'reservada', lower(coalesce(v_target.status, '')) NOT IN ('ativo','ativa','active'),
      'raa', v_raa
    );
  END IF;

  SELECT count(*)::integer INTO v_occupancy
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = v_target_turma.id
    AND m.session_id = p_to_session_id
    AND (m.ativo = true OR lower(coalesce(m.status, '')) IN ('pendente', 'aprovado', 'aprovada'));
  IF v_target_turma.capacidade_maxima IS NOT NULL AND v_occupancy >= v_target_turma.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: turma de destino sem vagas';
  END IF;

  INSERT INTO public.matriculas (
    escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
    ativo, numero_matricula, data_matricula, data_inicio_financeiro,
    created_at, updated_at, origem_transicao_matricula_id
  ) VALUES (
    p_escola_id, p_aluno_id, v_target_turma.id, p_to_session_id, v_to_year, 'pendente',
    false, NULL, CURRENT_DATE, NULL, now(), now(), v_source.id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ALUNO_PROMOCAO_RESERVA_REMATRICULA', 'matriculas', v_new_id::text,
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'matricula_origem_id', v_source.id,
      'ano_letivo_destino_id', p_to_session_id,
      'turma_destino_id', v_target_turma.id,
      'raa_decision', v_decision,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'reservada', true,
    'status', 'pendente',
    'matricula_id', v_new_id,
    'turma_id', v_target_turma.id,
    'raa', v_raa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preparar_aluno_para_rematricula(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparar_aluno_para_rematricula(uuid, uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
