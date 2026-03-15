BEGIN;

DROP VIEW IF EXISTS public.vw_secretaria_dashboard_kpis;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_secretaria_dashboard_kpis;

CREATE MATERIALIZED VIEW internal.mv_secretaria_dashboard_kpis AS
WITH alunos_ativos AS (
    SELECT matriculas.escola_id,
        count(DISTINCT matriculas.aluno_id) AS total
      FROM matriculas
     WHERE matriculas.status = ANY (ARRAY['ativa'::text, 'ativo'::text, 'active'::text])
     GROUP BY matriculas.escola_id
  ), matriculas_ativas AS (
    SELECT matriculas.escola_id,
        count(*) AS total
      FROM matriculas
     WHERE matriculas.status = ANY (ARRAY['ativa'::text, 'ativo'::text, 'active'::text])
     GROUP BY matriculas.escola_id
  ), turmas_total AS (
    SELECT turmas_1.escola_id,
        count(*) AS total
      FROM turmas turmas_1
     GROUP BY turmas_1.escola_id
  ), pendencias_importacao AS (
    SELECT import_migrations.escola_id,
        count(*) AS total
      FROM import_migrations
     WHERE import_migrations.status = ANY (ARRAY['processing'::text, 'error'::text])
     GROUP BY import_migrations.escola_id
  ), turmas_sem_professor AS (
    SELECT t.escola_id,
        count(DISTINCT t.id) AS total
      FROM turmas t
        LEFT JOIN ( SELECT DISTINCT turma_disciplinas.turma_id,
              turma_disciplinas.escola_id
            FROM turma_disciplinas
           WHERE turma_disciplinas.professor_id IS NOT NULL) td ON td.turma_id = t.id AND td.escola_id = t.escola_id
     WHERE td.turma_id IS NULL
     GROUP BY t.escola_id
  ), alunos_sem_turma AS (
    SELECT a.escola_id,
        count(DISTINCT a.id) AS total
      FROM alunos a
        LEFT JOIN matriculas m ON m.aluno_id = a.id AND m.escola_id = a.escola_id AND (m.status = ANY (ARRAY['ativa'::text, 'ativo'::text, 'active'::text]))
     WHERE m.id IS NULL
     GROUP BY a.escola_id
  )
SELECT e.id AS escola_id,
  COALESCE(alunos_ativos.total, 0::bigint)::integer AS total_alunos,
  COALESCE(turmas_total.total, 0::bigint)::integer AS total_turmas,
  COALESCE(matriculas_ativas.total, 0::bigint)::integer AS matriculas_ativas,
  COALESCE(pendencias_importacao.total, 0::bigint)::integer AS pendencias_importacao,
  COALESCE(turmas_sem_professor.total, 0::bigint)::integer AS turmas_sem_professor,
  COALESCE(alunos_sem_turma.total, 0::bigint)::integer AS alunos_sem_turma,
  COALESCE(fin.inadimplentes_total, 0) AS inadimplentes_total,
  COALESCE(fin.risco_total, 0::numeric)::numeric(14,2) AS risco_total,
  COALESCE(resumo.resumo_status, '[]'::jsonb) AS resumo_status,
  COALESCE(turmas.turmas_destaque, '[]'::jsonb) AS turmas_destaque,
  COALESCE(novas.novas_matriculas, '[]'::jsonb) AS novas_matriculas,
  '[]'::jsonb AS avisos_recentes
FROM escolas e
  LEFT JOIN alunos_ativos ON alunos_ativos.escola_id = e.id
  LEFT JOIN turmas_total ON turmas_total.escola_id = e.id
  LEFT JOIN matriculas_ativas ON matriculas_ativas.escola_id = e.id
  LEFT JOIN pendencias_importacao ON pendencias_importacao.escola_id = e.id
  LEFT JOIN turmas_sem_professor ON turmas_sem_professor.escola_id = e.id
  LEFT JOIN alunos_sem_turma ON alunos_sem_turma.escola_id = e.id
  LEFT JOIN internal.mv_financeiro_kpis_geral fin ON fin.escola_id = e.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('status', s.status, 'total', s.total) ORDER BY s.status) AS resumo_status
      FROM internal.mv_secretaria_matriculas_status s
     WHERE s.escola_id = e.id
  ) resumo ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'total_alunos', t.total_alunos) ORDER BY t.total_alunos DESC) AS turmas_destaque
      FROM (
        SELECT t_1.id,
          t_1.nome,
          count(m.id) AS total_alunos
        FROM turmas t_1
        LEFT JOIN matriculas m ON m.turma_id = t_1.id AND (m.status = ANY (ARRAY['ativa'::text, 'ativo'::text, 'active'::text]))
        WHERE t_1.escola_id = e.id
        GROUP BY t_1.id
        ORDER BY (count(m.id)) DESC
        LIMIT 4
      ) t
  ) turmas ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', m.id, 'created_at', m.created_at, 'aluno', jsonb_build_object('nome', COALESCE(a.nome_completo, a.nome, 'Aluno'::text)), 'turma', jsonb_build_object('nome', COALESCE(t.nome, 'Sem turma'::text))) ORDER BY m.created_at DESC) AS novas_matriculas
      FROM (
        SELECT matriculas.id,
          matriculas.aluno_id,
          matriculas.turma_id,
          matriculas.created_at
        FROM matriculas
        WHERE matriculas.escola_id = e.id
        ORDER BY matriculas.created_at DESC
        LIMIT 6
      ) m
      LEFT JOIN alunos a ON a.id = m.aluno_id
      LEFT JOIN turmas t ON t.id = m.turma_id
  ) novas ON true;

CREATE UNIQUE INDEX ux_mv_secretaria_dashboard_kpis ON internal.mv_secretaria_dashboard_kpis (escola_id);

CREATE OR REPLACE VIEW public.vw_secretaria_dashboard_kpis
WITH (security_invoker=true) AS
SELECT * FROM internal.mv_secretaria_dashboard_kpis
WHERE (escola_id IN ( SELECT eu.escola_id FROM escola_users eu WHERE eu.user_id = auth.uid()));

COMMIT;
