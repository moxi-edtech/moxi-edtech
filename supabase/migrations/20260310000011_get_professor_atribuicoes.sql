BEGIN;

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
  )
  SELECT
    tdp.turma_id,
    t.nome AS turma_nome,
    t.status_fecho AS turma_status_fecho,
    tdp.disciplina_id,
    dc.nome AS disciplina_nome,
    cm.id AS curso_matriz_id,
    td.id AS turma_disciplina_id
  FROM professor p
  JOIN public.turma_disciplinas_professores tdp
    ON tdp.escola_id = p.escola_id
   AND tdp.professor_id = p.professor_id
  JOIN public.turmas t
    ON t.id = tdp.turma_id
   AND t.escola_id = tdp.escola_id
  JOIN public.curso_matriz cm
    ON cm.escola_id = tdp.escola_id
   AND cm.curso_id = t.curso_id
   AND cm.classe_id = t.classe_id
   AND cm.disciplina_id = tdp.disciplina_id
   AND cm.ativo = true
  JOIN public.turma_disciplinas td
    ON td.escola_id = tdp.escola_id
   AND td.turma_id = tdp.turma_id
   AND td.curso_matriz_id = cm.id
  LEFT JOIN public.disciplinas_catalogo dc
    ON dc.id = tdp.disciplina_id
   AND dc.escola_id = tdp.escola_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_professor_atribuicoes() TO authenticated;

COMMIT;
