BEGIN;

CREATE OR REPLACE FUNCTION public.promover_aluno_pos_pagamento(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_source public.matriculas%ROWTYPE;
  v_target_turma_id uuid;
  v_existing_id uuid;
  v_balance numeric;
  v_to_year integer;
  v_new_id uuid;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','diretor']
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

  SELECT ano INTO v_to_year FROM public.anos_letivos
  WHERE id = p_to_session_id AND escola_id = p_escola_id;
  IF v_to_year IS NULL THEN
    RAISE EXCEPTION 'DATA: ano letivo de destino invalido';
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN lower(coalesce(fl.tipo, '')) IN ('debito','débito') THEN COALESCE(fl.valor, 0)
         ELSE -COALESCE(fl.valor, 0) END
  ), 0)
  INTO v_balance
  FROM public.financeiro_ledger fl
  WHERE fl.escola_id = p_escola_id AND fl.aluno_id = p_aluno_id;

  IF v_balance > 0 THEN
    RAISE EXCEPTION 'FINANCE: aluno ainda possui saldo devedor de %', v_balance;
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

  SELECT next_turma.id INTO v_target_turma_id
  FROM public.turmas source_turma
  JOIN public.turmas next_turma
    ON next_turma.escola_id = p_escola_id
   AND next_turma.session_id = p_to_session_id
   AND next_turma.curso_id = source_turma.curso_id
   AND next_turma.classe_num = source_turma.classe_num + 1
   AND next_turma.turno IS NOT DISTINCT FROM source_turma.turno
   AND next_turma.letra IS NOT DISTINCT FROM source_turma.letra
  WHERE source_turma.id = v_source.turma_id
    AND source_turma.escola_id = p_escola_id
  LIMIT 1;
  IF v_target_turma_id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma de destino nao encontrada';
  END IF;

  INSERT INTO public.matriculas (
    escola_id, aluno_id, turma_id, session_id, ano_letivo, status,
    ativo, numero_matricula, data_matricula, created_at, updated_at
  ) VALUES (
    p_escola_id, p_aluno_id, v_target_turma_id, p_to_session_id, v_to_year, 'ativo',
    true,
    public.next_matricula_number(p_escola_id)::text,
    CURRENT_DATE, now(), now()
  ) RETURNING id INTO v_new_id;

  UPDATE public.matriculas
  SET status = 'transferido', ativo = false, updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'ALUNO_PROMOVIDO_POS_PAGAMENTO', 'matriculas', v_new_id::text,
    jsonb_build_object('aluno_id', p_aluno_id, 'from_session_id', p_from_session_id, 'to_session_id', p_to_session_id, 'saldo', v_balance, 'at', now()),
    'admin'
  );

  RETURN jsonb_build_object('ok', true, 'reused', false, 'matricula_id', v_new_id, 'turma_id', v_target_turma_id, 'saldo', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.promover_aluno_pos_pagamento(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promover_aluno_pos_pagamento(uuid, uuid, uuid, uuid) TO authenticated;

COMMIT;
