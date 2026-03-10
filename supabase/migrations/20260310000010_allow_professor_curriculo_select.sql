BEGIN;

CREATE POLICY "curso_matriz_select_membro" ON public.curso_matriz
  FOR SELECT TO authenticated
  USING (public.is_membro_escola(escola_id));

CREATE POLICY "turma_disciplinas_select_membro" ON public.turma_disciplinas
  FOR SELECT TO authenticated
  USING (public.is_membro_escola(escola_id));

COMMIT;
