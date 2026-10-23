-- EX-005 forward migration: preserve classes reused across academic years.
-- The original command_center_course_overview migration sorts earlier in this repo.
-- Read-only RPC, same invoker security and permissions; does not migrate data.
BEGIN;
CREATE OR REPLACE FUNCTION public.command_center_course_overview(
  p_escola_id uuid, p_curso_id uuid, p_ano_letivo_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  -- The route enforces roles, but the RPC is also exposed via PostgREST.
  -- Repeat the gate here so calling /rest/v1/rpc directly cannot bypass it.
  IF auth.uid() IS NULL
    OR NOT public.has_access_to_escola_fast(p_escola_id)
    OR NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['admin', 'admin_escola', 'staff_admin', 'diretor',
            'secretaria', 'admin_secretaria', 'secretaria_financeiro',
            'admin_financeiro']::text[]
    )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.cursos c
    WHERE c.escola_id = p_escola_id AND c.id = p_curso_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.anos_letivos a
    WHERE a.escola_id = p_escola_id AND a.id = p_ano_letivo_id
  ) THEN RETURN NULL;
  END IF;

  RETURN (
    WITH
    course AS (
      SELECT c.id, c.nome, c.codigo, c.nivel, c.descricao, c.status_aprovacao
      FROM public.cursos c
      WHERE c.id = p_curso_id AND c.escola_id = p_escola_id
    ),
    school_year AS (
      SELECT a.id, a.ano, a.ativo
      FROM public.anos_letivos a
      WHERE a.id = p_ano_letivo_id AND a.escola_id = p_escola_id
    ),
    course_classes AS (
      SELECT cl.id, cl.nome
      FROM public.classes cl
      WHERE cl.escola_id = p_escola_id AND cl.curso_id = p_curso_id
        AND (
          cl.ano_letivo_id = p_ano_letivo_id
          OR cl.ano_letivo_id IS NULL
          -- A class is reusable: its original year does not override the
          -- actual turma of the selected school/course/year.
          OR EXISTS (
            SELECT 1
            FROM public.turmas t
            JOIN school_year y ON (
              t.ano_letivo_id = y.id
              OR (t.ano_letivo_id IS NULL AND t.ano_letivo = y.ano)
            )
            WHERE t.escola_id = p_escola_id
              AND t.curso_id = p_curso_id
              AND t.classe_id = cl.id
              AND t.status_validacao = 'ativo'
          )
          -- A published curriculum for this year is independent evidence
          -- of curricular membership, even when no turma is currently open.
          OR EXISTS (
            SELECT 1 FROM public.curso_curriculos cc
            WHERE cc.escola_id = p_escola_id
              AND cc.curso_id = p_curso_id
              AND cc.classe_id = cl.id
              AND cc.ano_letivo_id = p_ano_letivo_id
              AND cc.status = 'published'
          )
        )
    ),
    course_turmas AS (
      SELECT t.id, t.nome, t.classe_id, t.turno, t.capacidade_maxima
      FROM public.turmas t JOIN school_year y
        ON (t.ano_letivo_id = y.id OR (t.ano_letivo_id IS NULL AND t.ano_letivo = y.ano))
      WHERE t.escola_id = p_escola_id AND t.curso_id = p_curso_id
        AND t.status_validacao = 'ativo'
    ),
    enrolled AS (
      SELECT DISTINCT m.turma_id, m.aluno_id
      FROM public.matriculas m
      JOIN course_turmas t ON t.id = m.turma_id
      JOIN school_year y ON y.ano = m.ano_letivo
      JOIN public.alunos a
        ON a.id = m.aluno_id AND a.escola_id = p_escola_id AND a.deleted_at IS NULL
      WHERE m.escola_id = p_escola_id AND m.status = 'ativo' AND m.ativo IS TRUE
    )
    SELECT jsonb_build_object(
      'curso', (SELECT jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'codigo', c.codigo, 'nivel', c.nivel,
        'descricao', c.descricao, 'status', c.status_aprovacao
      ) FROM course c),
      'anoLetivo', (SELECT jsonb_build_object(
        'id', y.id, 'ano', y.ano, 'ativo', y.ativo
      ) FROM school_year y),
      'stats', jsonb_build_object(
        'classes', (SELECT count(*) FROM course_classes),
        'turmas', (SELECT count(*) FROM course_turmas),
        'alunos', (SELECT count(DISTINCT aluno_id) FROM enrolled)
      ),
      'classes', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id, 'nome', x.nome, 'turmas', x.turmas, 'alunos', x.alunos
        ) ORDER BY x.nome, x.id), '[]'::jsonb)
        FROM (
          SELECT cl.id, cl.nome, count(DISTINCT t.id) turmas,
            count(DISTINCT e.aluno_id) alunos
          FROM course_classes cl
          LEFT JOIN course_turmas t ON t.classe_id = cl.id
          LEFT JOIN enrolled e ON e.turma_id = t.id
          GROUP BY cl.id, cl.nome
        ) x
      ),
      'turmas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id, 'nome', x.nome, 'classeId', x.classe_id,
          'turno', x.turno, 'capacidade', x.capacidade_maxima, 'alunos', x.alunos
        ) ORDER BY x.nome, x.id), '[]'::jsonb)
        FROM (
          SELECT t.id, t.nome, t.classe_id, t.turno, t.capacidade_maxima,
            count(DISTINCT e.aluno_id) alunos
          FROM course_turmas t
          LEFT JOIN enrolled e ON e.turma_id = t.id
          GROUP BY t.id, t.nome, t.classe_id, t.turno, t.capacidade_maxima
          ORDER BY t.nome, t.id LIMIT 100
        ) x
      ),
      'turmasLimitadas', (SELECT count(*) > 100 FROM course_turmas)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.command_center_course_overview(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center_course_overview(uuid,uuid,uuid) TO authenticated, service_role;
COMMIT;
