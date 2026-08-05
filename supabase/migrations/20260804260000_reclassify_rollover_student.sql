BEGIN;

CREATE OR REPLACE FUNCTION public.reclassificar_aluno_virada(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_turma_destino_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := public.current_tenant_escola_id();
  v_matricula record;
  v_turma record;
  v_ocupacao integer;
BEGIN
  IF v_tenant_id IS NULL OR v_tenant_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  SELECT m.*
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.ativo = true
  FOR UPDATE;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'DATA: matrícula ativa do ano destino não encontrada';
  END IF;

  SELECT t.id, t.escola_id, t.session_id, t.ano_letivo, t.curso_id, t.classe_id,
         t.nome, t.capacidade_maxima
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id
    AND t.escola_id = p_escola_id;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: turma destino inválida';
  END IF;

  IF v_turma.session_id IS DISTINCT FROM v_matricula.session_id THEN
    RAISE EXCEPTION 'DATA: turma destino pertence a outro ano letivo';
  END IF;

  IF v_turma.id = v_matricula.turma_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reused', true,
      'matricula_id', v_matricula.id,
      'turma_id', v_turma.id,
      'numero_matricula', v_matricula.numero_matricula
    );
  END IF;

  SELECT count(*)::integer
    INTO v_ocupacao
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.turma_id = v_turma.id
    AND m.ativo = true
    AND m.id <> v_matricula.id;

  IF v_turma.capacidade_maxima IS NOT NULL
     AND v_ocupacao >= v_turma.capacidade_maxima THEN
    RAISE EXCEPTION 'DATA: turma destino sem vagas';
  END IF;

  UPDATE public.matriculas
  SET turma_id = v_turma.id,
      updated_at = now()
  WHERE id = v_matricula.id
    AND escola_id = p_escola_id;

  INSERT INTO public.audit_logs (
    escola_id, actor_id, action, entity, entity_id, details, portal
  ) VALUES (
    p_escola_id,
    auth.uid(),
    'ALUNO_RECLASSIFICADO_POS_VIRADA',
    'matriculas',
    v_matricula.id::text,
    jsonb_build_object(
      'aluno_id', v_matricula.aluno_id,
      'matricula_id', v_matricula.id,
      'turma_origem', v_matricula.turma_id,
      'turma_destino', v_turma.id,
      'session_id', v_matricula.session_id,
      'motivo', nullif(trim(p_motivo), ''),
      'numero_matricula', v_matricula.numero_matricula,
      'at', now()
    ),
    'admin'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'matricula_id', v_matricula.id,
    'turma_id', v_turma.id,
    'numero_matricula', v_matricula.numero_matricula
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reclassificar_aluno_virada(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reclassificar_aluno_virada(uuid, uuid, uuid, text) TO authenticated;

COMMIT;
