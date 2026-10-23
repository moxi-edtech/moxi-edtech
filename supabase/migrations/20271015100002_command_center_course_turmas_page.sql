-- EX-007: server-side, bounded pagination for Curso -> Turmas.
-- This is a new invoker RPC; the existing overview/aggregates remain unchanged.
-- Do not apply to production before the EX-005 forward migration and release gate.
BEGIN;
CREATE OR REPLACE FUNCTION public.command_center_course_turmas_page(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_classe_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_ano integer;
  v_total bigint;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.has_access_to_escola_fast(p_escola_id)
    OR NOT public.user_has_role_in_school(
      p_escola_id,
      ARRAY['admin','admin_escola','staff_admin','diretor',
            'secretaria','admin_secretaria','secretaria_financeiro',
            'admin_financeiro']::text[]
    )
  THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;

  IF p_page IS NULL OR p_page < 1 OR p_page > 10000
    OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 50
    OR length(coalesce(p_search,'')) > 72
  THEN RAISE EXCEPTION 'invalid course turma window' USING ERRCODE = '22023'; END IF;

  SELECT a.ano INTO v_ano FROM public.anos_letivos a
  WHERE a.id=p_ano_letivo_id AND a.escola_id=p_escola_id;
  IF v_ano IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.cursos c WHERE c.id=p_curso_id AND c.escola_id=p_escola_id
  ) THEN RETURN NULL; END IF;

  -- Never trust an arbitrary class filter from the request.
  IF p_classe_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classes cl
    WHERE cl.id=p_classe_id AND cl.escola_id=p_escola_id AND cl.curso_id=p_curso_id
  ) THEN RAISE EXCEPTION 'invalid course class' USING ERRCODE = '22023'; END IF;

  WITH eligible AS (
    SELECT t.id, t.nome, t.classe_id, t.turno, t.capacidade_maxima
    FROM public.turmas t
    WHERE t.escola_id=p_escola_id AND t.curso_id=p_curso_id
      AND t.status_validacao='ativo'
      AND (t.ano_letivo_id=p_ano_letivo_id
           OR (t.ano_letivo_id IS NULL AND t.ano_letivo=v_ano))
      AND (p_classe_id IS NULL OR t.classe_id=p_classe_id)
      -- strpos treats the operator's term as literal text, not a SQL wildcard.
      AND (nullif(trim(p_search),'') IS NULL
           OR strpos(lower(t.nome),lower(trim(p_search)))>0)
  ), total AS (
    SELECT count(*)::bigint AS n FROM eligible
  ), page_window AS (
    SELECT * FROM eligible ORDER BY nome COLLATE "C", id
    LIMIT p_page_size OFFSET ((p_page::bigint-1)*p_page_size)
  ), counted AS (
    SELECT w.*, (
      SELECT count(DISTINCT m.aluno_id)
      FROM public.matriculas m
      JOIN public.alunos a ON a.id=m.aluno_id
        AND a.escola_id=p_escola_id AND a.deleted_at IS NULL
      WHERE m.escola_id=p_escola_id AND m.turma_id=w.id
        AND m.ano_letivo=v_ano AND m.status='ativo' AND m.ativo IS TRUE
    ) AS alunos
    FROM page_window w
  )
  SELECT total.n,
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',x.id,'nome',x.nome,'classeId',x.classe_id,
      'turno',x.turno,'capacidade',x.capacidade_maxima,'alunos',x.alunos
    ) ORDER BY x.nome COLLATE "C",x.id) FROM counted x),'[]'::jsonb)
  INTO v_total,v_items FROM total;

  RETURN jsonb_build_object(
    'items',v_items,'total',v_total,'page',p_page,'pageSize',p_page_size,
    'hasMore',p_page::bigint*p_page_size<v_total
  );
END;
$$;
REVOKE ALL ON FUNCTION public.command_center_course_turmas_page(uuid,uuid,uuid,integer,integer,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center_course_turmas_page(uuid,uuid,uuid,integer,integer,uuid,text) TO authenticated, service_role;
COMMIT;
