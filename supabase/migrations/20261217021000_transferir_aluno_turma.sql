BEGIN;

CREATE OR REPLACE FUNCTION public.transferir_aluno_turma(
  p_matricula_origem_id uuid,
  p_turma_destino_id uuid,
  p_motivo text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_origem record;
  v_dest record;
  v_has_permission boolean := false;
  v_new_matricula_id uuid;
BEGIN
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['secretaria','admin','admin_escola','staff_admin'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  SELECT *
    INTO v_origem
  FROM public.matriculas
  WHERE id = p_matricula_origem_id
    AND escola_id = v_escola_id
    AND public.canonicalize_matricula_status_text(status) = 'ativo'
  FOR UPDATE;

  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Matrícula de origem não encontrada ou não está ativa.';
  END IF;

  SELECT id, escola_id, ano_letivo_id, ano_letivo, session_id
    INTO v_dest
  FROM public.turmas
  WHERE id = p_turma_destino_id
    AND escola_id = v_escola_id;

  IF v_dest.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma destino inválida.';
  END IF;

  UPDATE public.matriculas
  SET status = 'transferido_interno',
      data_fecho = now(),
      motivo_fecho = NULLIF(trim(p_motivo), ''),
      status_fecho_origem = 'transferencia_interna',
      updated_at = now()
  WHERE id = v_origem.id
    AND escola_id = v_escola_id;

  INSERT INTO public.matriculas (
    escola_id,
    aluno_id,
    turma_id,
    session_id,
    status,
    ativo,
    ano_letivo,
    ano_letivo_id,
    data_matricula,
    data_inicio_financeiro,
    created_at
  )
  VALUES (
    v_origem.escola_id,
    v_origem.aluno_id,
    p_turma_destino_id,
    v_dest.session_id,
    'ativo',
    true,
    COALESCE(v_origem.ano_letivo, v_dest.ano_letivo),
    COALESCE(v_origem.ano_letivo_id, v_dest.ano_letivo_id),
    COALESCE(v_origem.data_matricula, CURRENT_DATE),
    v_origem.data_inicio_financeiro,
    now()
  )
  RETURNING id INTO v_new_matricula_id;

  RETURN v_new_matricula_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_aluno_turma(uuid, uuid, text) TO authenticated;

COMMIT;
