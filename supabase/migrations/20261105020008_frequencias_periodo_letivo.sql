begin;

alter table public.frequencias
  add column if not exists periodo_letivo_id uuid;

create index if not exists idx_frequencias_escola_periodo
  on public.frequencias (escola_id, periodo_letivo_id, matricula_id);

create or replace function public.fill_frequencias_periodo_letivo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.frequencias f
  set periodo_letivo_id = sub.periodo_letivo_id
  from (
    select
      f2.id as frequencia_id,
      pl.id as periodo_letivo_id,
      count(pl.id) over (partition by f2.id) as match_count
    from public.frequencias f2
    join public.matriculas m
      on m.id = f2.matricula_id
     and m.escola_id = f2.escola_id
    join public.anos_letivos al
      on al.escola_id = m.escola_id
     and al.ano = m.ano_letivo
    join public.periodos_letivos pl
      on pl.escola_id = f2.escola_id
     and pl.ano_letivo_id = al.id
     and f2.data between pl.data_inicio and pl.data_fim
    where f2.periodo_letivo_id is null
  ) sub
  where f.id = sub.frequencia_id
    and sub.match_count = 1;

  if exists (
    select 1
    from (
      select f2.id, count(pl.id) as match_count
      from public.frequencias f2
      join public.matriculas m
        on m.id = f2.matricula_id
       and m.escola_id = f2.escola_id
      join public.anos_letivos al
        on al.escola_id = m.escola_id
       and al.ano = m.ano_letivo
      join public.periodos_letivos pl
        on pl.escola_id = f2.escola_id
       and pl.ano_letivo_id = al.id
       and f2.data between pl.data_inicio and pl.data_fim
      where f2.periodo_letivo_id is null
      group by f2.id
      having count(pl.id) > 1
    ) matches
  ) then
    raise exception 'frequencias: múltiplos períodos encontrados no backfill';
  end if;
end;
$$;

select public.fill_frequencias_periodo_letivo();

notify pgrst, 'reload schema';

commit;
