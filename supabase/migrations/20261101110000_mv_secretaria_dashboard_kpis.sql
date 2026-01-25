create materialized view if not exists public.mv_secretaria_dashboard_kpis as
with alunos_ativos as (
  select escola_id, count(distinct aluno_id) as total
  from public.matriculas
  where status in ('ativa', 'ativo', 'active')
  group by escola_id
),
matriculas_ativas as (
  select escola_id, count(*) as total
  from public.matriculas
  where status in ('ativa', 'ativo', 'active')
  group by escola_id
),
turmas_total as (
  select escola_id, count(*) as total
  from public.turmas
  group by escola_id
),
pendencias_importacao as (
  select escola_id, count(*) as total
  from public.import_migrations
  where status is null or status <> 'imported'
  group by escola_id
),
turmas_sem_professor as (
  select t.escola_id, count(distinct t.id) as total
  from public.turmas t
  left join (
    select distinct turma_id, escola_id
    from public.turma_disciplinas
    where professor_id is not null
  ) td on td.turma_id = t.id and td.escola_id = t.escola_id
  where td.turma_id is null
  group by t.escola_id
),
alunos_sem_turma as (
  select a.escola_id, count(distinct a.id) as total
  from public.alunos a
  left join public.matriculas m
    on m.aluno_id = a.id
   and m.escola_id = a.escola_id
   and m.status in ('ativa', 'ativo', 'active')
  where m.id is null
  group by a.escola_id
)
select
  e.id as escola_id,
  coalesce(alunos_ativos.total, 0)::int as total_alunos,
  coalesce(turmas_total.total, 0)::int as total_turmas,
  coalesce(matriculas_ativas.total, 0)::int as matriculas_ativas,
  coalesce(pendencias_importacao.total, 0)::int as pendencias_importacao,
  coalesce(turmas_sem_professor.total, 0)::int as turmas_sem_professor,
  coalesce(alunos_sem_turma.total, 0)::int as alunos_sem_turma,
  coalesce(fin.inadimplentes_total, 0)::int as inadimplentes_total,
  coalesce(fin.risco_total, 0)::numeric(14,2) as risco_total,
  coalesce(resumo.resumo_status, '[]'::jsonb) as resumo_status,
  coalesce(turmas.turmas_destaque, '[]'::jsonb) as turmas_destaque,
  coalesce(novas.novas_matriculas, '[]'::jsonb) as novas_matriculas,
  '[]'::jsonb as avisos_recentes
from public.escolas e
left join alunos_ativos on alunos_ativos.escola_id = e.id
left join turmas_total on turmas_total.escola_id = e.id
left join matriculas_ativas on matriculas_ativas.escola_id = e.id
left join pendencias_importacao on pendencias_importacao.escola_id = e.id
left join turmas_sem_professor on turmas_sem_professor.escola_id = e.id
left join alunos_sem_turma on alunos_sem_turma.escola_id = e.id
left join public.mv_financeiro_kpis_geral fin on fin.escola_id = e.id
left join lateral (
  select jsonb_agg(jsonb_build_object('status', status, 'total', total) order by status) as resumo_status
  from public.mv_secretaria_matriculas_status s
  where s.escola_id = e.id
) resumo on true
left join lateral (
  select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'total_alunos', t.total_alunos)
    order by t.total_alunos desc) as turmas_destaque
  from (
    select t.id, t.nome, count(m.id) as total_alunos
    from public.turmas t
    left join public.matriculas m
      on m.turma_id = t.id
     and m.status in ('ativa', 'ativo', 'active')
    where t.escola_id = e.id
    group by t.id
    order by total_alunos desc
    limit 4
  ) t
) turmas on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'created_at', m.created_at,
      'aluno', jsonb_build_object('nome', coalesce(a.nome_completo, a.nome, 'Aluno')),
      'turma', jsonb_build_object('nome', coalesce(t.nome, 'Sem turma'))
    )
    order by m.created_at desc
  ) as novas_matriculas
  from (
    select id, aluno_id, turma_id, created_at
    from public.matriculas
    where escola_id = e.id
    order by created_at desc
    limit 6
  ) m
  left join public.alunos a on a.id = m.aluno_id
  left join public.turmas t on t.id = m.turma_id
) novas on true;

create unique index if not exists ux_mv_secretaria_dashboard_kpis
  on public.mv_secretaria_dashboard_kpis (escola_id);

create or replace view public.vw_secretaria_dashboard_kpis as
select *
from public.mv_secretaria_dashboard_kpis
where escola_id = public.current_tenant_escola_id();

create or replace function public.refresh_mv_secretaria_dashboard_kpis()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_secretaria_dashboard_kpis;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_secretaria_dashboard_kpis') then
      perform cron.schedule(
        'refresh_mv_secretaria_dashboard_kpis',
        '*/10 * * * *',
        'select public.refresh_mv_secretaria_dashboard_kpis();'
      );
    end if;
  end if;
end $$;
