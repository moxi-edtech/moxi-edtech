BEGIN;

CREATE OR REPLACE FUNCTION public.turma_set_status_fecho(
  p_escola_id uuid,
  p_turma_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_status text := upper(trim(p_status));
  v_has_permission boolean;
  v_turma record;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola', 'secretaria'])
  INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF v_status NOT IN ('ABERTO', 'FECHADO') THEN
    RAISE EXCEPTION 'DATA: status_fecho inválido.';
  END IF;

  UPDATE public.turmas
  SET status_fecho = v_status,
      updated_at = now()
  WHERE id = p_turma_id
    AND escola_id = v_escola_id
  RETURNING id, status_fecho, nome INTO v_turma;

  IF v_turma.id IS NULL THEN
    RAISE EXCEPTION 'DATA: Turma não encontrada.';
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    v_actor_id,
    'TURMA_FECHO_STATUS',
    'turmas',
    v_turma.id::text,
    'admin',
    jsonb_build_object(
      'turma_id', v_turma.id,
      'turma_nome', v_turma.nome,
      'status_fecho', v_turma.status_fecho,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('ok', true, 'turma_id', v_turma.id, 'status_fecho', v_turma.status_fecho);
END;
$$;

GRANT EXECUTE ON FUNCTION public.turma_set_status_fecho(uuid, uuid, text, text) TO authenticated;

COMMIT;
