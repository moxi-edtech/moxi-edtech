create materialized view if not exists public.mv_ocupacao_turmas as
with base as (
  select
    t.id,
    t.escola_id,
    t.nome,
    cl.nome as classe,
    t.turno,
    t.sala,
    t.capacidade_maxima,
    (select count(*) from public.matriculas m where m.turma_id = t.id and m.status in ('ativa', 'ativo')) as total_matriculas_ativas
  from public.turmas t
  left join public.classes cl on cl.id = t.classe_id
)
select
  b.id,
  b.escola_id,
  b.nome,
  b.classe,
  b.turno,
  b.sala,
  b.capacidade_maxima,
  b.total_matriculas_ativas,
  case
    when b.capacidade_maxima is null or b.capacidade_maxima = 0 then 0
    else round((b.total_matriculas_ativas::numeric / b.capacidade_maxima::numeric) * 100, 2)
  end as ocupacao_percentual,
  case
    when b.capacidade_maxima is null or b.capacidade_maxima = 0 then 'disponivel'
    when (b.total_matriculas_ativas::numeric / b.capacidade_maxima::numeric) * 100 >= 110 then 'superlotada'
    when (b.total_matriculas_ativas::numeric / b.capacidade_maxima::numeric) * 100 >= 100 then 'cheia'
    when (b.total_matriculas_ativas::numeric / b.capacidade_maxima::numeric) * 100 >= 70 then 'ideal'
    else 'disponivel'
  end as status_ocupacao
from base b;

create unique index if not exists ux_mv_ocupacao_turmas
  on public.mv_ocupacao_turmas (escola_id, id);

create or replace view public.vw_ocupacao_turmas as
select *
from public.mv_ocupacao_turmas
where escola_id = public.current_tenant_escola_id();

grant select on public.mv_ocupacao_turmas to anon, authenticated, service_role;
grant select on public.vw_ocupacao_turmas to anon, authenticated, service_role;

create or replace function public.refresh_mv_ocupacao_turmas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_ocupacao_turmas;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_ocupacao_turmas') then
      perform cron.schedule(
        'refresh_mv_ocupacao_turmas',
        '*/10 * * * *',
        'select public.refresh_mv_ocupacao_turmas();'
      );
    end if;
  end if;
end $$;
