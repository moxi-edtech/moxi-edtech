BEGIN;

-- A publicação de currículos pode deixar mais de uma turma_disciplina para
-- a mesma disciplina. A atribuição docente deve expor apenas um vínculo
-- determinístico, já que a tabela de atribuição docente não guarda o
-- turma_disciplina_id legado.
CREATE OR REPLACE FUNCTION public.get_professor_atribuicoes()
RETURNS TABLE (
  turma_id uuid,
  turma_nome text,
  turma_status_fecho text,
  disciplina_id uuid,
  disciplina_nome text,
  curso_matriz_id uuid,
  turma_disciplina_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH professor AS (
    SELECT p.id AS professor_id, p.escola_id
    FROM public.professores p
    WHERE p.profile_id = auth.uid()
      AND p.escola_id = public.current_tenant_escola_id()
    LIMIT 1
  ),
  assignments AS (
    SELECT DISTINCT ON (tdp.turma_id, tdp.disciplina_id)
      tdp.turma_id,
      tdp.disciplina_id,
      tdp.professor_id,
      p.escola_id,
      tdp.turma_id AS assignment_turma_id
    FROM professor p
    JOIN public.turma_disciplinas_professores tdp
      ON tdp.escola_id = p.escola_id
     AND tdp.professor_id = p.professor_id
    ORDER BY tdp.turma_id, tdp.disciplina_id, tdp.id
  )
  SELECT DISTINCT ON (a.turma_id, a.disciplina_id)
    a.turma_id,
    t.nome AS turma_nome,
    t.status_fecho AS turma_status_fecho,
    a.disciplina_id,
    dc.nome AS disciplina_nome,
    cm.id AS curso_matriz_id,
    td.id AS turma_disciplina_id
  FROM assignments a
  JOIN public.turmas t
    ON t.id = a.turma_id
   AND t.escola_id = a.escola_id
  JOIN public.curso_matriz cm
    ON cm.escola_id = a.escola_id
   AND cm.curso_id = t.curso_id
   AND cm.classe_id = t.classe_id
   AND cm.disciplina_id = a.disciplina_id
   AND cm.ativo = true
  JOIN public.turma_disciplinas td
    ON td.escola_id = a.escola_id
   AND td.turma_id = a.turma_id
   AND td.curso_matriz_id = cm.id
  LEFT JOIN public.disciplinas_catalogo dc
    ON dc.id = a.disciplina_id
   AND dc.escola_id = a.escola_id
  ORDER BY a.turma_id, a.disciplina_id, td.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_professor_atribuicoes() TO authenticated;

COMMIT;
