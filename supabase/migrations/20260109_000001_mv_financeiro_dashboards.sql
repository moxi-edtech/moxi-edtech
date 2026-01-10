-- =============================================================================
-- KLASSE — P0 PERFORMANCE: MATERIALIZED VIEWS (F09, F18)
-- - mv_radar_inadimplencia (F09)
-- - mv_relatorio_caixa_propinas (F18)
-- - wrapper views vw_* para não mudar app
-- - refresh functions prontas para agendamento externo
-- =============================================================================
begin;

-- 0) Extensões úteis (se já existir, ok)
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- =============================================================================
-- F09 — MV: Radar de Inadimplência
-- =============================================================================

-- 1) Drop view e MV antiga (se existir) — idempotente
drop view if exists public.vw_radar_inadimplencia;
drop materialized view if exists public.mv_radar_inadimplencia;

-- 2) Criar MV com o SQL da view original, mas sem o filtro de tenant
create materialized view public.mv_radar_inadimplencia as
SELECT m.escola_id,
    m.id AS mensalidade_id,
    m.aluno_id,
    a.nome AS nome_aluno,
    a.responsavel,
    a.telefone_responsavel AS telefone,
    t.nome AS nome_turma,
    COALESCE(m.valor_previsto, 0::numeric)::numeric(10,2) AS valor_previsto,
    COALESCE(m.valor_pago_total, 0::numeric) AS valor_pago_total,
    GREATEST(0::numeric, COALESCE(m.valor_previsto, 0::numeric) - COALESCE(m.valor_pago_total, 0::numeric)) AS valor_em_atraso,
    m.data_vencimento,
    GREATEST(0, CURRENT_DATE - m.data_vencimento) AS dias_em_atraso,
        CASE
            WHEN (CURRENT_DATE - m.data_vencimento) >= 30 THEN 'critico'::text
            WHEN (CURRENT_DATE - m.data_vencimento) >= 10 THEN 'atencao'::text
            ELSE 'recente'::text
        END AS status_risco,
    m.status AS status_mensalidade
   FROM public.mensalidades m
     JOIN public.alunos a ON a.id = m.aluno_id
     LEFT JOIN public.matriculas mat ON mat.aluno_id = m.aluno_id AND ((mat.status = ANY (ARRAY['ativo'::text, 'ativa'::text])) OR mat.ativo = true)
     LEFT JOIN public.turmas t ON t.id = mat.turma_id
  WHERE (m.status = ANY (ARRAY['pendente'::text, 'pago_parcial'::text])) AND m.data_vencimento < CURRENT_DATE
WITH DATA;

-- 3) UNIQUE INDEX obrigatório para REFRESH CONCURRENTLY
create unique index if not exists ux_mv_radar_inadimplencia
on public.mv_radar_inadimplencia (escola_id, mensalidade_id);

-- 4) Função refresh (SECURITY DEFINER para permitir job)
create or replace function public.refresh_mv_radar_inadimplencia()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_radar_inadimplencia;
end;
$$;

-- 5) Wrapper VIEW para compatibilidade
create or replace view public.vw_radar_inadimplencia as
select *
from public.mv_radar_inadimplencia
where escola_id = public.current_tenant_escola_id();

-- =============================================================================
-- F18 — MV: Relatório de Caixa/Propinas (Pagamentos por Status)
-- =============================================================================

drop view if exists public.pagamentos_status;
drop materialized view if exists public.mv_pagamentos_status;

-- Criar MV com o SQL da view original, mas corrigido para ser multi-tenant
create materialized view public.mv_pagamentos_status as
SELECT 
    p.escola_id,
    COALESCE(p.status, 'desconhecido'::text) AS status,
    count(*)::integer AS total
FROM public.pagamentos p
GROUP BY p.escola_id, (COALESCE(p.status, 'desconhecido'::text))
WITH DATA;

-- UNIQUE INDEX (escola_id + status)
create unique index if not exists ux_mv_pagamentos_status
on public.mv_pagamentos_status (escola_id, status);

-- Função refresh
create or replace function public.refresh_mv_pagamentos_status()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_pagamentos_status;
end;
$$;

-- Wrapper VIEW
create or replace view public.pagamentos_status as
select *
from public.mv_pagamentos_status
where escola_id = public.current_tenant_escola_id();

commit;
