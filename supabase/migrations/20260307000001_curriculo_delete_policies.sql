BEGIN;

DROP POLICY IF EXISTS curso_matriz_delete ON public.curso_matriz;
CREATE POLICY curso_matriz_delete
  ON public.curso_matriz
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','admin'])
  );

DROP POLICY IF EXISTS turma_disciplinas_delete ON public.turma_disciplinas;
CREATE POLICY turma_disciplinas_delete
  ON public.turma_disciplinas
  FOR DELETE
  TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin_escola','admin'])
  );

COMMIT;
