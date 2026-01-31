BEGIN;

-- =========================================================
-- 0) ADMIN HELPERS (SECURE RPC)
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'global_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_or_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin() OR public.is_global_admin();
$$;

CREATE OR REPLACE FUNCTION public.admin_list_profiles(
  p_roles text[],
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_login text,
  escola_id uuid,
  current_escola_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role,
    p.numero_login,
    p.escola_id,
    p.current_escola_id
  FROM public.profiles p
  WHERE p.role = ANY(p_roles)
    AND p.deleted_at IS NULL
  ORDER BY p.nome NULLS LAST, p.user_id DESC
  LIMIT COALESCE(p_limit, 5000);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_profiles_by_ids(
  p_user_ids uuid[]
)
RETURNS TABLE(
  user_id uuid,
  email text,
  nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_or_global_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.email, p.nome
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_profiles_by_ids(
  p_user_ids uuid[]
)
RETURNS TABLE(
  user_id uuid,
  nome text,
  email text,
  telefone text,
  role text,
  numero_login text,
  escola_id uuid,
  current_escola_id uuid,
  created_at timestamptz,
  last_login timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_super_or_global_admin() AND v_escola_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.nome,
    p.email,
    p.telefone,
    p.role,
    p.numero_login,
    p.escola_id,
    p.current_escola_id,
    p.created_at,
    u.last_sign_in_at AS last_login
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = ANY(p_user_ids)
    AND (
      public.is_super_or_global_admin()
      OR auth.role() = 'service_role'
      OR p.user_id IN (
        SELECT eu.user_id
        FROM public.escola_users eu
        WHERE eu.escola_id = v_escola_id
      )
    );
END;
$$;

-- =========================================================
-- 1) MVs PARA ROTAS OBRIGATÓRIAS
-- =========================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_propinas_por_turma AS
SELECT
  l.escola_id,
  l.ano_referencia AS ano_letivo,
  t.id AS turma_id,
  t.nome AS turma_nome,
  c.nome AS classe_label,
  t.turno,
  COUNT(l.id) AS qtd_mensalidades,
  COUNT(l.id) FILTER (WHERE l.status = 'vencido') AS qtd_em_atraso,
  COALESCE(SUM(l.valor_total), 0) AS total_previsto,
  COALESCE(SUM(l.valor_total) FILTER (WHERE l.status IN ('pago', 'parcial')), 0) AS total_pago,
  COALESCE(SUM(l.valor_total) FILTER (WHERE l.status = 'vencido'), 0) AS total_em_atraso,
  CASE
    WHEN COUNT(l.id) > 0 THEN
      ROUND(
        (COUNT(l.id) FILTER (WHERE l.status = 'vencido') * 100.0 / COUNT(l.id)),
        2
      )
    ELSE 0
  END AS inadimplencia_pct
FROM public.financeiro_lancamentos l
LEFT JOIN public.matriculas m ON l.matricula_id = m.id
LEFT JOIN public.turmas t ON m.turma_id = t.id
LEFT JOIN public.classes c ON t.classe_id = c.id
WHERE l.origem = 'mensalidade'
  AND t.id IS NOT NULL
GROUP BY l.escola_id, l.ano_referencia, t.id, t.nome, c.nome, t.turno
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_propinas_por_turma
  ON internal.mv_financeiro_propinas_por_turma (escola_id, ano_letivo, turma_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_top_turmas_hoje AS
WITH agg AS (
  SELECT
    f.escola_id,
    m.turma_id,
    f.data AS dia,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE f.status = 'presente')::integer AS presentes
  FROM public.frequencias f
  JOIN public.matriculas m ON m.id = f.matricula_id
  WHERE f.data = CURRENT_DATE
  GROUP BY f.escola_id, m.turma_id, f.data
)
SELECT
  a.escola_id,
  a.turma_id,
  t.nome AS turma_nome,
  a.dia,
  a.total,
  a.presentes,
  CASE
    WHEN a.total > 0 THEN ROUND((a.presentes::numeric / a.total::numeric) * 100.0, 1)
    ELSE NULL::numeric
  END AS percent
FROM agg a
JOIN public.turmas t ON t.id = a.turma_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_top_turmas_hoje
  ON internal.mv_top_turmas_hoje (escola_id, turma_id, dia);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_top_cursos_media AS
SELECT
  n.escola_id,
  c.id AS curso_id,
  c.nome AS curso_nome,
  ROUND(AVG(n.valor)::numeric, 2) AS media
FROM public.notas n
JOIN public.avaliacoes a ON a.id = n.avaliacao_id
JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
JOIN public.cursos c ON c.id = cm.curso_id
WHERE n.valor IS NOT NULL
GROUP BY n.escola_id, c.id, c.nome
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_top_cursos_media
  ON internal.mv_top_cursos_media (escola_id, curso_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_escola_info AS
SELECT
  e.id AS escola_id,
  e.nome,
  e.plano_atual,
  e.status
FROM public.escolas e
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_escola_info
  ON internal.mv_escola_info (escola_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_escola_cursos_stats AS
SELECT
  c.escola_id,
  c.id,
  c.nome,
  c.nivel,
  c.descricao,
  c.codigo,
  c.course_code,
  c.curriculum_key,
  c.tipo
FROM public.cursos c
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_escola_cursos_stats
  ON internal.mv_escola_cursos_stats (escola_id, id);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_super_admin_escola_metrics AS
SELECT
  e.id AS escola_id,
  COALESCE((
    SELECT COUNT(*)
    FROM public.alunos a
    WHERE a.escola_id = e.id
      AND a.status IN ('ativo', 'ativa', 'active')
  ), 0) AS alunos_ativos,
  COALESCE((
    SELECT COUNT(*)
    FROM public.alunos a
    WHERE a.escola_id = e.id
      AND a.status IN ('inativo', 'suspenso', 'trancado', 'desistente')
  ), 0) AS alunos_inativos,
  COALESCE((
    SELECT COUNT(*)
    FROM public.professores p
    WHERE p.escola_id = e.id
  ), 0) AS professores,
  COALESCE((
    SELECT COUNT(*)
    FROM public.turmas t
    WHERE t.escola_id = e.id
      AND t.status_validacao = 'ativo'
  ), 0) AS turmas_ativas,
  COALESCE((
    SELECT COUNT(*)
    FROM public.turmas t
    WHERE t.escola_id = e.id
  ), 0) AS turmas_total,
  COALESCE((
    SELECT COUNT(*)
    FROM public.matriculas m
    WHERE m.escola_id = e.id
      AND m.status = 'ativa'
  ), 0) AS matriculas_ativas
FROM public.escolas e
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_super_admin_escola_metrics
  ON internal.mv_super_admin_escola_metrics (escola_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_super_admin_audit_metrics AS
SELECT
  al.escola_id,
  MAX(al.created_at) AS ultimo_acesso,
  COUNT(*) FILTER (WHERE al.created_at >= now() - interval '24 hours') AS accessos_24h,
  COUNT(*) FILTER (
    WHERE al.acao = 'error'
      AND al.created_at >= now() - interval '24 hours'
  ) AS error_count_24h,
  (ARRAY_AGG(al.details::text ORDER BY al.created_at DESC) FILTER (WHERE al.acao = 'error'))[1] AS last_error
FROM public.audit_logs al
GROUP BY al.escola_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_super_admin_audit_metrics
  ON internal.mv_super_admin_audit_metrics (escola_id);

-- =========================================================
-- 2) WRAPPERS (vw_*)
-- =========================================================

CREATE OR REPLACE VIEW public.vw_financeiro_escola_dia AS
SELECT
  escola_id,
  dia,
  qtd_pagos,
  qtd_total
FROM public.mv_financeiro_escola_dia
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_freq_por_turma_dia AS
SELECT
  escola_id,
  turma_id,
  dia,
  total,
  presentes
FROM public.mv_freq_por_turma_dia
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_pagamentos_status AS
SELECT
  escola_id,
  status,
  total
FROM internal.mv_pagamentos_status
WHERE public.is_super_or_global_admin()
   OR escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE VIEW public.vw_financeiro_propinas_por_turma AS
SELECT
  escola_id,
  ano_letivo,
  turma_id,
  turma_nome,
  classe_label,
  turno,
  qtd_mensalidades,
  qtd_em_atraso,
  total_previsto,
  total_pago,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_por_turma
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE VIEW public.vw_top_turmas_hoje AS
SELECT
  escola_id,
  turma_id,
  turma_nome,
  dia,
  total,
  presentes,
  percent
FROM internal.mv_top_turmas_hoje
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE VIEW public.vw_top_cursos_media AS
SELECT
  escola_id,
  curso_id,
  curso_nome,
  media
FROM internal.mv_top_cursos_media
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE VIEW public.vw_escola_info AS
SELECT
  m.escola_id,
  m.nome,
  m.plano_atual,
  m.status
FROM internal.mv_escola_info m
WHERE public.is_super_or_global_admin()
   OR m.escola_id IN (
     SELECT eu.escola_id
     FROM public.escola_users eu
     WHERE eu.user_id = auth.uid()
   )
   OR EXISTS (
     SELECT 1
     FROM public.onboarding_drafts od
     WHERE od.escola_id = m.escola_id
       AND od.user_id = auth.uid()
   );

CREATE OR REPLACE VIEW public.vw_escola_cursos_stats AS
SELECT
  escola_id,
  id,
  nome,
  nivel,
  descricao,
  codigo,
  course_code,
  curriculum_key,
  tipo
FROM internal.mv_escola_cursos_stats
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE VIEW public.vw_super_admin_escola_metrics AS
SELECT
  escola_id,
  alunos_ativos,
  alunos_inativos,
  professores,
  turmas_ativas,
  turmas_total,
  matriculas_ativas
FROM internal.mv_super_admin_escola_metrics
WHERE public.is_super_or_global_admin();

CREATE OR REPLACE VIEW public.vw_super_admin_audit_metrics AS
SELECT
  escola_id,
  ultimo_acesso,
  accessos_24h,
  error_count_24h,
  last_error
FROM internal.mv_super_admin_audit_metrics
WHERE public.is_super_or_global_admin();

-- =========================================================
-- 3) REFRESH FUNCTIONS + CRON
-- =========================================================

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_escola_dia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_escola_dia;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_freq_por_turma_dia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_freq_por_turma_dia;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_propinas_por_turma()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_por_turma;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_top_turmas_hoje()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_top_cursos_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_escola_info()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_info;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_escola_cursos_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_cursos_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_super_admin_escola_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_escola_metrics;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_mv_super_admin_audit_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_escola_dia',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_escola_dia$$
);

SELECT cron.schedule(
  'refresh_mv_freq_por_turma_dia',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_freq_por_turma_dia$$
);

SELECT cron.schedule(
  'refresh_mv_financeiro_propinas_por_turma',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_por_turma$$
);

SELECT cron.schedule(
  'refresh_mv_top_turmas_hoje',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_turmas_hoje$$
);

SELECT cron.schedule(
  'refresh_mv_top_cursos_media',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_top_cursos_media$$
);

SELECT cron.schedule(
  'refresh_mv_escola_info',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_info$$
);

SELECT cron.schedule(
  'refresh_mv_escola_cursos_stats',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_escola_cursos_stats$$
);

SELECT cron.schedule(
  'refresh_mv_super_admin_escola_metrics',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_escola_metrics$$
);

SELECT cron.schedule(
  'refresh_mv_super_admin_audit_metrics',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_super_admin_audit_metrics$$
);

GRANT ALL ON TABLE internal.mv_financeiro_propinas_por_turma TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_top_turmas_hoje TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_top_cursos_media TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_escola_info TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_escola_cursos_stats TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_super_admin_escola_metrics TO anon, authenticated, service_role;
GRANT ALL ON TABLE internal.mv_super_admin_audit_metrics TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_list_profiles(text[], integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_profiles_by_ids(uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tenant_profiles_by_ids(uuid[]) TO anon, authenticated, service_role;

COMMIT;
