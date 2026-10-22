-- Command Center: a single bounded roster aggregation in PostgreSQL replaces
-- repeated 500-row PostgREST scans. SECURITY INVOKER preserves actual RLS.
-- Apply only after the gated synthetic/full-schema authorisation tests.
CREATE INDEX IF NOT EXISTS ix_cc_class_roster_lookup
  ON public.matriculas (escola_id, session_id, turma_id, status, ativo, aluno_id);

CREATE OR REPLACE FUNCTION public.command_center_class_roster_summary(
  p_escola_id uuid,
  p_classe_id uuid,
  p_ano_letivo_id uuid,
  p_ano_letivo integer,
  p_historico boolean DEFAULT false,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access_to_escola_fast(p_escola_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_escola_id IS NULL OR p_classe_id IS NULL OR p_ano_letivo_id IS NULL
     OR p_ano_letivo IS NULL OR p_page IS NULL OR p_page < 1 OR p_page > 10000
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 20 THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;

  WITH roster AS (
    SELECT a.id AS aluno_id, m.id AS matricula_id,
           coalesce(nullif(a.nome_completo, ''), nullif(a.nome, ''), 'Aluno') AS nome,
           m.turma_id, t.nome AS turma_nome, m.numero_chamada,
           row_number() OVER (PARTITION BY a.id ORDER BY m.turma_id, m.id) AS aluno_rank
    FROM public.matriculas m
    JOIN public.alunos a ON a.id = m.aluno_id
      AND a.escola_id = p_escola_id AND a.deleted_at IS NULL
    JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = p_escola_id
    JOIN public.classes c ON c.id = p_classe_id AND c.escola_id = p_escola_id
    WHERE m.escola_id = p_escola_id AND m.session_id = p_ano_letivo_id
      AND m.ano_letivo = p_ano_letivo AND t.classe_id = p_classe_id
      AND (t.ano_letivo_id = p_ano_letivo_id OR
           (t.ano_letivo_id IS NULL AND t.ano_letivo = p_ano_letivo))
      AND (c.curso_id IS NULL OR t.curso_id = c.curso_id)
      AND (CASE WHEN p_historico
            THEN m.status IN ('ativo','concluido')
            ELSE m.status = 'ativo' AND m.ativo IS TRUE END)
  ),
  grouped AS (
    SELECT turma_id, count(DISTINCT aluno_id) AS quantidade
    FROM roster GROUP BY turma_id
  ),
  unique_students AS (
    SELECT aluno_id, nome, turma_id, turma_nome, numero_chamada
    FROM roster WHERE aluno_rank = 1
  ),
  student_page AS (
    SELECT aluno_id, nome, turma_id, turma_nome, numero_chamada
    FROM unique_students ORDER BY nome COLLATE "C", aluno_id
    OFFSET ((p_page - 1) * p_page_size) LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM unique_students),
    'counts', coalesce((SELECT jsonb_object_agg(turma_id, quantidade) FROM grouped), '{}'::jsonb),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', aluno_id, 'nome', nome, 'turmaId', turma_id,
      'turmaNome', turma_nome, 'numeroChamada', numero_chamada
    ) ORDER BY nome COLLATE "C", aluno_id) FROM student_page), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.command_center_class_roster_summary(
  uuid, uuid, uuid, integer, boolean, integer, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center_class_roster_summary(
  uuid, uuid, uuid, integer, boolean, integer, integer
) TO authenticated;
