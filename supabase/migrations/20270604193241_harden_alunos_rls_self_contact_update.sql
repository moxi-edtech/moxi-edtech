BEGIN;

DROP POLICY IF EXISTS "tenant_all_access" ON public.alunos;
DROP POLICY IF EXISTS alunos_select_tenant ON public.alunos;
DROP POLICY IF EXISTS alunos_insert_staff ON public.alunos;
DROP POLICY IF EXISTS alunos_update_staff ON public.alunos;
DROP POLICY IF EXISTS alunos_delete_staff ON public.alunos;

CREATE POLICY alunos_select_tenant
  ON public.alunos
  FOR SELECT
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    OR public.is_super_admin()
  );

CREATE POLICY alunos_insert_staff
  ON public.alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff_escola(escola_id)
    OR public.is_super_admin()
  );

CREATE POLICY alunos_update_staff
  ON public.alunos
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff_escola(escola_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_staff_escola(escola_id)
    OR public.is_super_admin()
  );

CREATE POLICY alunos_delete_staff
  ON public.alunos
  FOR DELETE
  TO authenticated
  USING (
    public.is_staff_escola(escola_id)
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION public.aluno_atualizar_contatos_proprios(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_endereco text DEFAULT NULL
)
RETURNS TABLE (
  email text,
  telefone text,
  endereco text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.safe_auth_uid();
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_telefone text := nullif(trim(coalesce(p_telefone, '')), '');
  v_endereco text := nullif(trim(coalesce(p_endereco, '')), '');
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH: não autenticado';
  END IF;

  IF p_escola_id IS NULL OR p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola inválida';
  END IF;

  IF v_email IS NOT NULL AND (
    length(v_email) > 254
    OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ) THEN
    RAISE EXCEPTION 'VALIDATION: email inválido';
  END IF;

  IF v_telefone IS NOT NULL AND length(v_telefone) > 32 THEN
    RAISE EXCEPTION 'VALIDATION: telefone excede 32 caracteres';
  END IF;

  IF v_endereco IS NOT NULL AND length(v_endereco) > 500 THEN
    RAISE EXCEPTION 'VALIDATION: endereço excede 500 caracteres';
  END IF;

  SELECT jsonb_build_object(
    'email', a.email,
    'telefone', a.telefone,
    'endereco', a.endereco
  )
  INTO v_before
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND a.escola_id = p_escola_id
    AND (a.profile_id = v_uid OR a.usuario_auth_id = v_uid)
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'AUTH: aluno não autorizado';
  END IF;

  UPDATE public.alunos a
  SET
    email = v_email,
    telefone = v_telefone,
    endereco = v_endereco,
    updated_at = now()
  WHERE a.id = p_aluno_id
    AND a.escola_id = p_escola_id
  RETURNING
    a.email,
    a.telefone,
    a.endereco,
    jsonb_build_object(
      'email', a.email,
      'telefone', a.telefone,
      'endereco', a.endereco
    )
  INTO email, telefone, endereco, v_after;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    action,
    entity,
    entity_id,
    portal,
    before,
    after,
    details
  )
  VALUES (
    p_escola_id,
    v_uid,
    'ALUNO_CONTATOS_ATUALIZADOS',
    'alunos',
    p_aluno_id::text,
    'aluno',
    v_before,
    v_after,
    jsonb_build_object('source', 'portal_aluno_perfil')
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.aluno_atualizar_contatos_proprios(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_atualizar_contatos_proprios(uuid, uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.aluno_atualizar_contatos_proprios(uuid, uuid, text, text, text) TO authenticated;

COMMIT;
