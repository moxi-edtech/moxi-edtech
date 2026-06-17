BEGIN;

CREATE OR REPLACE FUNCTION public.portal_user_can_access_aluno(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = p_aluno_id
      AND (
        a.profile_id = auth.uid()
        OR a.usuario_auth_id = auth.uid()
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.aluno_encarregados ae
    JOIN public.encarregados e ON e.id = ae.encarregado_id
    WHERE ae.aluno_id = p_aluno_id
      AND lower(e.email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.portal_user_can_access_aluno(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_user_can_access_aluno(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_user_can_access_aluno(uuid) TO service_role;

DROP POLICY IF EXISTS "Alunos podem ver seus próprios pedidos de serviço" ON public.servico_pedidos;
DROP POLICY IF EXISTS "Encarregados podem ver pedidos de serviço dos seus educandos" ON public.servico_pedidos;
DROP POLICY IF EXISTS servico_pedidos_portal_access ON public.servico_pedidos;

CREATE POLICY servico_pedidos_portal_access
ON public.servico_pedidos
FOR SELECT
TO authenticated
USING (
  public.portal_user_can_access_aluno(aluno_id)
);

COMMIT;
