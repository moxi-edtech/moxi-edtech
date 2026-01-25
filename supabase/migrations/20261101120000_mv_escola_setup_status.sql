create materialized view if not exists public.mv_escola_setup_status as
select
  id as escola_id,
  (exists (
    select 1 from public.anos_letivos
    where anos_letivos.escola_id = e.id and anos_letivos.ativo = true
  )) as has_ano_letivo_ativo,
  ((
    select count(*)
    from public.periodos_letivos pl
    join public.anos_letivos al on al.id = pl.ano_letivo_id
    where al.escola_id = e.id
      and al.ativo = true
      and pl.tipo = 'TRIMESTRE'::public.periodo_tipo
  ) >= 3) as has_3_trimestres,
  (exists (
    select 1
    from public.curso_curriculos cc
    join public.anos_letivos al on al.id = cc.ano_letivo_id
    where cc.escola_id = e.id
      and al.ativo = true
      and cc.status = 'published'::public.curriculo_status
  )) as has_curriculo_published,
  (exists (
    select 1
    from public.turmas t
    join public.anos_letivos al on al.escola_id = t.escola_id and al.ano = t.ano_letivo
    where t.escola_id = e.id and al.ativo = true
  )) as has_turmas_no_ano,
  (
    case
      when exists (
        select 1 from public.anos_letivos
        where anos_letivos.escola_id = e.id and anos_letivos.ativo = true
      ) then 25 else 0 end
    + case
      when (
        select count(*)
        from public.periodos_letivos pl
        join public.anos_letivos al on al.id = pl.ano_letivo_id
        where al.escola_id = e.id and al.ativo = true and pl.tipo = 'TRIMESTRE'::public.periodo_tipo
      ) >= 3 then 25 else 0 end
    + case
      when exists (
        select 1
        from public.curso_curriculos cc
        join public.anos_letivos al on al.id = cc.ano_letivo_id
        where cc.escola_id = e.id and al.ativo = true and cc.status = 'published'::public.curriculo_status
      ) then 25 else 0 end
    + case
      when exists (
        select 1
        from public.turmas t
        join public.anos_letivos al on al.escola_id = t.escola_id and al.ano = t.ano_letivo
        where t.escola_id = e.id and al.ativo = true
      ) then 25 else 0 end
  ) as percentage
from public.escolas e;

create unique index if not exists ux_mv_escola_setup_status
  on public.mv_escola_setup_status (escola_id);

create or replace view public.vw_escola_setup_status as
select *
from public.mv_escola_setup_status;

create or replace function public.refresh_mv_escola_setup_status()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.mv_escola_setup_status;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if not exists (select 1 from cron.job where jobname = 'refresh_mv_escola_setup_status') then
      perform cron.schedule(
        'refresh_mv_escola_setup_status',
        '*/10 * * * *',
        'select public.refresh_mv_escola_setup_status();'
      );
    end if;
  end if;
end $$;
