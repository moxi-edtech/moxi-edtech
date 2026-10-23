-- Additive API-compatible filter for INTERSECTION of verified document and overdue tuition signals.
-- No RLS, fiscal, financial settlement, authentication or table changes.
CREATE OR REPLACE FUNCTION public.command_center_roster_operational_v1(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_turma_id uuid DEFAULT NULL,
  p_classe_id uuid DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_cursor_name text DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_cursor_priority integer DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_polo_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'nome_asc',
  p_filter text DEFAULT 'todos'
)
RETURNS TABLE (
  aluno_id uuid,
  nome text,
  numero_processo text,
  turma_id uuid,
  turma_nome text,
  numero_chamada integer,
  total_filtrado bigint,
  cursor_name text,
  documentos_sinalizados boolean,
  propinas_vencidas boolean,
  pendencias_count integer,
  rate_limited boolean
)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_query text := public.normalize_search_text(p_query);
  v_tsquery text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_access_to_escola_fast(p_escola_id)
     OR NOT (
       public.check_super_admin_role()
       OR EXISTS (
         SELECT 1 FROM public.escola_users eu
         WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
           AND (lower(coalesce(eu.papel, '')) = ANY(ARRAY[
                'admin','admin_escola','staff_admin','diretor',
                'secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro'])
             OR lower(coalesce(eu.role, '')) = ANY(ARRAY[
                'admin','admin_escola','staff_admin','diretor',
                'secretaria','admin_secretaria','secretaria_financeiro','admin_financeiro']))
       )
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_polo_id IS NOT NULL THEN
    RAISE EXCEPTION 'polo_scope_unavailable' USING ERRCODE = '42501';
  END IF;
  IF (p_turma_id IS NULL) = (p_classe_id IS NULL) OR p_ano_letivo IS NULL
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 50
     OR p_sort IS NULL OR p_sort NOT IN ('nome_asc','nome_desc','pendencias_primeiro')
     OR p_filter IS NULL OR p_filter NOT IN ('todos','documentos_sinalizados','propinas_vencidas','ambos')
     OR (p_cursor_name IS NULL) <> (p_cursor_id IS NULL)
     OR (p_sort = 'pendencias_primeiro' AND p_cursor_id IS NOT NULL AND p_cursor_priority IS NULL)
     OR (p_cursor_priority IS NOT NULL AND (p_cursor_priority < 0 OR p_cursor_priority > 2))
     OR length(coalesce(p_query,'')) > 90
     OR (p_query IS NOT NULL AND btrim(p_query) <> '' AND length(v_query) < 2)
  THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023';
  END IF;
  IF v_query <> '' THEN
    SELECT string_agg(token || ':*',' & ') INTO v_tsquery
    FROM unnest(regexp_split_to_array(v_query,'\s+')) AS token WHERE token <> '';
  END IF;

  -- Unlike an exception, a sentinel row COMMITs the limiter's count. 
  -- Raising would rollback the UPDATE and disable the rate limit entirely.
  IF NOT public.command_center_roster_throttle(p_escola_id) THEN
    RETURN QUERY SELECT NULL::uuid,NULL::text,NULL::text,NULL::uuid,NULL::text,
      NULL::integer,0::bigint,NULL::text,false,false,0,true;
    RETURN;
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT
      a.id AS student_id,
      coalesce(nullif(a.nome_completo, ''),nullif(a.nome, ''),'Aluno') AS student_name,
      a.numero_processo AS student_number,
      m.id AS enrollment_id,
      m.turma_id AS class_group_id,
      t.nome AS class_group_name,
      m.numero_chamada AS roll_number,
      public.normalize_search_text(coalesce(nullif(a.nome_completo, ''),a.nome,'Aluno')) AS sort_name,
      row_number() OVER (PARTITION BY a.id
        ORDER BY coalesce(m.data_inicio_financeiro,m.data_matricula,m.created_at::date) DESC,
          m.created_at DESC,m.id DESC) AS rn
    FROM public.matriculas m
    JOIN public.alunos a ON a.id=m.aluno_id AND a.escola_id=p_escola_id AND a.deleted_at IS NULL
    JOIN public.turmas t ON t.id=m.turma_id AND t.escola_id=p_escola_id
    WHERE m.escola_id=p_escola_id AND m.ano_letivo=p_ano_letivo
      AND m.status='ativo' AND m.ativo IS TRUE
      AND (p_turma_id IS NULL OR m.turma_id=p_turma_id)
      AND (p_classe_id IS NULL OR t.classe_id=p_classe_id)
      AND (v_tsquery IS NULL OR to_tsvector('simple',
        public.normalize_search_text(a.nome_completo,a.nome,a.numero_processo)
      ) @@ to_tsquery('simple',v_tsquery))
  ), deduplicated AS (
    SELECT * FROM roster WHERE rn=1
  ), flagged AS (
    SELECT d.*,
      EXISTS (
        SELECT 1 FROM public.candidaturas c
        JOIN LATERAL (
          SELECT slog.metadata
          FROM public.candidaturas_status_log slog
          WHERE slog.candidatura_id=c.id AND slog.escola_id=p_escola_id
          ORDER BY slog.created_at DESC,slog.id DESC LIMIT 1
        ) latest ON TRUE
        WHERE c.escola_id=p_escola_id AND c.aluno_id=d.student_id
          AND c.ano_letivo=p_ano_letivo
          AND (c.matricula_id=d.enrollment_id OR c.matricula_id IS NULL)
          AND latest.metadata->>'tipo'='DOCUMENTOS_PENDENTES'
      ) AS has_docs_signal,
      EXISTS (
        SELECT 1 FROM public.mensalidades due
        WHERE due.escola_id=p_escola_id AND due.aluno_id=d.student_id
          -- Exact canonical academic enrollment scope (same key as the
          -- finance reconciliation model): NEVER attach a legacy/null
          -- monthly obligation to a different enrollment for this student.
          AND due.matricula_id=d.enrollment_id
          AND due.ano_letivo=p_ano_letivo::text
          AND due.data_vencimento < (now() AT TIME ZONE 'Africa/Luanda')::date
          AND lower(coalesce(due.status,'')) IN (
            'pendente','atrasado','parcial','pago_parcial',
            'em_atraso','atraso'
          )
          AND greatest(
            coalesce(due.valor_previsto,due.valor,0)-coalesce(due.valor_pago_total,0),0
          ) > 0
      ) AS has_overdue_tuition
    FROM deduplicated d
  ), filtered AS (
    SELECT f.*,
      (f.has_docs_signal::integer + f.has_overdue_tuition::integer) AS priority_score
    FROM flagged f
    WHERE p_filter='todos'
      OR (p_filter='documentos_sinalizados' AND f.has_docs_signal)
      OR (p_filter='propinas_vencidas' AND f.has_overdue_tuition)
      OR (p_filter='ambos' AND f.has_docs_signal AND f.has_overdue_tuition)
  ), counted AS (
    SELECT q.*, count(*) OVER () AS filtered_count FROM filtered q
  )
  SELECT c.student_id,c.student_name,c.student_number,
    c.class_group_id,c.class_group_name,c.roll_number,
    c.filtered_count,c.sort_name,c.has_docs_signal,c.has_overdue_tuition,
    c.priority_score,false
  FROM counted c
  WHERE p_cursor_id IS NULL
    OR (p_sort='nome_asc' AND (c.sort_name,c.student_id)>(p_cursor_name,p_cursor_id))
    OR (p_sort='nome_desc' AND (c.sort_name,c.student_id)<(p_cursor_name,p_cursor_id))
    OR (p_sort='pendencias_primeiro' AND
      (-c.priority_score,c.sort_name,c.student_id)>
      (-p_cursor_priority,p_cursor_name,p_cursor_id))
  ORDER BY
    CASE WHEN p_sort='pendencias_primeiro' THEN c.priority_score END DESC,
    CASE WHEN p_sort IN ('nome_asc','pendencias_primeiro') THEN c.sort_name END ASC,
    CASE WHEN p_sort IN ('nome_asc','pendencias_primeiro') THEN c.student_id END ASC,
    CASE WHEN p_sort='nome_desc' THEN c.sort_name END DESC,
    CASE WHEN p_sort='nome_desc' THEN c.student_id END DESC
  LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.command_center_roster_operational_v1(
  uuid,integer,uuid,uuid,text,text,uuid,integer,integer,uuid,text,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.command_center_roster_operational_v1(
  uuid,integer,uuid,uuid,text,text,uuid,integer,integer,uuid,text,text
) TO authenticated;


