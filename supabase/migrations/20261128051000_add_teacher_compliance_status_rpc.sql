BEGIN;

CREATE OR REPLACE FUNCTION public.get_teacher_compliance_status(
  p_teacher_ids uuid[],
  p_trimestre_id uuid
)
RETURNS TABLE(teacher_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid;
BEGIN
  IF p_teacher_ids IS NULL OR array_length(p_teacher_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT escola_id INTO v_escola_id
  FROM public.periodos_letivos
  WHERE id = p_trimestre_id;

  IF v_escola_id IS NULL THEN
    RETURN QUERY
    SELECT unnest(p_teacher_ids) AS teacher_id, 'OK'::text AS status;
    RETURN;
  END IF;

  RETURN QUERY
  WITH teachers AS (
    SELECT unnest(p_teacher_ids) AS teacher_id
  ),
  assignments AS (
    SELECT td.professor_id AS teacher_id,
           td.id AS turma_disciplina_id,
           td.turma_id
    FROM public.turma_disciplinas td
    JOIN teachers t ON t.teacher_id = td.professor_id
    WHERE td.escola_id = v_escola_id
  ),
  matriculas AS (
    SELECT m.turma_id,
           COUNT(*)::int AS active_count
    FROM public.matriculas m
    WHERE m.escola_id = v_escola_id
      AND m.status IN ('ativo', 'ativa', 'active')
    GROUP BY m.turma_id
  ),
  avaliacoes AS (
    SELECT a.id,
           a.turma_disciplina_id
    FROM public.avaliacoes a
    WHERE a.escola_id = v_escola_id
      AND a.periodo_letivo_id = p_trimestre_id
      AND upper(a.tipo) = 'MAC'
  ),
  notas AS (
    SELECT n.avaliacao_id,
           COUNT(DISTINCT n.matricula_id)::int AS notas_count
    FROM public.notas n
    WHERE n.escola_id = v_escola_id
    GROUP BY n.avaliacao_id
  ),
  per_assignment AS (
    SELECT a.teacher_id,
           a.turma_disciplina_id,
           COALESCE(m.active_count, 0) AS active_count,
           av.id AS avaliacao_id,
           COALESCE(n.notas_count, 0) AS notas_count
    FROM assignments a
    LEFT JOIN matriculas m ON m.turma_id = a.turma_id
    LEFT JOIN avaliacoes av ON av.turma_disciplina_id = a.turma_disciplina_id
    LEFT JOIN notas n ON n.avaliacao_id = av.id
  ),
  status_by_teacher AS (
    SELECT teacher_id,
           MAX(
             CASE
               WHEN active_count = 0 THEN 0
               WHEN avaliacao_id IS NULL THEN 2
               WHEN notas_count < active_count THEN 2
               ELSE 0
             END
           ) AS status_code
    FROM per_assignment
    GROUP BY teacher_id
  )
  SELECT t.teacher_id,
         CASE
           WHEN s.status_code IS NULL OR s.status_code = 0 THEN 'OK'
           WHEN s.status_code = 1 THEN 'PENDING_MAC'
           ELSE 'CRITICAL'
         END AS status
  FROM teachers t
  LEFT JOIN status_by_teacher s ON s.teacher_id = t.teacher_id;
END;
$$;

ALTER FUNCTION public.get_teacher_compliance_status(uuid[], uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_teacher_compliance_status(uuid[], uuid) TO authenticated;

COMMIT;
