BEGIN;

-- Permite à secretaria escolher qualquer turma disponível da classe seguinte
-- no novo ano, mantendo a seleção automática para chamadas antigas.
CREATE OR REPLACE FUNCTION public.promover_aluno_pos_pagamento(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid,
  p_turma_destino_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_source public.matriculas%ROWTYPE;
  v_source_turma public.turmas%ROWTYPE;
  v_target_turma public.turmas%ROWTYPE;
  v_existing_id uuid;
  v_balance numeric;
  v_to_year integer;
  v_occupancy integer;
  v_new_id uuid;
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
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matricula de origem nao encontrada';
  END IF;

  SELECT * INTO v_source_turma
  FROM public.turmas
  WHERE id = v_source.turma_id AND escola_id = p_escola_id;
  IF v_source_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de origem nao encontrada';
  END IF;

  SELECT ano INTO v_to_year
  FROM public.anos_letivos
  WHERE id = p_to_session_id AND escola_id = p_escola_id;
  IF v_to_year IS NULL THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino invalido';
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN me.status IN ('pago', 'isento', 'cancelado') THEN 0
      ELSE GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0)
    END
  ), 0)
  INTO v_balance
  FROM public.mensalidades me
  WHERE me.escola_id = p_escola_id
    AND me.aluno_id = p_aluno_id
    AND me.matricula_id = v_source.id;
  IF v_balance > 0 THEN
    RAISE EXCEPTION 'FINANCE: aluno ainda possui saldo devedor da matricula de origem de %', v_balance;
  END IF;

  SELECT m.id INTO v_existing_id
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.session_id = p_to_session_id
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'matricula_id', v_existing_id, 'saldo', v_balance);
  END IF;

  SELECT * INTO v_target_turma
  FROM public.turmas
  WHERE id = p_turma_destino_id
    AND escola_id = p_escola_id
    AND session_id = p_to_session_id
    AND ano_letivo_id = p_to_session_id
    AND curso_id = v_source_turma.curso_id
    AND public.turma_classe_numero(id) = public.turma_classe_numero(v_source_turma.id) + 1;
  IF v_target_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino deve pertencer à classe seguinte e ao novo ano';
  END IF;

  SELECT COUNT(*)::integer INTO v_occupancy
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = v_target_turma.id
    AND m.session_id = p_to_session_id
    AND m.ativo = true;
  IF COALESCE(v_target_turma.capacidade_maxima, 0) > 0
     AND v_occupancy >= v_target_turma.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: turma de destino sem vagas';
  END IF;

  INSERT INTO public.matriculas (
    escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
    ativo, numero_matricula, data_matricula, created_at, updated_at
  ) VALUES (
    p_escola_id, p_aluno_id, v_target_turma.id, p_to_session_id, v_to_year, 'ativo',
    true, public.next_matricula_number(p_escola_id)::text, CURRENT_DATE, now(), now()
  ) RETURNING id INTO v_new_id;

  UPDATE public.matriculas
  SET status = 'transferido', ativo = false, updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ALUNO_PROMOVIDO_POS_PAGAMENTO', 'matriculas', v_new_id::text,
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'from_session_id', p_from_session_id,
      'to_session_id', p_to_session_id,
      'matricula_origem_id', v_source.id,
      'turma_destino_id', v_target_turma.id,
      'saldo_matricula_origem', v_balance,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object('ok', true, 'reused', false, 'matricula_id', v_new_id, 'turma_id', v_target_turma.id, 'saldo', v_balance);
END;
$function$;

REVOKE ALL ON FUNCTION public.promover_aluno_pos_pagamento(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promover_aluno_pos_pagamento(uuid, uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
