BEGIN;

-- Read-only contracts for AI integrations. Tenant selection is derived from
-- auth.uid() + escola_users; no caller-controlled escola_id is accepted.
CREATE OR REPLACE FUNCTION public.klasse_integration_escola_id(p_allowed_roles text[])
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT eu.escola_id
  FROM public.escola_users eu
  LEFT JOIN public.profiles p ON p.user_id = eu.user_id
  WHERE eu.user_id = (SELECT auth.uid())
    AND eu.papel = ANY (p_allowed_roles)
  ORDER BY
    CASE WHEN eu.escola_id = COALESCE(p.current_escola_id, p.escola_id) THEN 0 ELSE 1 END,
    eu.created_at NULLS LAST,
    eu.escola_id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.klasse_integration_escola_id(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_integration_escola_id(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.klasse_search_students(
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  aluno_id uuid,
  nome text,
  numero_processo text,
  status text,
  turma_id uuid,
  turma_nome text,
  ano_letivo integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','admin_secretaria','secretaria',
      'secretaria_financeiro','admin_financeiro','financeiro'
    ]) AS escola_id
  )
  SELECT a.id, COALESCE(NULLIF(a.nome_completo, ''), a.nome), a.numero_processo,
         a.status, m.turma_id, t.nome, m.ano_letivo
  FROM tenant x
  JOIN public.alunos a ON a.escola_id = x.escola_id AND a.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT mx.* FROM public.matriculas mx
    WHERE mx.escola_id = x.escola_id AND mx.aluno_id = a.id
    ORDER BY (mx.status IN ('ativo','ativa')) DESC, mx.ano_letivo DESC NULLS LAST, mx.created_at DESC
    LIMIT 1
  ) m ON true
  LEFT JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = x.escola_id
  WHERE x.escola_id IS NOT NULL
    AND length(btrim(COALESCE(p_query, ''))) >= 2
    AND (a.search_text ILIKE '%' || btrim(p_query) || '%'
         OR a.nome ILIKE '%' || btrim(p_query) || '%'
         OR a.numero_processo ILIKE '%' || btrim(p_query) || '%')
  ORDER BY COALESCE(NULLIF(a.nome_completo, ''), a.nome), a.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
$$;

CREATE OR REPLACE FUNCTION public.klasse_list_overdue_students(p_limit integer DEFAULT 20)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  total_em_atraso numeric,
  titulos_em_atraso bigint,
  vencimento_mais_antigo date,
  dias_em_atraso integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','secretaria','secretaria_financeiro',
      'admin_financeiro','financeiro'
    ]) AS escola_id
  )
  SELECT me.aluno_id,
         COALESCE(NULLIF(a.nome_completo, ''), a.nome),
         SUM(GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0))::numeric(14,2),
         COUNT(*)::bigint,
         MIN(me.data_vencimento),
         (CURRENT_DATE - MIN(me.data_vencimento))::integer
  FROM tenant x
  JOIN public.mensalidades me ON me.escola_id = x.escola_id
  JOIN public.alunos a ON a.id = me.aluno_id AND a.escola_id = x.escola_id
  WHERE x.escola_id IS NOT NULL
    AND me.data_vencimento < CURRENT_DATE
    AND me.status IN ('pendente','atrasado','parcial','pago_parcial')
    AND GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0) > 0
  GROUP BY me.aluno_id, COALESCE(NULLIF(a.nome_completo, ''), a.nome)
  -- Posicoes ordinais: num RETURNS TABLE de LANGUAGE sql o ORDER BY nao pode
  -- referir nomes de colunas de saida (total_em_atraso, aluno_nome).
  ORDER BY 3 DESC, 2
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
$$;

CREATE OR REPLACE FUNCTION public.klasse_financial_summary(
  p_start_date date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  valor_previsto numeric,
  valor_recebido numeric,
  valor_pendente numeric,
  valor_inadimplente numeric,
  alunos_inadimplentes bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','secretaria','secretaria_financeiro',
      'admin_financeiro','financeiro'
    ]) AS escola_id
  ), monthly AS (
    SELECT me.*
    FROM tenant x
    JOIN public.mensalidades me ON me.escola_id = x.escola_id
    WHERE x.escola_id IS NOT NULL
      AND me.data_vencimento BETWEEN LEAST(p_start_date, p_end_date) AND GREATEST(p_start_date, p_end_date)
      AND COALESCE(me.status, '') <> 'cancelado'
  )
  SELECT
    COALESCE(SUM(COALESCE(valor_previsto, valor, 0)), 0)::numeric(14,2),
    COALESCE(SUM(COALESCE(valor_pago_total, 0)), 0)::numeric(14,2),
    COALESCE(SUM(GREATEST(COALESCE(valor_previsto, valor, 0) - COALESCE(valor_pago_total, 0), 0)), 0)::numeric(14,2),
    COALESCE(SUM(GREATEST(COALESCE(valor_previsto, valor, 0) - COALESCE(valor_pago_total, 0), 0))
      FILTER (WHERE data_vencimento < CURRENT_DATE), 0)::numeric(14,2),
    COUNT(DISTINCT aluno_id) FILTER (
      WHERE data_vencimento < CURRENT_DATE
        AND GREATEST(COALESCE(valor_previsto, valor, 0) - COALESCE(valor_pago_total, 0), 0) > 0
    )::bigint
  FROM monthly
$$;

CREATE OR REPLACE FUNCTION public.klasse_teachers_with_grades(
  p_start_date date DEFAULT (CURRENT_DATE - 30),
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  professor_id uuid,
  professor_nome text,
  turmas_com_notas bigint,
  avaliacoes_com_notas bigint,
  notas_lancadas bigint,
  ultimo_lancamento timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','admin_secretaria','secretaria',
      'secretaria_financeiro','admin_financeiro'
    ]) AS escola_id
  )
  SELECT pr.id, COALESCE(NULLIF(p.nome, ''), p.email, 'Professor'),
         COUNT(DISTINCT td.turma_id), COUNT(DISTINCT av.id), COUNT(DISTINCT n.id), MAX(n.created_at)
  FROM tenant x
  JOIN public.turma_disciplinas td ON td.escola_id = x.escola_id AND td.professor_id IS NOT NULL
  JOIN public.professores pr ON pr.id = td.professor_id AND pr.escola_id = x.escola_id
  JOIN public.profiles p ON p.user_id = pr.profile_id
  JOIN public.avaliacoes av ON av.turma_disciplina_id = td.id AND av.escola_id = x.escola_id
  JOIN public.notas n ON n.avaliacao_id = av.id AND n.escola_id = x.escola_id
  WHERE x.escola_id IS NOT NULL
    AND n.created_at::date BETWEEN LEAST(p_start_date, p_end_date) AND GREATEST(p_start_date, p_end_date)
  GROUP BY pr.id, COALESCE(NULLIF(p.nome, ''), p.email, 'Professor')
  ORDER BY 6 DESC, 2
$$;

CREATE OR REPLACE FUNCTION public.klasse_class_attendance(
  p_class_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - 30),
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  presencas bigint,
  faltas bigint,
  atrasos bigint,
  total_registos bigint,
  percentual_presenca numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','admin_secretaria','secretaria',
      'secretaria_financeiro','admin_financeiro','professor'
    ]) AS escola_id
  ), enrolled AS (
    SELECT m.id, m.aluno_id, m.escola_id
    FROM tenant x
    JOIN public.turmas t ON t.id = p_class_id AND t.escola_id = x.escola_id
    JOIN public.matriculas m ON m.turma_id = t.id AND m.escola_id = x.escola_id
    WHERE x.escola_id IS NOT NULL AND m.status IN ('ativo','ativa')
  )
  SELECT e.aluno_id, COALESCE(NULLIF(a.nome_completo, ''), a.nome),
         COUNT(f.id) FILTER (WHERE f.status = 'presente'),
         COUNT(f.id) FILTER (WHERE f.status = 'falta'),
         COUNT(f.id) FILTER (WHERE f.status = 'atraso'),
         COUNT(f.id),
         CASE WHEN COUNT(f.id) = 0 THEN 0
              ELSE ROUND(100 * COUNT(f.id) FILTER (WHERE f.status = 'presente')::numeric / COUNT(f.id), 2)
         END
  FROM enrolled e
  JOIN public.alunos a ON a.id = e.aluno_id AND a.escola_id = e.escola_id
  LEFT JOIN public.frequencias f ON f.matricula_id = e.id AND f.escola_id = e.escola_id
    AND f.data BETWEEN LEAST(p_start_date, p_end_date) AND GREATEST(p_start_date, p_end_date)
  GROUP BY e.aluno_id, COALESCE(NULLIF(a.nome_completo, ''), a.nome)
  ORDER BY 2
$$;

CREATE OR REPLACE FUNCTION public.klasse_student_academic_status(p_student_id uuid)
RETURNS TABLE (
  aluno_id uuid,
  aluno_nome text,
  matricula_status text,
  turma_id uuid,
  turma_nome text,
  ano_letivo integer,
  media_notas numeric,
  percentual_presenca numeric,
  total_avaliacoes bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH tenant AS (
    SELECT public.klasse_integration_escola_id(ARRAY[
      'admin','staff_admin','admin_escola','admin_secretaria','secretaria',
      'secretaria_financeiro','admin_financeiro','professor'
    ]) AS escola_id
  ), enrollment AS (
    SELECT m.*
    FROM tenant x
    JOIN public.matriculas m ON m.aluno_id = p_student_id AND m.escola_id = x.escola_id
    WHERE x.escola_id IS NOT NULL
    ORDER BY (m.status IN ('ativo','ativa')) DESC, m.ano_letivo DESC NULLS LAST, m.created_at DESC
    LIMIT 1
  ), grade_stats AS (
    SELECT n.matricula_id, ROUND(AVG(n.valor), 2) AS media, COUNT(*) AS total
    FROM public.notas n JOIN enrollment e ON e.id = n.matricula_id AND e.escola_id = n.escola_id
    GROUP BY n.matricula_id
  ), attendance AS (
    SELECT f.matricula_id,
      CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(100 * COUNT(*) FILTER (WHERE f.status = 'presente')::numeric / COUNT(*), 2) END AS pct
    FROM public.frequencias f JOIN enrollment e ON e.id = f.matricula_id AND e.escola_id = f.escola_id
    GROUP BY f.matricula_id
  )
  SELECT a.id, COALESCE(NULLIF(a.nome_completo, ''), a.nome), e.status,
         e.turma_id, t.nome, e.ano_letivo, COALESCE(g.media, 0), COALESCE(att.pct, 0), COALESCE(g.total, 0)
  FROM enrollment e
  JOIN public.alunos a ON a.id = e.aluno_id AND a.escola_id = e.escola_id
  LEFT JOIN public.turmas t ON t.id = e.turma_id AND t.escola_id = e.escola_id
  LEFT JOIN grade_stats g ON g.matricula_id = e.id
  LEFT JOIN attendance att ON att.matricula_id = e.id
$$;

REVOKE ALL ON FUNCTION public.klasse_search_students(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klasse_list_overdue_students(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klasse_financial_summary(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klasse_teachers_with_grades(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klasse_class_attendance(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klasse_student_academic_status(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.klasse_search_students(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_list_overdue_students(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_financial_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_teachers_with_grades(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_class_attendance(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klasse_student_academic_status(uuid) TO authenticated;

COMMIT;
