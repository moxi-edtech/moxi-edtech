BEGIN;

CREATE OR REPLACE FUNCTION public.aluno_belongs_to_escola(
  p_aluno_id uuid,
  p_escola_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = p_aluno_id
      AND a.escola_id = p_escola_id
  );
$$;

REVOKE ALL ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_belongs_to_escola(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS aluno_encarregados_tenant ON public.aluno_encarregados;

CREATE POLICY aluno_encarregados_tenant
ON public.aluno_encarregados
FOR ALL
TO public
USING (
  escola_id = public.current_tenant_escola_id()
  AND public.aluno_belongs_to_escola(aluno_id, escola_id)
)
WITH CHECK (
  escola_id = public.current_tenant_escola_id()
  AND public.aluno_belongs_to_escola(aluno_id, escola_id)
);

COMMIT;
