begin;

create or replace function public.block_frequencias_after_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turma_id uuid;
  v_periodo_id uuid;
begin
  select turma_id
    into v_turma_id
  from public.matriculas
  where id = new.matricula_id
    and escola_id = new.escola_id;

  if v_turma_id is null then
    return new;
  end if;

  if new.periodo_letivo_id is not null then
    v_periodo_id := new.periodo_letivo_id;
  else
    select pl.id
      into v_periodo_id
    from public.periodos_letivos pl
    join public.anos_letivos al
      on al.id = pl.ano_letivo_id
     and al.escola_id = pl.escola_id
    join public.matriculas m
      on m.id = new.matricula_id
     and m.escola_id = new.escola_id
    where pl.escola_id = new.escola_id
      and al.ano = m.ano_letivo
      and pl.tipo = 'TRIMESTRE'
      and new.data between pl.data_inicio and pl.data_fim
    limit 1;

    if v_periodo_id is null then
      raise exception 'Período letivo não resolvido para a data informada.';
    end if;

    new.periodo_letivo_id := v_periodo_id;
  end if;

  if exists (
    select 1
    from public.frequencia_status_periodo fsp
    where fsp.escola_id = new.escola_id
      and fsp.turma_id = v_turma_id
      and fsp.periodo_letivo_id = v_periodo_id
  ) then
    raise exception 'Período fechado para frequência.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_frequencias_after_close on public.frequencias;

create trigger trg_block_frequencias_after_close
before insert or update on public.frequencias
for each row execute function public.block_frequencias_after_close();

notify pgrst, 'reload schema';

commit;
