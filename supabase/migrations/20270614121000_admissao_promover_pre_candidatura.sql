BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_promover_pre_candidatura(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_turma_id uuid,
  p_observacao text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_existing_result jsonb;
  v_cand record;
  v_turma record;
  v_result jsonb;
  v_dados jsonb;
BEGIN
  IF p_escola_id IS NULL OR p_escola_id <> v_tenant_escola_id THEN
    RAISE EXCEPTION 'Acesso negado: escola inválida';
  END IF;

  IF p_candidatura_id IS NULL THEN
    RAISE EXCEPTION 'p_candidatura_id é obrigatório';
  END IF;

  IF p_turma_id IS NULL THEN
    RAISE EXCEPTION 'p_turma_id é obrigatório';
  END IF;

  IF nullif(p_idempotency_key, '') IS NULL THEN
    RAISE EXCEPTION 'p_idempotency_key é obrigatório';
  END IF;

  SELECT ik.result
  INTO v_existing_result
  FROM public.idempotency_keys ik
  WHERE ik.escola_id = p_escola_id
    AND ik.scope = 'admissao_promover_pre_candidatura'
    AND ik.key = p_idempotency_key;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  SELECT
    c.id,
    c.escola_id,
    c.status,
    c.dados_candidato,
    c.curso_id,
    c.classe_id,
    c.ano_letivo,
    c.turno,
    c.turma_preferencial_id
  INTO v_cand
  FROM public.candidaturas c
  WHERE c.id = p_candidatura_id
    AND c.escola_id = p_escola_id
  FOR UPDATE;

  IF v_cand.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada';
  END IF;

  IF v_cand.status <> 'pre_candidatura' THEN
    RAISE EXCEPTION 'Transição inválida: status atual = %', v_cand.status;
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.curso_id,
    t.classe_id,
    t.ano_letivo,
    t.turno,
    t.nome,
    t.turma_codigo
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id
  FOR UPDATE;

  IF v_turma.id IS NULL OR v_turma.escola_id <> p_escola_id THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  IF v_turma.curso_id IS NULL THEN
    RAISE EXCEPTION 'Turma sem curso_id';
  END IF;

  IF v_turma.ano_letivo IS NULL THEN
    RAISE EXCEPTION 'Turma sem ano_letivo';
  END IF;

  v_dados :=
    coalesce(v_cand.dados_candidato, '{}'::jsonb)
    || jsonb_build_object(
      'promovida_de_pre_candidatura', true,
      'promocao_pre_candidatura', jsonb_build_object(
        'promovida_em', now(),
        'turma_id', v_turma.id,
        'curso_id', v_turma.curso_id,
        'classe_id', v_turma.classe_id,
        'ano_letivo', v_turma.ano_letivo,
        'turno', v_turma.turno,
        'observacao', nullif(p_observacao, '')
      )
    );

  UPDATE public.candidaturas c
  SET
    status = 'submetida',
    curso_id = v_turma.curso_id,
    classe_id = v_turma.classe_id,
    ano_letivo = v_turma.ano_letivo,
    turno = v_turma.turno,
    turma_preferencial_id = v_turma.id,
    dados_candidato = v_dados,
    updated_at = now()
  WHERE c.id = p_candidatura_id
    AND c.escola_id = p_escola_id;

  INSERT INTO public.candidaturas_status_log (
    escola_id,
    candidatura_id,
    from_status,
    to_status,
    actor_user_id,
    motivo,
    metadata
  )
  VALUES (
    p_escola_id,
    p_candidatura_id,
    'pre_candidatura',
    'submetida',
    p_actor_user_id,
    coalesce(nullif(p_observacao, ''), 'Pré-candidatura promovida para candidatura oficial'),
    jsonb_build_object(
      'source', 'admissao_promover_pre_candidatura',
      'turma_id', v_turma.id,
      'curso_id', v_turma.curso_id,
      'classe_id', v_turma.classe_id,
      'ano_letivo', v_turma.ano_letivo,
      'turno', v_turma.turno
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'candidatura_id', p_candidatura_id,
    'status', 'submetida',
    'turma_id', v_turma.id,
    'curso_id', v_turma.curso_id,
    'classe_id', v_turma.classe_id,
    'ano_letivo', v_turma.ano_letivo,
    'turno', v_turma.turno
  );

  INSERT INTO public.idempotency_keys (escola_id, scope, key, result)
  VALUES (p_escola_id, 'admissao_promover_pre_candidatura', p_idempotency_key, v_result)
  ON CONFLICT (escola_id, scope, key)
  DO UPDATE SET result = excluded.result
  RETURNING result INTO v_result;

  RETURN v_result;
END;
$function$;

COMMIT;
