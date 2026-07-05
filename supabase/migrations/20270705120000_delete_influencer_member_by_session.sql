BEGIN;

CREATE OR REPLACE FUNCTION public.delete_influencer_member_by_session(
  p_session_id uuid,
  p_codigo text,
  p_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_owner record;
  v_member public.afiliado_membros%ROWTYPE;
BEGIN
  SELECT *
    INTO v_owner
  FROM public.require_influencer_owner_session(p_session_id, p_codigo)
  LIMIT 1;

  SELECT *
    INTO v_member
  FROM public.afiliado_membros
  WHERE id = p_member_id
    AND afiliado_id = v_owner.afiliado_id
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'cannot_delete_owner' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.afiliado_membros
  WHERE id = p_member_id
    AND afiliado_id = v_owner.afiliado_id;

  INSERT INTO public.audit_logs (
    portal,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    'influencer_portal',
    'AFILIADO_MEMBRO_REMOVIDO_PELO_PARCEIRO',
    'afiliado_membros',
    p_member_id::text,
    jsonb_build_object(
      'afiliado_id', v_owner.afiliado_id,
      'codigo', v_owner.codigo,
      'actor_member_id', v_owner.member_id,
      'actor_member_name', v_owner.member_name,
      'deleted_member_id', p_member_id,
      'deleted_member_name', v_member.nome,
      'deleted_member_role', v_member.role
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_influencer_member_by_session(uuid, text, uuid) TO anon, authenticated;

COMMIT;
