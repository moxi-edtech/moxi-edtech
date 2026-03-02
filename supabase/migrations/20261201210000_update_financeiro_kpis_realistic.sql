BEGIN;

/**
 * REFORÇO DE KPIs FINANCEIROS (V2 com Cascade e Rebuild)
 * Ajusta a visão geral para focar no mês corrente e ano letivo ativo.
 */

-- 1. Remover views dependentes com CASCADE
DROP VIEW IF EXISTS public.vw_financeiro_kpis_geral CASCADE;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_kpis_geral CASCADE;

-- 2. Criar Nova Materialized View de KPIs Financeiros
CREATE MATERIALIZED VIEW internal.mv_financeiro_kpis_geral AS
 WITH current_state AS (
    SELECT 
      extract(month from current_date)::int as mes_atual,
      extract(year from current_date)::int as ano_atual
 ),
 matriculas AS (
    SELECT 
      m.escola_id,
      count(*) FILTER (WHERE m.status = ANY (ARRAY['ativo'::text, 'ativa'::text]))::integer AS matriculados_total
    FROM public.matriculas m
    GROUP BY m.escola_id
 ), 
 mensalidades_stats AS (
    SELECT 
      ms.escola_id,
      -- Totais do Ano Letivo (Ano Atual)
      count(*) FILTER (WHERE ms.status = 'pago' AND ms.ano_referencia = (SELECT ano_atual FROM current_state))::integer AS pagos_total,
      sum(CASE WHEN ms.status = 'pago' AND ms.ano_referencia = (SELECT ano_atual FROM current_state) 
               THEN coalesce(ms.valor_previsto, ms.valor, 0) ELSE 0 END)::numeric(14,2) AS pagos_valor,
      
      count(*) FILTER (WHERE ms.status <> 'pago' AND ms.ano_referencia = (SELECT ano_atual FROM current_state))::integer AS pendentes_total,
      sum(CASE WHEN ms.status <> 'pago' AND ms.ano_referencia = (SELECT ano_atual FROM current_state) 
               THEN coalesce(ms.valor_previsto, ms.valor, 0) ELSE 0 END)::numeric(14,2) AS pendentes_valor,

      -- Totais do Mês Corrente (Previsão Realista de Caixa)
      sum(CASE WHEN ms.mes_referencia = (SELECT mes_atual FROM current_state) AND ms.ano_referencia = (SELECT ano_atual FROM current_state)
               THEN coalesce(ms.valor_previsto, ms.valor, 0) ELSE 0 END)::numeric(14,2) AS receita_mes_total,
      
      sum(CASE WHEN ms.status = 'pago' AND ms.mes_referencia = (SELECT mes_atual FROM current_state) AND ms.ano_referencia = (SELECT ano_atual FROM current_state)
               THEN coalesce(ms.valor_previsto, ms.valor, 0) ELSE 0 END)::numeric(14,2) AS receita_mes_paga
    FROM public.mensalidades ms
    GROUP BY ms.escola_id
 ), 
 inadimplencia AS (
    SELECT 
      ms.escola_id,
      count(DISTINCT ms.aluno_id)::integer AS inadimplentes_total,
      sum(coalesce(ms.valor_previsto, ms.valor, 0))::numeric(14,2) AS risco_total
    FROM public.mensalidades ms
    WHERE ms.status <> 'pago' AND ms.data_vencimento < CURRENT_DATE
    GROUP BY ms.escola_id
 )
 SELECT 
    e.id AS escola_id,
    coalesce(m.matriculados_total, 0) AS matriculados_total,
    coalesce(i.inadimplentes_total, 0) AS inadimplentes_total,
    coalesce(i.risco_total, 0::numeric) AS risco_total,
    coalesce(ms.pagos_total, 0) AS pagos_total,
    coalesce(ms.pagos_valor, 0::numeric) AS pagos_valor,
    coalesce(ms.pendentes_total, 0) AS pendentes_total,
    coalesce(ms.pendentes_valor, 0::numeric) AS pendentes_valor,
    coalesce(ms.receita_mes_total, 0::numeric) AS receita_mes_total,
    coalesce(ms.receita_mes_paga, 0::numeric) AS receita_mes_paga
 FROM public.escolas e
 LEFT JOIN matriculas m ON m.escola_id = e.id
 LEFT JOIN mensalidades_stats ms ON ms.escola_id = e.id
 LEFT JOIN inadimplencia i ON i.escola_id = e.id;

CREATE UNIQUE INDEX ux_mv_financeiro_kpis_geral ON internal.mv_financeiro_kpis_geral (escola_id);

-- 3. Recriar View Pública de KPIs Financeiros
CREATE OR REPLACE VIEW public.vw_financeiro_kpis_geral
 WITH (security_invoker=true) AS
 SELECT * FROM internal.mv_financeiro_kpis_geral
 WHERE (escola_id IN ( SELECT eu.escola_id FROM escola_users eu WHERE eu.user_id = auth.uid()))
    OR public.is_super_admin();

-- 4. Recriar MV da Secretaria (que foi dropada pelo cascade)
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
          WHERE import_migrations.status IS NULL OR import_migrations.status <> 'imported'::text
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
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('status', s.status, 'total', s.total) ORDER BY s.status) AS resumo_status
           FROM internal.mv_secretaria_matriculas_status s
          WHERE s.escola_id = e.id) resumo ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'total_alunos', t.total_alunos) ORDER BY t.total_alunos DESC) AS turmas_destaque
           FROM ( SELECT t_1.id,
                    t_1.nome,
                    count(m.id) AS total_alunos
                   FROM turmas t_1
                     LEFT JOIN matriculas m ON m.turma_id = t_1.id AND (m.status = ANY (ARRAY['ativa'::text, 'ativo'::text, 'active'::text]))
                  WHERE t_1.escola_id = e.id
                  GROUP BY t_1.id
                  ORDER BY (count(m.id)) DESC
                 LIMIT 4) t) turmas ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', m.id, 'created_at', m.created_at, 'aluno', jsonb_build_object('nome', COALESCE(a.nome_completo, a.nome, 'Aluno'::text)), 'turma', jsonb_build_object('nome', COALESCE(t.nome, 'Sem turma'::text))) ORDER BY m.created_at DESC) AS novas_matriculas
           FROM ( SELECT matriculas.id,
                    matriculas.aluno_id,
                    matriculas.turma_id,
                    matriculas.created_at
                   FROM matriculas
                  WHERE matriculas.escola_id = e.id
                  ORDER BY matriculas.created_at DESC
                 LIMIT 6) m
             LEFT JOIN alunos a ON a.id = m.aluno_id
             LEFT JOIN turmas t ON t.id = m.turma_id) novas ON true;

CREATE UNIQUE INDEX ux_mv_secretaria_dashboard_kpis ON internal.mv_secretaria_dashboard_kpis (escola_id);

-- 5. Recriar View Pública da Secretaria
CREATE OR REPLACE VIEW public.vw_secretaria_dashboard_kpis
 WITH (security_invoker=true) AS
 SELECT * FROM internal.mv_secretaria_dashboard_kpis
 WHERE (escola_id IN ( SELECT eu.escola_id FROM escola_users eu WHERE eu.user_id = auth.uid()));

COMMIT;
